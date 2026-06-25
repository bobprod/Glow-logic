"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { dmxEngine } from "@/lib/dmxEngine";
import { API_BASE } from "@/lib/config";
import { socket } from "@/lib/socket";
import useStore from "@/store/useStore";
import { EasingType } from "@/lib/DmxFader";
import type { TimelineClip } from "@/store/slices/timelineSlice";
import { clipToPad } from "@/lib/sceneBridge";
import {
  Save,
  FolderOpen,
  Trash2,
  Play,
  Copy,
  Sliders,
  Lightbulb,
  Timer,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Grid3x3,
} from "lucide-react";

const ACCENT = "#22d3ee"; // cyan-400

/**
 * Signature des actions clip exposees par la timelineSlice. On y accede via un
 * cast tolerant afin que ce composant compile seul, meme si la slice n'a pas
 * encore type ces actions (meme approche que SceneMaskEditor).
 */
type ClipActions = {
  setClipMask?: (clipId: string, channels: number[] | undefined) => void;
  setClipFade?: (clipId: string, seconds: number) => void;
};

/** Derive les canaux DMX (absolus) representes par les dmxCommands d'un clip. */
function deriveClipChannels(clip: TimelineClip | undefined): number[] {
  if (!clip || !Array.isArray(clip.dmxCommands)) return [];
  const channels = new Set<number>();
  for (const cmd of clip.dmxCommands) {
    const ch = Number(cmd?.channel);
    if (Number.isFinite(ch)) channels.add(ch);
  }
  return Array.from(channels)
    .filter((ch) => ch >= 1 && ch <= 512)
    .sort((a, b) => a - b);
}

interface DmxValue {
  universe: number;
  channel: number;
  value: number;
}

interface Scene {
  id: number;
  name: string;
  color: string;
  values: DmxValue[];
  created_at: string;
}

const COLORS = [
  { label: "Cyan", bg: "bg-cyan-500", text: "text-cyan-400", hex: "#06b6d4" },
  { label: "Rouge", bg: "bg-red-500", text: "text-red-400", hex: "#ef4444" },
  { label: "Violet", bg: "bg-purple-500", text: "text-purple-400", hex: "#a855f7" },
  { label: "Vert", bg: "bg-green-500", text: "text-green-400", hex: "#22c55e" },
  { label: "Orange", bg: "bg-orange-500", text: "text-orange-400", hex: "#f97316" },
  { label: "Rose", bg: "bg-pink-500", text: "text-pink-400", hex: "#ec4899" },
  { label: "Blanc", bg: "bg-white", text: "text-white", hex: "#ffffff" },
  { label: "Bleu", bg: "bg-blue-500", text: "text-blue-400", hex: "#3b82f6" },
  { label: "Ambre", bg: "bg-amber-500", text: "text-amber-400", hex: "#f59e0b" },
  { label: "Lime", bg: "bg-lime-500", text: "text-lime-400", hex: "#84cc16" },
];

export default function SceneClipPanel({
  selectedClipIds,
}: {
  /** Ids des clips selectionnes dans la timeline. Optionnel pour rester
   *  retro-compatible avec l'appel actuel `<SceneClipPanel />`. */
  selectedClipIds?: string[];
} = {}) {
  const { addToast, addSmartPad, addClip, clips } = useStore();
  // Acces tolerant aux actions clip (ajoutees par l'agent timelineSlice).
  const setClipMask = useStore((s) => (s as unknown as ClipActions).setClipMask);
  const setClipFade = useStore((s) => (s as unknown as ClipActions).setClipFade);

  // Clip cible = unique clip selectionne (sinon rien a editer).
  const selectedClip = useMemo<TimelineClip | undefined>(() => {
    if (!selectedClipIds || selectedClipIds.length !== 1) return undefined;
    return clips.find((c) => c.id === selectedClipIds[0]);
  }, [clips, selectedClipIds]);

  const clipChannels = useMemo(() => deriveClipChannels(selectedClip), [selectedClip]);

  // enabledChannels: undefined/absent => tous appliques ; [] => aucun.
  const clipEnabled = selectedClip?.enabledChannels;
  const clipMaskActive = Array.isArray(clipEnabled);
  const clipEnabledSet = useMemo(
    () => (Array.isArray(clipEnabled) ? new Set<number>(clipEnabled) : null),
    [clipEnabled],
  );
  const isClipChannelEnabled = (ch: number): boolean =>
    clipEnabledSet ? clipEnabledSet.has(ch) : true;
  const clipEnabledCount = clipMaskActive
    ? (clipEnabled as number[]).filter((ch) => ch >= 1 && ch <= 512).length
    : clipChannels.length;

  const toggleClipChannel = useCallback(
    (ch: number) => {
      if (!selectedClip || !setClipMask) return;
      const base = Array.isArray(selectedClip.enabledChannels)
        ? selectedClip.enabledChannels
        : clipChannels;
      const set = new Set<number>(base);
      if (set.has(ch)) set.delete(ch);
      else set.add(ch);
      setClipMask(
        selectedClip.id,
        Array.from(set).sort((a, b) => a - b),
      );
    },
    [selectedClip, setClipMask, clipChannels],
  );
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneName, setSceneName] = useState("");
  const [sceneColor, setSceneColor] = useState(COLORS[0]);
  const [currentValues, setCurrentValues] = useState<DmxValue[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fadeTime, setFadeTime] = useState(0);
  const [fadeEasing, setFadeEasing] = useState<EasingType>("sCurve");

  const FADE_PRESETS = [
    { label: "Instant", ms: 0, easing: "linear" as EasingType },
    { label: "0.5s", ms: 500, easing: "easeOut" as EasingType },
    { label: "1s", ms: 1000, easing: "sCurve" as EasingType },
    { label: "2s", ms: 2000, easing: "sCurve" as EasingType },
    { label: "3s", ms: 3000, easing: "easeInOut" as EasingType },
    { label: "5s", ms: 5000, easing: "easeInOut" as EasingType },
  ];

  useEffect(() => {
    loadScenes();
  }, []);

  useEffect(() => {
    const handler = (data: { universe: number; channel: number; value: number }) => {
      setCurrentValues(prev => {
        const idx = prev.findIndex(v => v.universe === data.universe && v.channel === data.channel);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
    };
    socket.on("dmx_sync", handler);
    return () => { socket.off("dmx_sync", handler); };
  }, []);

  const loadScenes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scenes`);
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
      }
    } catch {}
  };

  const captureCurrent = useCallback(() => {
    const values: DmxValue[] = [];
    for (let ch = 1; ch <= 512; ch++) {
      const v = dmxEngine.getChannel(1, ch);
      if (v > 0) {
        values.push({ universe: 1, channel: ch, value: v });
      }
    }
    setCurrentValues(values.sort((a, b) => a.channel - b.channel));
    addToast({ type: "info", message: "Valeurs DMX capturées", detail: `${values.length} canaux actifs` });
  }, [addToast]);

  const saveScene = async () => {
    if (!sceneName.trim()) return;
    setIsSaving(true);
    try {
      const values = currentValues.length > 0 ? currentValues : [];
      if (values.length === 0) {
        captureCurrent();
      }
      const res = await fetch(`${API_BASE}/api/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sceneName.trim(),
          color: sceneColor.hex,
          values: currentValues,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setScenes(prev => [...prev, saved]);
        addToast({ type: "success", message: "Scène sauvegardée", detail: sceneName.trim() });
        setSceneName("");
      } else {
        addToast({ type: "error", message: "Erreur sauvegarde scène" });
      }
    } catch {
      const values = currentValues.length > 0 ? currentValues : [];
      const nextId = Date.now();
      const localScene: Scene = {
        id: nextId,
        name: sceneName.trim(),
        color: sceneColor.hex,
        values,
        created_at: new Date().toISOString(),
      };
      setScenes(prev => [...prev, localScene]);
      addSmartPad({
        id: nextId,
        name: sceneName.trim(),
        color: sceneColor.bg,
        textColor: sceneColor.text,
        iconName: "Zap",
        qlcPage: 1,
        qlcWidget: nextId,
        dmxValues: Object.fromEntries(values.map(v => [v.channel, v.value])),
        midiNote: -1,
        midiChannel: 1,
        gridCol: 0, gridRow: 0, gridW: 1, gridH: 1,
      });
      addToast({ type: "success", message: "Scène sauvegardée localement", detail: sceneName.trim() });
      setSceneName("");
    } finally {
      setIsSaving(false);
    }
  };

  const loadScene = (scene: Scene) => {
    if (fadeTime > 0) {
      dmxEngine.fadeChannels(
        scene.values.map(v => ({ universe: v.universe, channel: v.channel, value: v.value })),
        fadeTime,
        fadeEasing,
      );
    } else {
      scene.values.forEach(v => {
        dmxEngine.setChannel(v.universe, v.channel, v.value);
      });
    }
    setCurrentValues([...scene.values]);
    addToast({ type: "info", message: fadeTime > 0 ? `Scène chargée (${fadeTime}ms fade)` : "Scène chargée", detail: scene.name });
  };

  const deleteScene = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/scenes/${id}`, { method: "DELETE" });
    } catch {}
    setScenes(prev => prev.filter(s => s.id !== id));
  };

  const addSceneToTimeline = useCallback((scene: Scene) => {
    const endTime = clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0);
    const palette = COLORS.find((color) => color.hex.toLowerCase() === scene.color.toLowerCase()) || sceneColor;
    addClip({
      id: `scene-${scene.id}-${Date.now()}`,
      track: "lights",
      name: scene.name.toUpperCase(),
      startTime: endTime + 1000,
      duration: Math.max(10000, fadeTime + 12000),
      color: palette.bg,
      textColor: palette.text,
      dmxCommands: scene.values,
      sourceType: "scene",
      sourceId: String(scene.id),
    });
    addToast({
      type: "success",
      message: "Scene ajoutee a la timeline",
      detail: scene.name,
    });
  }, [addClip, addToast, clips, fadeTime, sceneColor]);

  // Clip -> Pad : convertit le clip selectionne en SmartPad via le bridge pur,
  // puis reutilise addSmartPad tel quel (id genere ici, comme attendu par l'action).
  const sendClipToPad = useCallback(
    (clip: TimelineClip) => {
      addSmartPad({ id: Date.now(), ...clipToPad(clip) });
      addToast({
        type: "success",
        message: "Clip envoyé vers les pads",
        detail: clip.name,
      });
    },
    [addSmartPad, addToast],
  );

  return (
    <div className="bg-[#12141a] border border-[#262c36] rounded-2xl p-5 w-full max-w-md shrink-0 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-black text-sm tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          SCÈNES
        </h3>
        <span className="text-[10px] text-slate-500 font-mono bg-slate-800/50 px-2 py-1 rounded">
          {scenes.length} scènes · {currentValues.length} canaux actifs
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={sceneName}
          onChange={e => setSceneName(e.target.value)}
          placeholder="Nom de la scène…"
          className="flex-1 bg-[#0a0c10] border border-[#262c36] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={captureCurrent}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-all"
          title="Capturer les valeurs DMX actuelles"
        >
          <Lightbulb className="w-4 h-4 text-yellow-400" />
        </button>
        <button
          onClick={saveScene}
          disabled={!sceneName.trim() || isSaving}
          className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl border border-cyan-500/20 text-cyan-400 disabled:opacity-30 transition-all"
          title="Sauvegarder la scène"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {COLORS.map(c => (
          <button
            key={c.hex}
            onClick={() => setSceneColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${c.bg} ${
              sceneColor.hex === c.hex ? "border-white scale-110 shadow-lg" : "border-white/10"
            }`}
            title={c.label}
          />
        ))}
      </div>

      {/* Fade Time Selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <Timer className="w-3 h-3 inline mr-1" />
            Transition
          </span>
          <span className="text-[10px] text-cyan-400 font-mono">
            {fadeTime === 0 ? "Instant" : `${(fadeTime / 1000).toFixed(1)}s`}
          </span>
        </div>
        <div className="flex gap-1">
          {FADE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setFadeTime(p.ms); setFadeEasing(p.easing); }}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                fadeTime === p.ms
                  ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                  : "bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {fadeTime > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] text-slate-500">Courbe:</span>
            <select
              value={fadeEasing}
              onChange={(e) => setFadeEasing(e.target.value as EasingType)}
              className="flex-1 bg-[#0a0c10] border border-[#262c36] rounded-lg px-2 py-1 text-[10px] text-white"
            >
              <option value="linear">Linéaire</option>
              <option value="easeIn">Accélération</option>
              <option value="easeOut">Décélération</option>
              <option value="easeInOut">Accel/Décél</option>
              <option value="sCurve">S-Curve</option>
            </select>
          </div>
        )}
      </div>

      {/* ===== Editeur du clip selectionne (Fade A3 + Masque A2) ===== */}
      {selectedClip && (
        <div className="mb-4 rounded-xl border border-cyan-500/20 bg-[#0a0c10] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sliders className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <h4 className="truncate text-[11px] font-black uppercase tracking-widest text-white">
                Clip · {selectedClip.name}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => sendClipToPad(selectedClip)}
              disabled={!selectedClip}
              title="Créer un pad Smart depuis ce clip"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-30"
            >
              <Grid3x3 className="h-3 w-3" />
              → Pad
            </button>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                clipMaskActive
                  ? { background: "rgba(34,211,238,0.12)", color: ACCENT }
                  : { background: "rgba(255,255,255,0.06)", color: "#94a3b8" }
              }
            >
              {clipMaskActive ? `${clipEnabledCount} actif(s)` : "Tous"}
            </span>
          </div>

          {/* Fade (secondes) -> setClipFade */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <Timer className="w-3 h-3 inline mr-1" />
                Fade
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {(selectedClip.fadeSeconds ?? 0) === 0
                  ? "Instant"
                  : `${(selectedClip.fadeSeconds ?? 0).toFixed(1)}s`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={selectedClip.fadeSeconds ?? 0}
                onChange={(e) => setClipFade?.(selectedClip.id, Number(e.target.value))}
                className="flex-1 accent-cyan-400"
              />
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedClip.fadeSeconds ?? 0}
                onChange={(e) =>
                  setClipFade?.(selectedClip.id, Math.max(0, Number(e.target.value) || 0))
                }
                className="w-16 bg-[#0a0c10] border border-[#262c36] rounded-lg px-2 py-1 text-[11px] text-white text-right focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-[10px] text-slate-500">s</span>
            </div>
          </div>

          {/* Mini editeur de masque -> setClipMask */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <Eye className="w-3 h-3 inline mr-1" />
                Masque canaux
              </span>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] text-slate-500 mb-2">
              {clipMaskActive ? (
                <>Seuls les canaux actifs sont appliques par le clip. Les autres sont masques.</>
              ) : (
                <>Aucun masque : tous les canaux du clip s&apos;appliquent (comportement par defaut).</>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                onClick={() => setClipMask?.(selectedClip.id, [])}
                title="Masquer tous les canaux"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-black/25 px-2 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-white/20"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Tout desactiver
              </button>
              <button
                onClick={() => setClipMask?.(selectedClip.id, undefined)}
                title="Activer tous les canaux (supprime le masque)"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-black/25 px-2 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-white/20"
              >
                <Eye className="h-3.5 w-3.5" />
                Tout activer
              </button>
            </div>
            {clipChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-black/20 py-4 text-center">
                <Square className="h-6 w-6 text-slate-600" />
                <p className="text-[11px] text-slate-500">Aucun canal DMX dans ce clip</p>
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1.5">
                {clipChannels.map((ch) => {
                  const on = isClipChannelEnabled(ch);
                  return (
                    <button
                      key={ch}
                      onClick={() => toggleClipChannel(ch)}
                      title={
                        on
                          ? `Canal ${ch} actif — cliquer pour masquer`
                          : `Canal ${ch} masque — cliquer pour activer`
                      }
                      className="flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-[10px] font-bold transition-colors"
                      style={
                        on
                          ? { borderColor: ACCENT, background: "rgba(34,211,238,0.12)", color: ACCENT }
                          : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)", color: "#475569" }
                      }
                    >
                      {on ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                      <span className="font-mono">{ch}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {scenes.length === 0 && (
          <div className="text-center py-8">
            <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-xs">Aucune scène sauvegardée</p>
            <p className="text-slate-600 text-[10px] mt-1">Capture les valeurs DMX puis sauvegarde</p>
          </div>
        )}
        {scenes.map(scene => (
          <div key={scene.id} className="bg-[#0a0c10] rounded-xl p-3 border border-white/5 flex items-center gap-3 group hover:border-white/10 transition-all">
            <button
              onClick={() => loadScene(scene)}
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: scene.color + "20", borderColor: scene.color, border: `2px solid ${scene.color}40` }}
            >
              <Play className="w-4 h-4" style={{ color: scene.color }} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{scene.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                {scene.values.length} canaux · U1
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => loadScene(scene)}
                className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-cyan-400 transition-colors"
                title="Charger"
              >
                <Play className="w-3 h-3" />
              </button>
              <button
                onClick={() => addSceneToTimeline(scene)}
                className="p-1.5 rounded-lg hover:bg-purple-500/10 text-purple-400 transition-colors"
                title="Ajouter comme clip timeline"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteScene(scene.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { dmxEngine } from "@/lib/dmxEngine";
import { API_BASE } from "@/lib/config";
import { EasingType } from "@/lib/DmxFader";
import useStore from "@/store/useStore";
import {
  Play,
  SkipForward,
  Square,
  Plus,
  Trash2,
  Timer,
  Zap,
} from "lucide-react";

interface CueChannel {
  universe: number;
  channel: number;
  value: number;
}

interface Cue {
  id: number;
  name: string;
  channels: CueChannel[];
  fadeMs: number;
  holdMs: number;
  color: string;
  easing: EasingType;
}

interface CueList {
  id: number;
  name: string;
  cues: Cue[];
}

const CUE_COLORS = [
  "#06b6d4", "#ef4444", "#a855f7", "#22c55e", "#f97316",
  "#ec4899", "#eab308", "#3b82f6",
];

export default function CueClipPanel() {
  const { addToast, addClip, addMarker, clips } = useStore();
  const [cueLists, setCueLists] = useState<CueList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentCueIndex, setCurrentCueIndex] = useState(-1);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCueLists = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cues`);
      if (res.ok) {
        const data = await res.json();
        setCueLists(data);
        setSelectedListId(prev => prev ?? (data.length > 0 ? data[0].id : null));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCueLists();
  }, [loadCueLists]);

  const selectedList = cueLists.find(l => l.id === selectedListId) || null;

  const applyCue = useCallback((cue: Cue) => {
    cue.channels.forEach(ch => {
      dmxEngine.setChannel(ch.universe, ch.channel, ch.value);
    });
  }, []);

  const applyCueWithFade = useCallback((cue: Cue) => {
    if (cue.fadeMs <= 0) {
      applyCue(cue);
      return;
    }
    dmxEngine.fadeChannels(
      cue.channels.map(ch => ({ universe: ch.universe, channel: ch.channel, value: ch.value })),
      cue.fadeMs,
      cue.easing,
    );
  }, [applyCue]);

  const playCueList = useCallback(async () => {
    if (!selectedList || selectedList.cues.length === 0) return;
    setPlaying(true);
    playingRef.current = true;
    for (let i = 0; i < selectedList.cues.length; i++) {
      if (!playingRef.current) break;
      setCurrentCueIndex(i);
      const cue = selectedList.cues[i];
      applyCueWithFade(cue);
      addToast({ type: "info", message: `Cue ${i + 1}: ${cue.name}`, detail: `Fade ${cue.fadeMs}ms` });
      await new Promise<void>(resolve => {
        timerRef.current = setTimeout(resolve, cue.fadeMs + cue.holdMs);
      });
    }
    setPlaying(false);
    playingRef.current = false;
    setCurrentCueIndex(-1);
  }, [selectedList, applyCueWithFade, addToast]);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setCurrentCueIndex(-1);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const nextCue = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const createCueList = () => {
    const newId = Date.now();
    const newList: CueList = {
      id: newId,
      name: `Cue List ${cueLists.length + 1}`,
      cues: [],
    };
    setCueLists(prev => [...prev, newList]);
    setSelectedListId(newId);
  };

  const addCueToList = () => {
    if (!selectedList) return;
    const values: CueChannel[] = [];
    for (let ch = 1; ch <= 24; ch++) {
      const v = dmxEngine.getChannel(1, ch);
      if (v > 0) {
        values.push({ universe: 1, channel: ch, value: v });
      }
    }
    const newCue: Cue = {
      id: Date.now(),
      name: `Cue ${(selectedList?.cues.length ?? 0) + 1}`,
      channels: values,
      fadeMs: 500,
      holdMs: 2000,
      color: CUE_COLORS[selectedList.cues.length % CUE_COLORS.length],
      easing: "sCurve",
    };
    setCueLists(prev =>
      prev.map(l =>
        l.id === selectedListId ? { ...l, cues: [...l.cues, newCue] } : l
      )
    );
    addToast({ type: "success", message: "Cue ajouté", detail: newCue.name });
  };

  const deleteCue = (cueId: number) => {
    setCueLists(prev =>
      prev.map(l =>
        l.id === selectedListId
          ? { ...l, cues: l.cues.filter(c => c.id !== cueId) }
          : l
      )
    );
  };

  const deleteCueList = (listId: number) => {
    setCueLists(prev => prev.filter(l => l.id !== listId));
    if (selectedListId === listId) {
      setSelectedListId(cueLists.find(l => l.id !== listId)?.id ?? null);
    }
  };

  const updateCue = (cueId: number, updates: Partial<Cue>) => {
    setCueLists(prev =>
      prev.map(l =>
        l.id === selectedListId
          ? { ...l, cues: l.cues.map(c => c.id === cueId ? { ...c, ...updates } : c) }
          : l
      )
    );
  };

  const addCueListToTimeline = useCallback(() => {
    if (!selectedList || selectedList.cues.length === 0) {
      addToast({ type: "warning", message: "Cue list vide" });
      return;
    }

    const startAt = clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0) + 1000;
    let cursor = startAt;

    addMarker({
      id: `cue-list-marker-${selectedList.id}-${Date.now()}`,
      name: selectedList.name,
      time: cursor,
      color: "#f59e0b",
    });

    selectedList.cues.forEach((cue, index) => {
      const duration = Math.max(1000, cue.fadeMs + cue.holdMs);
      addClip({
        id: `cue-${selectedList.id}-${cue.id}-${Date.now()}-${index}`,
        track: "lights",
        name: cue.name.toUpperCase(),
        startTime: cursor,
        duration,
        color: "bg-amber-500",
        textColor: "text-amber-400",
        dmxCommands: cue.channels,
        sourceType: "cue",
        sourceId: String(cue.id),
      });
      cursor += duration;
    });

    addToast({
      type: "success",
      message: "Cue list ajoutee a la timeline",
      detail: `${selectedList.cues.length} cue(s)`,
    });
  }, [addClip, addMarker, addToast, clips, selectedList]);

  return (
    <div className="bg-[#12141a] border border-[#262c36] rounded-2xl p-5 w-full max-w-md shrink-0 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-black text-sm tracking-wider flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          CUE LIST
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={createCueList}
            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/20 text-amber-400 transition-all"
            title="Nouvelle cue list"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {cueLists.length > 0 && (
        <div className="mb-3">
          <select
            value={selectedListId ?? ""}
            onChange={e => setSelectedListId(Number(e.target.value))}
            className="w-full bg-[#0a0c10] border border-[#262c36] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
          >
            {cueLists.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.cues.length} cues)</option>
            ))}
          </select>
        </div>
      )}

      {selectedList && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={selectedList.name}
              onChange={e =>
                setCueLists(prev =>
                  prev.map(l => l.id === selectedListId ? { ...l, name: e.target.value } : l)
                )
              }
              className="flex-1 bg-[#0a0c10] border border-[#262c36] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => deleteCueList(selectedList.id)}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 text-red-400 transition-all"
              title="Supprimer cette cue list"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={playing ? stopPlayback : playCueList}
              disabled={!selectedList || selectedList.cues.length === 0}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all ${
                playing
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
              } disabled:opacity-30`}
            >
              {playing ? (
                <><Square className="w-4 h-4" /> STOP</>
              ) : (
                <><Play className="w-4 h-4" /> GO</>
              )}
            </button>
            <button
              onClick={nextCue}
              disabled={!playing}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/20 text-amber-400 text-sm font-bold transition-all disabled:opacity-30"
              title="Cue suivant"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              onClick={addCueToList}
              className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl border border-cyan-500/20 text-cyan-400 text-sm font-bold transition-all"
              title="Ajouter cue (capture DMX actuel)"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={addCueListToTimeline}
              disabled={selectedList.cues.length === 0}
              className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl border border-purple-500/20 text-purple-400 text-sm font-bold transition-all disabled:opacity-30"
              title="Ajouter cette cue list dans la timeline"
            >
              TL
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
            {selectedList.cues.length === 0 && (
              <div className="text-center py-6">
                <Zap className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Aucun cue</p>
                <p className="text-slate-600 text-[10px] mt-1">Règle les faders puis clique + pour capturer</p>
              </div>
            )}
            {selectedList.cues.map((cue, idx) => (
              <div
                key={cue.id}
                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                  idx === currentCueIndex
                    ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                    : "bg-[#0a0c10] border-white/5 hover:border-white/10"
                }`}
              >
                <button
                  onClick={() => { applyCue(cue); setCurrentCueIndex(idx); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cue.color + "20", border: `2px solid ${cue.color}40` }}
                >
                  <Play className="w-3 h-3" style={{ color: cue.color }} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500 w-5">{String(idx + 1).padStart(2, "0")}</span>
                    <input
                      type="text"
                      value={cue.name}
                      onChange={e => updateCue(cue.id, { name: e.target.value })}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-slate-500">FADE</span>
                      <input
                        type="number"
                        value={cue.fadeMs}
                        onChange={e => updateCue(cue.id, { fadeMs: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-12 bg-[#0a0c10] border border-white/5 rounded px-1 text-[10px] text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500/40"
                      />
                      <span className="text-[9px] text-slate-600">ms</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-slate-500">HOLD</span>
                      <input
                        type="number"
                        value={cue.holdMs}
                        onChange={e => updateCue(cue.id, { holdMs: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-12 bg-[#0a0c10] border border-white/5 rounded px-1 text-[10px] text-cyan-400 font-mono text-center focus:outline-none focus:border-cyan-500/40"
                      />
                      <span className="text-[9px] text-slate-600">ms</span>
                    </div>
                    <select
                      value={cue.easing}
                      onChange={e => updateCue(cue.id, { easing: e.target.value as EasingType })}
                      className="bg-[#0a0c10] border border-white/5 rounded px-1 text-[9px] text-purple-400 focus:outline-none focus:border-purple-500/40"
                    >
                      <option value="linear">Lin</option>
                      <option value="easeIn">Accel</option>
                      <option value="easeOut">Decel</option>
                      <option value="easeInOut">A/D</option>
                      <option value="sCurve">S-Curve</option>
                      <option value="snap">Snap</option>
                    </select>
                    <span className="text-[9px] text-slate-500 font-mono">{cue.channels.length}ch</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteCue(cue.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {cueLists.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <Timer className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-bold">Aucune Cue List</p>
            <p className="text-slate-600 text-xs mt-1">Crée une cue list pour programmer des séquences</p>
            <button
              onClick={createCueList}
              className="mt-4 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/20 text-amber-400 text-sm font-bold transition-all"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Créer une Cue List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

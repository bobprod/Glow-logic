"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import useStore from "../../store/useStore";
import { sendToGroup, flashGroup, blackoutGroup } from "../../lib/groupDispatch";
import {
  Brain,
  Mic,
  MicOff,
  Play,
  Square,
  Zap,
  Settings2,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────
const GROUPS = ["A", "B", "C", "D", "E", "F"] as const;
type Group = (typeof GROUPS)[number];

const GROUP_LABELS: Record<Group, string> = {
  A: "Face",
  B: "Latéraux",
  C: "Contres",
  D: "Douche 1",
  E: "Douche 2",
  F: "Douche 3",
};

const DROP_EFFECTS = [
  { id: "aucun", label: "Aucun" },
  { id: "flash_blanc", label: "Flash Blanc" },
  { id: "stroboscope", label: "Stroboscope" },
  { id: "flash_couleur", label: "Flash Couleur" },
] as const;

// ── Color from frequency analysis ─────────────────────────────────────────
function freqToRgb(
  bass: number,   // 0–1
  mid: number,    // 0–1
  treble: number, // 0–1
  energy: number  // 0–1 global RMS
): [number, number, number] {
  // Normalise so dominant band = 1
  const total = bass + mid + treble + 0.001;
  const b = bass / total;
  const m = mid / total;
  const t = treble / total;

  // Bass → warm red/orange
  // Mid  → green/cyan
  // Treble → blue/white
  let r = Math.round((b * 1.0 + m * 0.2 + t * 0.1) * 255);
  let g = Math.round((b * 0.3 + m * 1.0 + t * 0.4) * 255);
  let bv = Math.round((b * 0.1 + m * 0.4 + t * 1.0) * 255);

  // Scale by energy
  r = Math.round(Math.min(255, r * energy * 1.4));
  g = Math.round(Math.min(255, g * energy * 1.4));
  bv = Math.round(Math.min(255, bv * energy * 1.4));

  return [r, g, bv];
}

// ── BPM onset detector ─────────────────────────────────────────────────────
class OnsetDetector {
  private history: number[] = [];
  private lastOnset = 0;
  private intervals: number[] = [];
  bpm = 0;

  feed(bassEnergy: number, now: number) {
    this.history.push(bassEnergy);
    if (this.history.length > 43) this.history.shift(); // ~1s at 43fps

    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const isOnset = bassEnergy > avg * 1.5 && bassEnergy > 0.15;

    if (isOnset && now - this.lastOnset > 250) {
      if (this.lastOnset > 0) {
        const interval = now - this.lastOnset;
        if (interval < 2000) {
          this.intervals.push(interval);
          if (this.intervals.length > 8) this.intervals.shift();
          const avgInterval =
            this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
          this.bpm = Math.round(60000 / avgInterval);
        }
      }
      this.lastOnset = now;
      return true; // onset detected
    }
    return false;
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AILightingPage() {
  const {
    aiEnabled, setAIEnabled,
    aiNervosite, setAINervosite,
    aiDropEffect, setAIDropEffect,
    aiGroupConfig, setAIGroupConfig,
    aiDetectedBpm, setAIDetectedBpm,
    aiCurrentColors, setAICurrentColor,
    patch, loadPatch, patchLoaded,
    setBpm,
    setSmartZoneValue,
    addToast,
  } = useStore();

  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [bassLevel, setBassLevel] = useState(0);
  const [midLevel, setMidLevel] = useState(0);
  const [trebleLevel, setTrebleLevel] = useState(0);
  const [dropFlash, setDropFlash] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onsetRef = useRef(new OnsetDetector());
  // Smoothed color values per group (for nervosité interpolation)
  const smoothedRef = useRef<Record<string, [number, number, number]>>({});
  const lastDropRef = useRef(0);

  // Load patch on mount
  useEffect(() => {
    if (!patchLoaded) loadPatch();
  }, [patchLoaded, loadPatch]);

  // ── Audio engine ─────────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      setMicActive(true);
      setMicError(null);
    } catch (e) {
      setMicError("Accès micro refusé — autorisez le microphone dans le navigateur");
    }
  }, []);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setMicActive(false);
    setBassLevel(0);
    setMidLevel(0);
    setTrebleLevel(0);
  }, []);

  // ── Analysis loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!aiEnabled || !micActive || !analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufLen = analyser.frequencyBinCount; // 1024
    const freqData = new Uint8Array(bufLen);
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const binHz = sampleRate / (analyser.fftSize);

    // Bin ranges
    const bassEnd = Math.floor(250 / binHz);
    const midEnd = Math.floor(4000 / binHz);
    // treble: midEnd → bufLen

    const smooth = (aiNervosite / 100) * 0.35 + 0.05; // 0.05–0.40 lerp speed

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      analyser.getByteFrequencyData(freqData);

      // Energy per band (0–1)
      const avg = (start: number, end: number) => {
        let s = 0;
        for (let i = start; i < end; i++) s += freqData[i];
        return s / ((end - start) * 255);
      };

      const bass = avg(1, Math.max(2, bassEnd));
      const mid = avg(bassEnd, Math.max(bassEnd + 1, midEnd));
      const treble = avg(midEnd, bufLen);
      const energy = avg(0, bufLen);

      setBassLevel(bass);
      setMidLevel(mid);
      setTrebleLevel(treble);

      // BPM detection
      const now = Date.now();
      const isOnset = onsetRef.current.feed(bass, now);
      if (onsetRef.current.bpm > 0) {
        setAIDetectedBpm(onsetRef.current.bpm);
        setBpm(onsetRef.current.bpm);
      }

      // DROP effect on strong onset
      if (isOnset && bass > 0.6 && aiDropEffect !== "aucun" && now - lastDropRef.current > 500) {
        lastDropRef.current = now;
        setDropFlash(true);
        setTimeout(() => setDropFlash(false), 120);

        if (aiDropEffect === "flash_blanc" || aiDropEffect === "flash_couleur") {
          const [fr, fg, fb] = aiDropEffect === "flash_blanc"
            ? [255, 255, 255]
            : freqToRgb(bass, mid, treble, 1);
          GROUPS.forEach((grp) => {
            if (aiGroupConfig[grp]?.active) {
              const maxI = (aiGroupConfig[grp]?.maxLevel ?? 100) / 100;
              sendToGroup(grp, { r: fr, g: fg, b: fb, intensity: maxI, patch, setSmartZoneValue });
            }
          });
        }
        // stroboscope — handled by a quick on/off
        if (aiDropEffect === "stroboscope") {
          let strobCount = 0;
          const strobInterval = setInterval(() => {
            const on = strobCount % 2 === 0;
            GROUPS.forEach((grp) => {
              if (aiGroupConfig[grp]?.active) {
                const maxI = (aiGroupConfig[grp]?.maxLevel ?? 100) / 100;
                on
                  ? flashGroup(grp, patch, maxI)
                  : blackoutGroup(grp, patch);
              }
            });
            if (++strobCount >= 6) clearInterval(strobInterval);
          }, 60);
        }
        return; // skip normal color update on drop frame
      }

      // Normal color dispatch per group
      const baseRgb = freqToRgb(bass, mid, treble, energy);

      GROUPS.forEach((grp, idx) => {
        if (!aiGroupConfig[grp]?.active) return;
        const maxI = (aiGroupConfig[grp]?.maxLevel ?? 100) / 100;

        // Phase offset per group (A=0°, B=60°, …) for wave effect
        const phase = (idx / GROUPS.length) * Math.PI * 2;
        const phaseMod = (Math.sin(Date.now() / 1000 + phase) + 1) / 2; // 0–1
        const nervMod = 0.7 + phaseMod * 0.3 * (aiNervosite / 100);

        const target: [number, number, number] = [
          Math.round(baseRgb[0] * nervMod),
          Math.round(baseRgb[1] * nervMod),
          Math.round(baseRgb[2] * nervMod),
        ];

        // Smooth interpolation
        const prev = smoothedRef.current[grp] ?? target;
        const lerped: [number, number, number] = [
          Math.round(prev[0] + (target[0] - prev[0]) * smooth),
          Math.round(prev[1] + (target[1] - prev[1]) * smooth),
          Math.round(prev[2] + (target[2] - prev[2]) * smooth),
        ];
        smoothedRef.current[grp] = lerped;
        setAICurrentColor(grp, lerped);

        sendToGroup(grp, {
          r: lerped[0],
          g: lerped[1],
          b: lerped[2],
          intensity: maxI,
          patch,
          setSmartZoneValue,
        });
      });
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [aiEnabled, micActive, aiNervosite, aiDropEffect, aiGroupConfig, patch, setSmartZoneValue, setBpm, setAIDetectedBpm, setAICurrentColor]);

  const handleToggle = async () => {
    if (aiEnabled) {
      setAIEnabled(false);
      stopMic();
      // Blackout all active groups
      GROUPS.forEach((grp) => {
        if (aiGroupConfig[grp]?.active) blackoutGroup(grp, patch);
      });
      addToast({ type: "info", message: "IA Lumière désactivée" });
    } else {
      await startMic();
      setAIEnabled(true);
      addToast({ type: "success", message: "IA Lumière activée", detail: "Analyse audio en cours…" });
    }
  };

  // Cleanup on unmount
  useEffect(() => () => { stopMic(); cancelAnimationFrame(rafRef.current); }, [stopMic]);

  const rgbToHex = ([r, g, b]: [number, number, number]) =>
    `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full bg-[#07090d] text-white overflow-auto">
      {/* ── HEADER ────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-6 py-4 border-b border-white/5 transition-colors ${dropFlash ? "bg-white/10" : "bg-[#0a0c10]"}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${aiEnabled ? "bg-cyan-500/20" : "bg-white/5"}`}>
            <Brain className={`w-5 h-5 ${aiEnabled ? "text-cyan-400" : "text-slate-500"}`} />
          </div>
          <div>
            <h1 className="font-black tracking-widest text-sm uppercase text-white">IA Lumière</h1>
            <p className="text-[10px] text-slate-500">
              {aiEnabled ? "Analyse audio active" : "Désactivé"}
              {aiDetectedBpm > 0 && aiEnabled && ` · ${aiDetectedBpm} BPM détectés`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {micError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
              {micError}
            </p>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-xl border transition-all ${showConfig ? "bg-white/10 border-white/20 text-white" : "bg-black/40 border-white/5 text-slate-500 hover:text-white"}`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${
              aiEnabled
                ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
                : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
            }`}
          >
            {aiEnabled ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {aiEnabled ? "Arrêter" : "Démarrer"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── CENTER: Groups + Visualizer ──────────────────── */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Frequency bars */}
          <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
              Analyse spectrale
            </h3>
            <div className="flex items-end gap-4 h-24">
              {[
                { label: "BASSES", value: bassLevel, color: "bg-red-500", glow: "shadow-[0_0_20px_rgba(239,68,68,0.5)]" },
                { label: "MÉDIUMS", value: midLevel, color: "bg-green-500", glow: "shadow-[0_0_20px_rgba(34,197,94,0.5)]" },
                { label: "AIGUS", value: trebleLevel, color: "bg-blue-500", glow: "shadow-[0_0_20px_rgba(59,130,246,0.5)]" },
              ].map(({ label, value, color, glow }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-black/40 rounded-lg overflow-hidden h-16 flex items-end">
                    <div
                      className={`w-full ${color} rounded-lg transition-all duration-75 ${value > 0.6 ? glow : ""}`}
                      style={{ height: `${Math.round(value * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                    <span className="text-[10px] font-mono text-slate-400">{Math.round(value * 100)}%</span>
                  </div>
                </div>
              ))}
              {/* Mic indicator */}
              <div className="flex flex-col items-center gap-2 justify-end pb-6">
                {micActive ? (
                  <Mic className="w-5 h-5 text-green-400 animate-pulse" />
                ) : (
                  <MicOff className="w-5 h-5 text-slate-600" />
                )}
              </div>
            </div>
          </div>

          {/* Group cards */}
          <div className="grid grid-cols-3 gap-3">
            {GROUPS.map((grp) => {
              const cfg = aiGroupConfig[grp] ?? { active: false, maxLevel: 100 };
              const color = aiCurrentColors[grp] ?? [20, 20, 20];
              const hex = cfg.active && aiEnabled ? rgbToHex(color) : "#1a1f2e";
              const fixtureCount = patch.filter((f) => f.grp === grp).length;

              return (
                <div
                  key={grp}
                  onClick={() => setAIGroupConfig(grp, { active: !cfg.active })}
                  className={`relative rounded-2xl p-4 border cursor-pointer transition-all overflow-hidden ${
                    cfg.active
                      ? "border-white/10 bg-[#0d1117]"
                      : "border-white/5 bg-[#0a0c10] opacity-50"
                  }`}
                >
                  {/* Color glow background */}
                  <div
                    className="absolute inset-0 opacity-20 transition-colors duration-150"
                    style={{ background: hex }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 transition-colors duration-150"
                          style={{ background: hex }}
                        />
                        <span className="text-sm font-black text-white">Groupe {grp}</span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${cfg.active ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-slate-700"}`} />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{GROUP_LABELS[grp]}</p>
                    <p className="text-[10px] text-slate-600 mb-2">
                      {fixtureCount} fixture{fixtureCount !== 1 ? "s" : ""} patchées
                    </p>

                    {/* Max level slider */}
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider w-6">
                        {cfg.maxLevel}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={cfg.maxLevel}
                        onChange={(e) => setAIGroupConfig(grp, { maxLevel: parseInt(e.target.value) })}
                        className="flex-1 accent-cyan-400"
                        disabled={!cfg.active}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Config panel ───────────────────────────── */}
        {showConfig && (
          <div className="w-72 border-l border-white/5 bg-[#0a0c10] p-5 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                Paramètres
              </h3>

              {/* Nervosité */}
              <label className="text-xs text-slate-300 font-bold block mb-1">
                Nervosité
                <span className="ml-2 font-mono text-cyan-400">{aiNervosite}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={aiNervosite}
                onChange={(e) => setAINervosite(parseInt(e.target.value))}
                className="w-full accent-cyan-400 mb-1"
              />
              <p className="text-[10px] text-slate-600 mb-4">
                Basse = transitions douces · Haute = réaction immédiate
              </p>

              {/* DROP effect */}
              <label className="text-xs text-slate-300 font-bold block mb-2">
                Effet DROP
              </label>
              <div className="flex flex-col gap-1.5">
                {DROP_EFFECTS.map((ef) => (
                  <button
                    key={ef.id}
                    onClick={() => setAIDropEffect(ef.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      aiDropEffect === ef.id
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        : "bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {aiDropEffect === ef.id && <Zap className="w-3 h-3 inline mr-2" />}
                    {ef.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BPM */}
            <div className="bg-black/40 rounded-xl border border-white/5 p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                BPM Détecté
              </p>
              <p className="text-3xl font-black font-mono text-cyan-400">
                {aiDetectedBpm > 0 ? aiDetectedBpm : "—"}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">Synchronisé avec QLC+</p>
            </div>

            {/* Patch status */}
            <div className="bg-black/40 rounded-xl border border-white/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Patch chargé
              </p>
              <p className="text-sm font-mono text-white">{patch.length} fixtures</p>
              <button
                onClick={loadPatch}
                className="mt-2 text-[10px] text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Recharger le patch →
              </button>
            </div>

            {/* Source info */}
            <div className="text-[10px] text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-500 mb-1">Pipeline</p>
              <p>Micro → Web Audio API<br />→ Analyse basses/médiums/aigus<br />→ Couleurs par groupe<br />→ Socket.io dmx_update<br />→ ArtNet + QLC+ OSC</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

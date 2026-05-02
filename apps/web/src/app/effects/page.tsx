"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import useStore from "../../store/useStore";
import { sendToGroup, blackoutGroup } from "../../lib/groupDispatch";
import {
  Zap,
  Plus,
  Trash2,
  Play,
  Square,
  Copy,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type LayerType = "Strobe" | "Flash" | "Chase" | "Fade";
type GroupFilter = "Tous" | "Pair" | "Impair" | "A" | "B" | "C" | "D" | "E" | "F";

interface EffectLayer {
  id: string;
  type: LayerType;
  speed: number;      // 0–100 → BPM multiplier
  amplitude: number;  // 0–100 → 0–255 peak value
  offset: number;     // 0–100 → phase offset %
  groups: GroupFilter[];
  color: string;      // hex
}

interface EffectPreset {
  id: string;
  name: string;
  category: string;
  layers: EffectLayer[];
}

// ── Factory ────────────────────────────────────────────────────────────────
const makeLayer = (type: LayerType = "Strobe"): EffectLayer => ({
  id: Math.random().toString(36).slice(2),
  type,
  speed: 50,
  amplitude: 100,
  offset: 0,
  groups: ["Tous"],
  color: "#22d3ee",
});

const DEFAULT_PRESETS: EffectPreset[] = [
  {
    id: "strobe-classic",
    name: "Strobe Classique",
    category: "Strobe",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 50 }],
  },
  {
    id: "strobe-slow",
    name: "Strobe Lent",
    category: "Strobe",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 20 }],
  },
  {
    id: "strobe-fast",
    name: "Strobe Rapide",
    category: "Strobe",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 80 }],
  },
  {
    id: "strobe-alt",
    name: "Strobe Alternance",
    category: "Strobe",
    layers: [
      { ...makeLayer("Strobe"), amplitude: 100, speed: 50, groups: ["Pair"], offset: 0 },
      { ...makeLayer("Strobe"), amplitude: 100, speed: 50, groups: ["Impair"], offset: 50 },
    ],
  },
  {
    id: "flash-color",
    name: "Flash Couleur",
    category: "Flash",
    layers: [{ ...makeLayer("Flash"), amplitude: 80, speed: 30, color: "#a855f7" }],
  },
  {
    id: "flash-white",
    name: "Flash Blanc",
    category: "Flash",
    layers: [{ ...makeLayer("Flash"), amplitude: 100, speed: 60, color: "#ffffff" }],
  },
  {
    id: "strobe-blue",
    name: "Strobe Bleu",
    category: "Strobe Couleur",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 50, color: "#3b82f6" }],
  },
  {
    id: "strobe-green",
    name: "Strobe Vert",
    category: "Strobe Couleur",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 50, color: "#22c55e" }],
  },
  {
    id: "strobe-red",
    name: "Strobe Rouge",
    category: "Strobe Couleur",
    layers: [{ ...makeLayer("Strobe"), amplitude: 100, speed: 50, color: "#ef4444" }],
  },
  {
    id: "blinder",
    name: "Blinder",
    category: "Strobe",
    layers: [{ ...makeLayer("Flash"), amplitude: 100, speed: 5, color: "#fef3c7" }],
  },
  {
    id: "chase-white",
    name: "Chase Blanc",
    category: "Chase",
    layers: [
      { ...makeLayer("Chase"), amplitude: 100, speed: 40, groups: ["A"], offset: 0 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 40, groups: ["B"], offset: 25 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 40, groups: ["C"], offset: 50 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 40, groups: ["D"], offset: 75 },
    ],
  },
  {
    id: "chase-fast",
    name: "Chase Rapide",
    category: "Chase",
    layers: [
      { ...makeLayer("Chase"), amplitude: 100, speed: 75, groups: ["A"], offset: 0 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 75, groups: ["B"], offset: 25 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 75, groups: ["C"], offset: 50 },
      { ...makeLayer("Chase"), amplitude: 100, speed: 75, groups: ["D"], offset: 75 },
    ],
  },
];

const CATEGORIES = ["Strobe", "Flash", "Strobe Couleur", "Chase"];

const GROUP_FILTERS: GroupFilter[] = ["Tous", "Pair", "Impair", "A", "B", "C", "D", "E", "F"];

const GROUP_COLORS: Record<string, string> = {
  A: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  B: "bg-green-500/20 text-green-400 border-green-500/30",
  C: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  D: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  E: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  F: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Tous: "bg-white/10 text-white border-white/20",
  Pair: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Impair: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

// ── Waveform mini-canvas ───────────────────────────────────────────────────
function WaveformPreview({
  layer,
  bpm,
}: {
  layer: EffectLayer;
  bpm: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const peak = (layer.amplitude / 100) * H * 0.9;
    const period = Math.max(4, Math.round(W / ((layer.speed / 100) * 6 + 1)));
    const phaseOff = (layer.offset / 100) * period;

    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = layer.color;
    ctx.beginPath();

    for (let x = 0; x < W; x++) {
      const t = (x + phaseOff) % period;
      let y: number;
      if (layer.type === "Strobe" || layer.type === "Flash") {
        y = t < period * 0.35 ? H - peak : H;
      } else if (layer.type === "Chase") {
        const sine = Math.sin((t / period) * Math.PI * 2);
        y = H - ((sine + 1) / 2) * peak;
      } else {
        const tri = t < period / 2 ? t / (period / 2) : 1 - (t - period / 2) / (period / 2);
        y = H - tri * peak;
      }
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [layer, bpm]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={36}
      className="rounded bg-black/40"
    />
  );
}

// ── Knob component ─────────────────────────────────────────────────────────
function Knob({
  label,
  value,
  onChange,
  color = "#22d3ee",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const angle = -135 + (value / 100) * 270; // -135° → +135°
  const r = 22;
  const cx = 28;
  const cy = 28;
  const rad = (angle * Math.PI) / 180;
  const tipX = cx + r * Math.sin(rad);
  const tipY = cy - r * Math.cos(rad);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      const next = Math.max(0, Math.min(100, startVal.current + delta));
      onChange(Math.round(next));
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onChange]);

  // Arc path
  const startAngle = -135;
  const endAngle = angle;
  const toRad = (a: number) => (a * Math.PI) / 180;
  const arcX1 = cx + r * Math.sin(toRad(startAngle));
  const arcY1 = cy - r * Math.cos(toRad(startAngle));
  const arcX2 = cx + r * Math.sin(toRad(endAngle));
  const arcY2 = cy - r * Math.cos(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={56}
        height={56}
        onMouseDown={onMouseDown}
        className="cursor-ns-resize"
      >
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2530" strokeWidth={4} />
        {/* Arc filled */}
        {value > 0 && (
          <path
            d={`M ${arcX1} ${arcY1} A ${r} ${r} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={18} fill="#0d1117" stroke="#1e2530" strokeWidth={1.5} />
        {/* Tip indicator */}
        <line
          x1={cx}
          y1={cy}
          x2={tipX}
          y2={tipY}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={color} />
      </svg>
      <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
        {label}
      </span>
      <span className="text-xs font-mono text-white">{value}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EffectsPage() {
  const { patch, patchLoaded, loadPatch, setSmartZoneValue, bpm: globalBpm, setBpm: setGlobalBpm } = useStore();

  const [presets, setPresets] = useState<EffectPreset[]>(DEFAULT_PRESETS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const [bpm, setBpm] = useState(globalBpm);
  const tapTimesRef = useRef<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);

  // Sync local BPM → global store
  const handleBpmChange = (v: number) => { setBpm(v); setGlobalBpm(v); };

  // Load patch on mount
  useEffect(() => { if (!patchLoaded) loadPatch(); }, [patchLoaded, loadPatch]);

  const selected = presets.find((p) => p.id === selectedId) ?? presets[0];

  const updatePreset = (updated: EffectPreset) => {
    setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const updateLayer = (layerIdx: number, patch: Partial<EffectLayer>) => {
    const layers = selected.layers.map((l, i) =>
      i === layerIdx ? { ...l, ...patch } : l
    );
    updatePreset({ ...selected, layers });
  };

  // ── Playback engine ──────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing) return;

    const periodMs = (60 / bpm) * 1000;
    const STEPS = 32;
    const stepMs = periodMs / STEPS;

    intervalRef.current = setInterval(() => {
      tickRef.current = (tickRef.current + 1) % STEPS;
      const tick = tickRef.current;

      selected.layers.forEach((layer) => {
        const phaseStep = Math.round((layer.offset / 100) * STEPS);
        const t = (tick + phaseStep) % STEPS;
        const peak = Math.round((layer.amplitude / 100) * 255);
        const speedSteps = Math.max(1, Math.round((layer.speed / 100) * STEPS));
        const halfPeriod = Math.round(speedSteps * 0.35);

        let val = 0;
        if (layer.type === "Strobe" || layer.type === "Flash") {
          val = t % speedSteps < halfPeriod ? peak : 0;
        } else if (layer.type === "Chase") {
          val = Math.round(((Math.sin((t / speedSteps) * Math.PI * 2) + 1) / 2) * peak);
        } else {
          const tri = t % speedSteps < speedSteps / 2
            ? (t % speedSteps) / (speedSteps / 2)
            : 1 - ((t % speedSteps) - speedSteps / 2) / (speedSteps / 2);
          val = Math.round(tri * peak);
        }

        const intensity = val / 255;
        // Parse hex color from layer
        const hex = layer.color.replace("#", "");
        const lr = parseInt(hex.substring(0, 2), 16);
        const lg = parseInt(hex.substring(2, 4), 16);
        const lb = parseInt(hex.substring(4, 6), 16);

        // Dispatch to each assigned group via patch
        const targetGroups = layer.groups.includes("Tous")
          ? ["A", "B", "C", "D", "E", "F"]
          : layer.groups.includes("Pair")
          ? ["B", "D", "F"]
          : layer.groups.includes("Impair")
          ? ["A", "C", "E"]
          : layer.groups;

        if (patch.length > 0) {
          targetGroups.forEach((grp) => {
            if (intensity === 0) {
              blackoutGroup(grp, patch);
            } else {
              sendToGroup(grp, { r: lr, g: lg, b: lb, intensity, patch, setSmartZoneValue });
            }
          });
        }
      });

      if (!looping && tickRef.current === 0) {
        setPlaying(false);
      }
    }, stepMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, bpm, selected, looping]);

  const handleTap = () => {
    const now = Date.now();
    let taps = [...tapTimesRef.current, now];
    if (taps.length > 1 && now - taps[taps.length - 2] > 3000) taps = [now];
    if (taps.length > 8) taps.shift();
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      const diffs = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      handleBpmChange(Math.round(60000 / avg));
    }
  };

  const addLayer = () => {
    updatePreset({
      ...selected,
      layers: [...selected.layers, makeLayer("Strobe")],
    });
  };

  const removeLayer = (idx: number) => {
    updatePreset({
      ...selected,
      layers: selected.layers.filter((_, i) => i !== idx),
    });
  };

  const duplicatePreset = () => {
    const copy: EffectPreset = {
      ...selected,
      id: Math.random().toString(36).slice(2),
      name: selected.name + " (copie)",
    };
    setPresets((p) => [...p, copy]);
    setSelectedId(copy.id);
  };

  const newPreset = () => {
    const p: EffectPreset = {
      id: Math.random().toString(36).slice(2),
      name: "Nouvel effet",
      category: "Strobe",
      layers: [makeLayer("Strobe")],
    };
    setPresets((prev) => [...prev, p]);
    setSelectedId(p.id);
  };

  const toggleGroupFilter = (layerIdx: number, g: GroupFilter) => {
    const layer = selected.layers[layerIdx];
    let next: GroupFilter[];
    if (g === "Tous") {
      next = ["Tous"];
    } else {
      const without = layer.groups.filter((x) => x !== "Tous");
      if (without.includes(g)) {
        next = without.filter((x) => x !== g);
        if (next.length === 0) next = ["Tous"];
      } else {
        next = [...without, g];
      }
    }
    updateLayer(layerIdx, { groups: next });
  };

  // Group presets by category
  const byCategory = CATEGORIES.reduce<Record<string, EffectPreset[]>>(
    (acc, cat) => {
      acc[cat] = presets.filter((p) => p.category === cat);
      return acc;
    },
    {}
  );
  const custom = presets.filter((p) => !CATEGORIES.includes(p.category));

  return (
    <div className="flex h-full bg-[#07090d] text-white overflow-hidden">
      {/* ── LEFT: Effect Library ──────────────────────────── */}
      <div className="w-56 border-r border-white/5 bg-[#0a0c10] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Effets
          </h2>
          <button
            onClick={newPreset}
            className="w-6 h-6 flex items-center justify-center rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all"
            title="Nouvel effet"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
                {cat}
              </p>
              {(byCategory[cat] ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                    selectedId === p.id
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {selectedId === p.id && (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          ))}
          {custom.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
                Personnalisés
              </p>
              {custom.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                    selectedId === p.id
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {selectedId === p.id && (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Layer Editor ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preset header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0c10]">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-cyan-400" />
            <input
              value={selected.name}
              onChange={(e) =>
                updatePreset({ ...selected, name: e.target.value })
              }
              className="bg-transparent text-white font-bold text-sm focus:outline-none border-b border-transparent focus:border-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={duplicatePreset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-xs text-slate-400 hover:text-white transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              Dupliquer
            </button>
            <button
              onClick={addLayer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs text-cyan-400 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une couche
            </button>
          </div>
        </div>

        {/* Layer list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selected.layers.map((layer, idx) => (
            <div
              key={layer.id}
              className="bg-[#0d1117] border border-white/5 rounded-xl p-4 flex flex-col gap-3"
            >
              {/* Layer top row */}
              <div className="flex items-center gap-3">
                {/* Color swatch */}
                <div className="relative w-7 h-7 shrink-0">
                  <div
                    className="w-7 h-7 rounded-full border border-white/10 cursor-pointer"
                    style={{ background: layer.color }}
                    onClick={() => {
                      const input = document.getElementById(`color-${layer.id}`);
                      input?.click();
                    }}
                  />
                  <input
                    id={`color-${layer.id}`}
                    type="color"
                    value={layer.color}
                    onChange={(e) => updateLayer(idx, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>

                {/* Type selector */}
                <select
                  value={layer.type}
                  onChange={(e) =>
                    updateLayer(idx, { type: e.target.value as LayerType })
                  }
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {(["Strobe", "Flash", "Chase", "Fade"] as LayerType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    )
                  )}
                </select>

                {/* Waveform */}
                <WaveformPreview layer={layer} bpm={bpm} />

                <div className="flex-1" />

                <button
                  onClick={() => removeLayer(idx)}
                  className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Group filters */}
              <div className="flex flex-wrap gap-1.5">
                {GROUP_FILTERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGroupFilter(idx, g)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      layer.groups.includes(g)
                        ? GROUP_COLORS[g] ?? "bg-white/10 text-white border-white/20"
                        : "bg-transparent text-slate-600 border-white/5 hover:text-slate-400"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* VIT / AMP / DÉC sliders (compact) */}
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { key: "speed", label: "VITESSE" },
                    { key: "amplitude", label: "AMPLITUDE" },
                    { key: "offset", label: "DÉCALAGE" },
                  ] as { key: keyof EffectLayer; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {layer[key] as number}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={layer[key] as number}
                      onChange={(e) =>
                        updateLayer(idx, { [key]: parseInt(e.target.value) })
                      }
                      className="accent-cyan-400"
                      style={{
                        accentColor:
                          key === "speed"
                            ? "#22d3ee"
                            : key === "amplitude"
                            ? "#a855f7"
                            : "#f59e0b",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {selected.layers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
              <Zap className="w-10 h-10 opacity-30" />
              <p className="text-sm">Aucune couche — cliquez sur "Ajouter une couche"</p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Controls ───────────────────────────────── */}
      <div className="w-64 border-l border-white/5 bg-[#0a0c10] flex flex-col p-4 gap-5 overflow-y-auto">
        {/* Knobs */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
            Paramètres globaux
          </h3>
          <div className="flex items-center justify-around">
            <Knob
              label="VIT"
              value={Math.round((bpm / 200) * 100)}
              onChange={(v) => setBpm(Math.round((v / 100) * 200))}
              color="#22d3ee"
            />
            <Knob
              label="AMP"
              value={
                selected.layers[0]?.amplitude ?? 100
              }
              onChange={(v) =>
                selected.layers.forEach((_, i) => updateLayer(i, { amplitude: v }))
              }
              color="#a855f7"
            />
            <Knob
              label="DÉC"
              value={selected.layers[0]?.offset ?? 0}
              onChange={(v) => updateLayer(0, { offset: v })}
              color="#f59e0b"
            />
          </div>
        </div>

        {/* BPM + TAP */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              BPM
            </span>
            <span className="text-sm font-mono text-cyan-400 font-bold">{bpm}</span>
          </div>
          <button
            onClick={handleTap}
            className="w-full py-2.5 bg-black/40 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-all active:scale-95"
          >
            TAP BPM
          </button>
          <input
            type="range"
            min={40}
            max={200}
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>

        {/* Playback */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Lecture
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPlaying(!playing)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                playing
                  ? "bg-red-500/20 border-red-500/30 text-red-400"
                  : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
              }`}
            >
              {playing ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Play
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                tickRef.current = 0;
              }}
              className="p-2.5 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Boucle / Une fois */}
          <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
            <button
              onClick={() => setLooping(true)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                looping
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Boucle
            </button>
            <button
              onClick={() => setLooping(false)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                !looping
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Une fois
            </button>
          </div>
        </div>

        {/* Group assignment (E1-E8) */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Affecter au groupe
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"].map((e) => (
              <button
                key={e}
                className="py-1.5 bg-black/40 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 rounded-lg text-[10px] font-bold text-slate-500 hover:text-cyan-400 transition-all"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

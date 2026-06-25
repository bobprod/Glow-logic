"use client";

import React, { useMemo } from "react";
import { Activity, Plus, Power, Trash2, Waves } from "lucide-react";
import useStore from "../../store/useStore";
import {
  DEFAULT_OSC_CONFIG,
  type OscWaveform,
  type OscillatorConfig,
} from "../../lib/oscillatorEngine";
import type { OscillatorAssignment } from "../../store/slices/oscillatorSlice";

const WAVEFORMS: { value: OscWaveform; label: string }[] = [
  { value: "sine", label: "Sine" },
  { value: "square", label: "Square" },
  { value: "triangle", label: "Triangle" },
  { value: "sawUp", label: "Saw Up" },
  { value: "sawDown", label: "Saw Down" },
];

const ACCENT = "#22d3ee"; // cyan-400

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-cyan-300">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/40 accent-cyan-400"
        style={{ accentColor: ACCENT }}
      />
    </label>
  );
}

function OscillatorCard({ osc }: { osc: OscillatorAssignment }) {
  const updateOscillatorConfig = useStore((s) => s.updateOscillatorConfig);
  const setOscillatorEnabled = useStore((s) => s.setOscillatorEnabled);
  const removeOscillator = useStore((s) => s.removeOscillator);

  const cfg = osc.config;
  const patch = (p: Partial<OscillatorConfig>) => updateOscillatorConfig(osc.id, p);

  return (
    <div
      className="rounded-xl border bg-[#12141A] p-3"
      style={{ borderColor: osc.enabled ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.06)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Waves
            className="h-4 w-4 shrink-0"
            style={{ color: osc.enabled ? ACCENT : "#64748b" }}
          />
          <span className="truncate text-xs font-bold text-white">
            {osc.channels.length > 0 ? `${osc.channels.length} canal(aux)` : "Aucun canal"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setOscillatorEnabled(osc.id, !osc.enabled)}
            title={osc.enabled ? "Desactiver" : "Activer"}
            className="rounded-lg border border-white/5 p-1.5 transition-colors hover:border-white/20"
            style={{ color: osc.enabled ? ACCENT : "#64748b", background: osc.enabled ? "rgba(34,211,238,0.1)" : "transparent" }}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => removeOscillator(osc.id)}
            title="Supprimer"
            className="rounded-lg border border-white/5 p-1.5 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Forme d&apos;onde
        </span>
        <div className="grid grid-cols-5 gap-1">
          {WAVEFORMS.map((w) => {
            const active = cfg.waveform === w.value;
            return (
              <button
                key={w.value}
                onClick={() => patch({ waveform: w.value })}
                className="rounded-md border px-1 py-1 text-[10px] font-semibold transition-colors"
                style={{
                  borderColor: active ? ACCENT : "rgba(255,255,255,0.06)",
                  background: active ? "rgba(34,211,238,0.12)" : "rgba(0,0,0,0.25)",
                  color: active ? ACCENT : "#94a3b8",
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        <SliderRow
          label="Amount"
          value={cfg.amount}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => patch({ amount: v })}
        />
        <SliderRow
          label="Speed (mesures)"
          value={cfg.speedBars}
          min={0.25}
          max={16}
          step={0.25}
          format={(v) => `${v}`}
          onChange={(v) => patch({ speedBars: v })}
        />
        <SliderRow
          label="Chase"
          value={cfg.chase}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => patch({ chase: v })}
        />
        <SliderRow
          label="Shape"
          value={cfg.shape}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => patch({ shape: v })}
        />
        <SliderRow
          label="Center"
          value={cfg.center}
          min={0}
          max={255}
          step={1}
          format={(v) => `${Math.round(v)}`}
          onChange={(v) => patch({ center: v })}
        />
      </div>
    </div>
  );
}

export default function OscillatorPanel(): React.JSX.Element {
  const oscillators = useStore((s) => s.oscillators);
  const addOscillator = useStore((s) => s.addOscillator);
  const fixtures = useStore((s) => s.fixtures);
  const selectedFixtureIds = useStore((s) => s.selectedFixtureIds);
  const selectedFixtureId = useStore((s) => s.selectedFixtureId);

  // Derive absolute DMX channels from the current fixture selection.
  const selectionChannels = useMemo<number[]>(() => {
    const ids = new Set<string>(selectedFixtureIds);
    if (selectedFixtureId) ids.add(selectedFixtureId);
    if (ids.size === 0) return [];

    const channels: number[] = [];
    for (const fixture of fixtures as any[]) {
      const nodeId: string = fixture?.nodeId || `fixture-${fixture?.id}`;
      if (!ids.has(nodeId)) continue;
      const start = Number(fixture?.startAddress || fixture?.start_address || 1);
      const fixtureChannels = Array.isArray(fixture?.channels) ? fixture.channels : [];
      if (fixtureChannels.length > 0) {
        for (const ch of fixtureChannels) {
          const offset = Number(ch?.channel || 1);
          channels.push(start + offset - 1);
        }
      } else {
        channels.push(start);
      }
    }
    return Array.from(new Set(channels)).sort((a, b) => a - b);
  }, [fixtures, selectedFixtureIds, selectedFixtureId]);

  const handleAdd = () => {
    // Use the current selection if available; otherwise create an empty oscillator.
    addOscillator(selectionChannels, { ...DEFAULT_OSC_CONFIG });
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[#090b0e] p-3 text-slate-300">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Oscillateurs</h2>
          {oscillators.length > 0 && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              {oscillators.length}
            </span>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter oscillateur
        </button>
      </header>

      {selectionChannels.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] text-slate-500">
          Selection: {selectionChannels.length} canal(aux) seront assignes au prochain oscillateur.
        </div>
      )}

      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
        {oscillators.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <Waves className="h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">Aucun oscillateur</p>
            <p className="max-w-[220px] text-[11px] text-slate-500">
              Selectionne des projecteurs puis ajoute un oscillateur pour moduler leurs canaux.
            </p>
          </div>
        ) : (
          oscillators.map((osc) => <OscillatorCard key={osc.id} osc={osc} />)
        )}
      </div>
    </div>
  );
}

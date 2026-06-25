"use client";

import React, { useMemo } from "react";
import { Palette, Wand2, Sparkles, Crosshair, Power, Orbit, Infinity as InfinityIcon, Waves } from "lucide-react";
import useStore from "../../store/useStore";
import { dmxEngine } from "../../lib/dmxEngine";
import { NAMED_COLORS, colorByName, linearSpread, type RGBW } from "../../lib/macrosEngine";
import { DEFAULT_OSC_CONFIG, type OscillatorConfig } from "../../lib/oscillatorEngine";

// Color swatch order for the palette row.
const COLOR_NAMES = [
  "red",
  "green",
  "blue",
  "white",
  "amber",
  "cyan",
  "magenta",
  "orange",
  "pink",
  "off",
] as const;

const SWATCH_CSS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  white: "#f8fafc",
  amber: "#f59e0b",
  cyan: "#22d3ee",
  magenta: "#d946ef",
  orange: "#fb923c",
  pink: "#f472b6",
  off: "#1e293b",
};

const ACCENT = "#22d3ee"; // cyan-400 — coherent with OscillatorPanel

interface ResolvedFixture {
  nodeId: string;
  name: string;
  universe: number;
  // absolute channel numbers per logical type (or undefined if absent)
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  dimmer?: number;
  pan?: number;
  tilt?: number;
}

/**
 * Resolve the current fixture selection into absolute DMX channels per type.
 * absolute_channel = start_address + channel_offset - 1
 */
function useSelectedFixtures(): ResolvedFixture[] {
  const fixtures = useStore((s) => s.fixtures);
  const selectedFixtureIds = useStore((s) => s.selectedFixtureIds);
  const selectedFixtureId = useStore((s) => s.selectedFixtureId);

  return useMemo<ResolvedFixture[]>(() => {
    const ids = new Set<string>(selectedFixtureIds || []);
    if (selectedFixtureId) ids.add(selectedFixtureId);
    if (ids.size === 0) return [];

    const out: ResolvedFixture[] = [];
    for (const fixture of fixtures as any[]) {
      const nodeId: string = fixture?.nodeId || `fixture-${fixture?.id}`;
      if (!ids.has(nodeId)) continue;

      const start = Number(fixture?.startAddress || fixture?.start_address || 1);
      const universe = Number(fixture?.universe || 1);
      const fixtureChannels = Array.isArray(fixture?.channels) ? fixture.channels : [];

      const resolved: ResolvedFixture = {
        nodeId,
        name: fixture?.name || nodeId,
        universe,
      };

      for (const ch of fixtureChannels) {
        const type = String(ch?.type || "").toLowerCase();
        const offset = Number(ch?.channel || 1);
        const abs = start + offset - 1;
        switch (type) {
          case "red":
            resolved.red = abs;
            break;
          case "green":
            resolved.green = abs;
            break;
          case "blue":
            resolved.blue = abs;
            break;
          case "white":
            resolved.white = abs;
            break;
          case "dimmer":
          case "intensity":
            if (resolved.dimmer === undefined) resolved.dimmer = abs;
            break;
          case "pan":
            resolved.pan = abs;
            break;
          case "tilt":
            resolved.tilt = abs;
            break;
          default:
            break;
        }
      }

      out.push(resolved);
    }
    return out;
  }, [fixtures, selectedFixtureIds, selectedFixtureId]);
}

/** Tolerant access to addToast (toastSlice) so the component compiles standalone. */
interface ToastActions {
  addToast?: (t: { type?: string; message: string; detail?: string }) => void;
}

export default function MacrosPanel(): React.JSX.Element {
  const selection = useSelectedFixtures();
  const hasSelection = selection.length > 0;

  const addOscillator = useStore((s) => s.addOscillator);
  const addToast = useStore((s) => (s as unknown as ToastActions).addToast);

  // Fixtures of the selection that expose BOTH pan and tilt channels.
  const movers = useMemo(
    () => selection.filter((f) => f.pan !== undefined && f.tilt !== undefined),
    [selection],
  );
  const hasMovers = movers.length > 0;

  /**
   * Apply a movement "shape" by creating oscillators on the pan/tilt channels
   * of every selected mover. Each shape supplies a pan config and a tilt config
   * (partial overrides merged on top of DEFAULT_OSC_CONFIG). One addOscillator
   * call per logical channel (pan group, then tilt group) keeps the engine math
   * per-fixture correct via the absolute channel numbers.
   */
  const applyShape = (
    label: string,
    panCfg: Partial<OscillatorConfig>,
    tiltCfg: Partial<OscillatorConfig>,
  ) => {
    if (!addOscillator || movers.length === 0) return;

    const panChannels: number[] = [];
    const tiltChannels: number[] = [];
    for (const f of movers) {
      if (f.pan !== undefined) panChannels.push(f.pan);
      if (f.tilt !== undefined) tiltChannels.push(f.tilt);
    }

    if (panChannels.length > 0) {
      addOscillator(panChannels, { ...DEFAULT_OSC_CONFIG, ...panCfg });
    }
    if (tiltChannels.length > 0) {
      addOscillator(tiltChannels, { ...DEFAULT_OSC_CONFIG, ...tiltCfg });
    }

    addToast?.({
      type: "success",
      message: `${label} applique`,
      detail: `${movers.length} tete${movers.length > 1 ? "s" : ""} mobile${movers.length > 1 ? "s" : ""}`,
    });
  };

  // Circle: pan sine phase 0, tilt sine phase 0.25 (90° offset).
  const handleCircle = () =>
    applyShape(
      "Cercle",
      { waveform: "sine", amount: 0.5, speedBars: 2, center: 127, phase: 0 },
      { waveform: "sine", amount: 0.5, speedBars: 2, center: 127, phase: 0.25 },
    );

  // Figure-8: pan sine (speedBars S), tilt sine at double frequency (speedBars S/2).
  const handleFigure8 = () =>
    applyShape(
      "Figure-8",
      { waveform: "sine", amount: 0.5, speedBars: 2, center: 127, phase: 0 },
      { waveform: "sine", amount: 0.5, speedBars: 1, center: 127, phase: 0 },
    );

  // Sweep: pan sine only (phase 0). Tilt stays centered.
  const handleSweep = () =>
    applyShape(
      "Sweep",
      { waveform: "sine", amount: 0.5, speedBars: 2, center: 127, phase: 0 },
      { waveform: "sine", amount: 0, speedBars: 2, center: 127, phase: 0 },
    );

  // Apply an RGBW color to every selected fixture.
  const applyColor = (rgbw: RGBW) => {
    for (const f of selection) {
      if (f.red !== undefined) dmxEngine.setChannel(f.universe, f.red, rgbw.r);
      if (f.green !== undefined) dmxEngine.setChannel(f.universe, f.green, rgbw.g);
      if (f.blue !== undefined) dmxEngine.setChannel(f.universe, f.blue, rgbw.b);
      if (f.white !== undefined && rgbw.w !== undefined) {
        dmxEngine.setChannel(f.universe, f.white, rgbw.w);
      }
    }
  };

  const handleColorByName = (name: string) => {
    const rgbw = colorByName(name) ?? NAMED_COLORS[name];
    if (!rgbw) return;
    applyColor(rgbw);
  };

  // Fan dimmer: spread 0..255 linearly across selected fixtures (in order).
  const handleFanDimmer = () => {
    const values = linearSpread(selection.length, 0, 255);
    selection.forEach((f, i) => {
      if (f.dimmer !== undefined) {
        const v = Math.round(Number(values[i] ?? 0));
        dmxEngine.setChannel(f.universe, f.dimmer, v);
      }
    });
  };

  // Center pan/tilt at 127.
  const handleCenter = () => {
    for (const f of selection) {
      if (f.pan !== undefined) dmxEngine.setChannel(f.universe, f.pan, 127);
      if (f.tilt !== undefined) dmxEngine.setChannel(f.universe, f.tilt, 127);
    }
  };

  // Blackout selection: dimmer/r/g/b/w to 0.
  const handleBlackout = () => {
    for (const f of selection) {
      if (f.dimmer !== undefined) dmxEngine.setChannel(f.universe, f.dimmer, 0);
      if (f.red !== undefined) dmxEngine.setChannel(f.universe, f.red, 0);
      if (f.green !== undefined) dmxEngine.setChannel(f.universe, f.green, 0);
      if (f.blue !== undefined) dmxEngine.setChannel(f.universe, f.blue, 0);
      if (f.white !== undefined) dmxEngine.setChannel(f.universe, f.white, 0);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[#090b0e] p-3 text-slate-300">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Macros</h2>
          {hasSelection && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              {selection.length}
            </span>
          )}
        </div>
      </header>

      {!hasSelection ? (
        <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
          <Wand2 className="h-8 w-8 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Aucune selection</p>
          <p className="max-w-[220px] text-[11px] text-slate-500">
            Selectionne un ou plusieurs projecteurs pour appliquer des macros couleur, fan et centrage.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
          {/* Color palette */}
          <div className="rounded-xl border border-white/5 bg-[#12141A] p-3">
            <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Palette className="h-3.5 w-3.5 text-cyan-400" />
              Couleurs
            </span>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_NAMES.map((name) => {
                const css = SWATCH_CSS[name] ?? "#1e293b";
                const isOff = name === "off";
                return (
                  <button
                    key={name}
                    onClick={() => handleColorByName(name)}
                    title={name}
                    className="group flex flex-col items-center gap-1"
                  >
                    <span
                      className="h-7 w-full rounded-md border transition-transform group-hover:scale-105"
                      style={{
                        background: isOff ? "rgba(0,0,0,0.4)" : css,
                        borderColor: isOff ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)",
                      }}
                    />
                    <span className="text-[9px] font-semibold capitalize text-slate-500 group-hover:text-slate-300">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action macros */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleFanDimmer}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
            >
              <Sparkles className="h-4 w-4" />
              Fan dimmer
              <span className="ml-auto font-mono text-[10px] text-cyan-400/70">0 → 255</span>
            </button>

            <button
              onClick={handleCenter}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-bold text-slate-200 transition-colors hover:border-white/25 hover:bg-black/50"
            >
              <Crosshair className="h-4 w-4 text-cyan-400" />
              Center Pan/Tilt
              <span className="ml-auto font-mono text-[10px] text-slate-500">127</span>
            </button>

            <button
              onClick={handleBlackout}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] font-bold text-red-300 transition-colors hover:border-red-500/50 hover:bg-red-500/15"
            >
              <Power className="h-4 w-4" />
              Blackout selection
              <span className="ml-auto font-mono text-[10px] text-red-400/60">0</span>
            </button>
          </div>

          {/* Shapes (Pan/Tilt oscillators) */}
          <div className="rounded-xl border border-white/5 bg-[#12141A] p-3">
            <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Orbit className="h-3.5 w-3.5 text-cyan-400" />
              Shapes Pan/Tilt
              {hasMovers && (
                <span className="ml-auto rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                  {movers.length}
                </span>
              )}
            </span>

            {!hasMovers ? (
              <p className="px-1 py-2 text-[10px] leading-relaxed text-slate-500">
                Selectionne au moins une tete mobile (canaux pan &amp; tilt) pour appliquer une forme.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleCircle}
                  title="Cercle (pan/tilt dephasés 90°)"
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <Orbit className="h-4 w-4" />
                  Cercle
                </button>

                <button
                  onClick={handleFigure8}
                  title="Figure-8 (tilt à fréquence double)"
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <InfinityIcon className="h-4 w-4" />
                  Figure-8
                </button>

                <button
                  onClick={handleSweep}
                  title="Sweep (pan seul)"
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-2.5 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <Waves className="h-4 w-4" />
                  Sweep
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

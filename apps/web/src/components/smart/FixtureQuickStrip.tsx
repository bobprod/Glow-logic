"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Crosshair, Expand, Power } from "lucide-react";
import XYPad from "../widgets/XYPad";
import useStore from "../../store/useStore";
import { dmxEngine } from "../../lib/dmxEngine";
import { socket } from "../../lib/socket";
import type { DmxChannel, PatchedFixture } from "../../types/dmx";

const COLOR_PRESETS = [
  { name: "Blanc", color: "#ffffff", r: 255, g: 255, b: 255, w: 255 },
  { name: "Rouge", color: "#ef4444", r: 255, g: 0, b: 0, w: 0 },
  { name: "Orange", color: "#f97316", r: 255, g: 80, b: 0, w: 0 },
  { name: "Jaune", color: "#facc15", r: 255, g: 200, b: 0, w: 0 },
  { name: "Vert", color: "#22c55e", r: 0, g: 255, b: 0, w: 0 },
  { name: "Cyan", color: "#22d3ee", r: 0, g: 200, b: 255, w: 0 },
  { name: "Bleu", color: "#3b82f6", r: 0, g: 0, b: 255, w: 0 },
  { name: "Magenta", color: "#ec4899", r: 255, g: 0, b: 180, w: 0 },
];

const COLOR_WHEEL_PRESETS = [
  { name: "Blanc", value: 5, color: "#ffffff" },
  { name: "Rouge", value: 80, color: "#ef4444" },
  { name: "Orange", value: 140, color: "#f97316" },
  { name: "Jaune", value: 20, color: "#facc15" },
  { name: "Vert", value: 120, color: "#22c55e" },
  { name: "Cyan", value: 60, color: "#22d3ee" },
  { name: "Bleu", value: 40, color: "#3b82f6" },
  { name: "Magenta", value: 150, color: "#ec4899" },
];

function absChannel(fixture: PatchedFixture, channel: DmxChannel) {
  return Number(fixture.startAddress || fixture.start_address || 1) + Number(channel.channel || 1) - 1;
}

function findChannel(fixture: PatchedFixture, types: string[]) {
  return fixture.channels.find((channel) => types.includes(channel.type));
}

interface FixtureQuickStripProps {
  fixtureId: string;
  onOpenInspector: () => void;
}

export default function FixtureQuickStrip({ fixtureId, onOpenInspector }: FixtureQuickStripProps) {
  const { fixtures, selectedFixtureIds } = useStore();
  const [values, setValues] = useState<Record<string, number>>({});

  const fixture = fixtures.find((f) => f.nodeId === fixtureId) || null;
  const targets = useMemo(() => {
    if (!fixture) return [];
    const ids = selectedFixtureIds.length > 1 ? selectedFixtureIds : [fixture.nodeId || fixtureId];
    return fixtures.filter((f) => f.nodeId && ids.includes(f.nodeId));
  }, [fixture, fixtureId, fixtures, selectedFixtureIds]);

  useEffect(() => {
    if (!fixture) return;
    const initial: Record<string, number> = {};
    targets.forEach((t) => {
      t.channels.forEach((ch) => {
        initial[`${t.nodeId}-${ch.channel}`] = dmxEngine.getChannel(Number(t.universe || 1), absChannel(t, ch));
      });
    });
    setValues(initial);

    const onDmxSync = (data: { universe: number; channel: number; value: number }) => {
      targets.forEach((t) => {
        const localCh = data.channel - Number(t.startAddress || t.start_address || 1) + 1;
        if (data.universe === Number(t.universe || 1) && localCh >= 1 && localCh <= Number(t.totalChannels || t.total_channels || 0)) {
          setValues((prev) => ({ ...prev, [`${t.nodeId}-${localCh}`]: data.value }));
        }
      });
    };
    socket.on("dmx_sync", onDmxSync);
    return () => { socket.off("dmx_sync", onDmxSync); };
  }, [fixture, targets]);

  if (!fixture) return null;

  const panCh = findChannel(fixture, ["pan"]);
  const tiltCh = findChannel(fixture, ["tilt"]);
  const panFineCh = findChannel(fixture, ["pan_fine"]);
  const tiltFineCh = findChannel(fixture, ["tilt_fine"]);
  const dimmerCh = findChannel(fixture, ["dimmer", "intensity"]);
  const redCh = findChannel(fixture, ["red"]);
  const greenCh = findChannel(fixture, ["green"]);
  const blueCh = findChannel(fixture, ["blue"]);
  const whiteCh = findChannel(fixture, ["white"]);
  const colorWheelCh = findChannel(fixture, ["color_wheel", "color"]);
  const hasColor = Boolean((redCh && greenCh && blueCh) || colorWheelCh);
  const hasMovement = Boolean(panCh && tiltCh);

  const getValue = (channel: DmxChannel) => values[`${fixture.nodeId}-${channel.channel}`] ?? 0;

  // Multi-selection aggregation: returns the per-target values for a channel type
  // (channel matched by the same pattern used by sendChannel).
  const collectValues = (channelType: string): number[] => {
    return targets.map((t) => {
      const ch = t.channels.find((c) => c.type === channelType || (channelType === "dimmer" && c.type === "intensity"));
      if (!ch) return undefined;
      return values[`${t.nodeId}-${ch.channel}`] ?? 0;
    }).filter((v): v is number => v !== undefined);
  };

  // True when more than one target is selected and their values for this
  // channel type diverge (mixed state).
  const isMixed = (channelType: string): boolean => {
    if (targets.length <= 1) return false;
    const vals = collectValues(channelType);
    return vals.length > 1 && new Set(vals).size > 1;
  };

  // Common value across all targets when uniform; falls back to the primary
  // fixture's value when single-selection or no matching channels.
  const getAggregatedValue = (channel: DmxChannel, channelType: string): number => {
    if (targets.length <= 1) return getValue(channel);
    const vals = collectValues(channelType);
    if (vals.length === 0) return getValue(channel);
    return new Set(vals).size === 1 ? vals[0] : getValue(channel);
  };

  const sendChannel = (channelType: string, value: number) => {
    targets.forEach((t) => {
      const ch = t.channels.find((c) => c.type === channelType || (channelType === "dimmer" && c.type === "intensity"));
      if (!ch) return;
      dmxEngine.setChannel(Number(t.universe || 1), absChannel(t, ch), value, { source: "manual" });
      setValues((prev) => ({ ...prev, [`${t.nodeId}-${ch.channel}`]: value }));
    });
  };

  const sendRgb = (r: number, g: number, b: number, w?: number) => {
    sendChannel("red", r);
    sendChannel("green", g);
    sendChannel("blue", b);
    if (w !== undefined && whiteCh) sendChannel("white", w);
  };

  const blackout = () => {
    ["dimmer", "intensity", "red", "green", "blue", "white", "amber", "uv"].forEach((t) => sendChannel(t, 0));
  };

  const multiLabel = selectedFixtureIds.length > 1 ? `${selectedFixtureIds.length} fixtures` : null;

  return (
    <div className="flex items-stretch gap-3 rounded-xl border border-cyan-500/20 bg-[#0d1117] px-3 py-3 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
      {/* Fixture name + blackout */}
      <div className="flex w-[130px] shrink-0 flex-col justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-widest text-cyan-300">
            {multiLabel || fixture.name}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
            {fixture.totalChannels || fixture.total_channels} ch · U{fixture.universe}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={blackout}
            className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
            title="Noir total"
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenInspector}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-[10px] font-black text-slate-300 hover:bg-white/5"
            title="Ouvrir l'inspecteur complet"
          >
            <Expand className="h-3 w-3" />
            Détail
          </button>
        </div>
      </div>

      {/* XY Pad — only for moving fixtures */}
      {hasMovement && panCh && tiltCh && (
        <div className="flex shrink-0 flex-col items-center gap-1">
          <XYPad
            panValue={getAggregatedValue(panCh, "pan")}
            tiltValue={getAggregatedValue(tiltCh, "tilt")}
            onPanChange={(v) => sendChannel("pan", v)}
            onTiltChange={(v) => sendChannel("tilt", v)}
            onPanFineChange={panFineCh ? (v) => sendChannel("pan_fine", v) : undefined}
            onTiltFineChange={tiltFineCh ? (v) => sendChannel("tilt_fine", v) : undefined}
            universe={Number(fixture.universe || 1)}
            panChannel={absChannel(fixture, panCh)}
            tiltChannel={absChannel(fixture, tiltCh)}
            size={96}
            showLabels={false}
          />
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <span>P <b className={isMixed("pan") ? "text-amber-400" : "text-cyan-300"}>{isMixed("pan") ? "—" : getAggregatedValue(panCh, "pan")}</b></span>
            <button
              type="button"
              onClick={() => { sendChannel("pan", 127); sendChannel("tilt", 127); }}
              className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/5"
            >
              <Crosshair className="inline h-2.5 w-2.5" />
            </button>
            <span>T <b className={isMixed("tilt") ? "text-amber-400" : "text-cyan-300"}>{isMixed("tilt") ? "—" : getAggregatedValue(tiltCh, "tilt")}</b></span>
          </div>
        </div>
      )}

      {/* Intensity */}
      {dimmerCh && (
        <div className="flex w-[110px] shrink-0 flex-col justify-center gap-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-black uppercase tracking-widest">Intensité</span>
            {isMixed("dimmer") ? (
              <span className="font-mono text-amber-400" title="Valeurs différentes selon les fixtures">MIXTE</span>
            ) : (
              <span className="font-mono text-cyan-300">{getAggregatedValue(dimmerCh, "dimmer")}</span>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={getAggregatedValue(dimmerCh, "dimmer")}
            onChange={(e) => sendChannel(dimmerCh.type, Number(e.target.value))}
            className={`w-full cursor-pointer accent-cyan-400 ${isMixed("dimmer") ? "opacity-50" : ""}`}
            aria-label="Intensité"
          />
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>0</span>
            <span>255</span>
          </div>
        </div>
      )}

      {/* Color presets */}
      {hasColor && (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Couleur</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {redCh && greenCh && blueCh
              ? COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => sendRgb(preset.r, preset.g, preset.b, preset.w)}
                    className="group flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/25 px-1 py-2 text-[9px] font-bold text-slate-400 transition-all hover:border-white/25 hover:text-white"
                    title={preset.name}
                  >
                    <span
                      className="block h-4 w-4 rounded-full border border-white/10 shadow-md"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="hidden sm:block">{preset.name}</span>
                  </button>
                ))
              : colorWheelCh
                ? COLOR_WHEEL_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => sendChannel(colorWheelCh.type, preset.value)}
                      className="group flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/25 px-1 py-2 text-[9px] font-bold text-slate-400 transition-all hover:border-white/25 hover:text-white"
                      title={preset.name}
                    >
                      <span
                        className="block h-4 w-4 rounded-full border border-white/10 shadow-md"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span className="hidden sm:block">{preset.name}</span>
                    </button>
                  ))
                : null}
          </div>
        </div>
      )}
    </div>
  );
}

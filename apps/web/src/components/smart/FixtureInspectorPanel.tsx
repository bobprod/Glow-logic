"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Crosshair, Music2, PenLine, Power } from "lucide-react";
import XYPad from "../widgets/XYPad";
import ColorPicker from "../widgets/ColorPicker";
import TrajectoryEditor from "./TrajectoryEditor";
import useStore from "../../store/useStore";
import { dmxEngine } from "../../lib/dmxEngine";
import { simplifyKeyframes, type KeyframePoint } from "../../lib/simplifyKeyframes";
import { socket } from "../../lib/socket";
import type { DmxChannel, PatchedFixture } from "../../types/dmx";

type LayoutMode = "sidebar" | "page";

interface FixtureInspectorPanelProps {
  fixtureId: string;
  layout: LayoutMode;
}

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

const GOBO_PRESETS = [
  { name: "Ouvert", value: 5 },
  { name: "Gobo 1", value: 15 },
  { name: "Gobo 2", value: 25 },
  { name: "Gobo 3", value: 35 },
  { name: "Gobo 4", value: 45 },
  { name: "Gobo 5", value: 55 },
];

const PRISM_PRESETS = [
  { name: "Off", value: 0 },
  { name: "Statique", value: 142 },
  { name: "Rotation", value: 200 },
];

function channelRange(channel: DmxChannel) {
  return {
    min: Number(channel.minValue ?? channel.minVal ?? channel.min ?? 0),
    max: Number(channel.maxValue ?? channel.maxVal ?? channel.max ?? 255),
  };
}

function absChannel(fixture: PatchedFixture, channel: DmxChannel) {
  return Number(fixture.startAddress || fixture.start_address || 1) + Number(channel.channel || 1) - 1;
}

function findChannel(fixture: PatchedFixture, types: string[]) {
  return fixture.channels.find((channel) => types.includes(channel.type));
}

function controlId(fixtureId: string, target: "pan" | "tilt" | "dimmer") {
  return `fixture_${fixtureId}_${target}`;
}

export function findFixtureControlChannel(
  fixtures: PatchedFixture[],
  fixtureId: string,
  target: "pan" | "tilt" | "dimmer",
) {
  const fixture = fixtures.find((candidate) => candidate.nodeId === fixtureId);
  if (!fixture) return null;
  const channel = target === "dimmer"
    ? findChannel(fixture, ["dimmer", "intensity"])
    : findChannel(fixture, [target]);
  if (!channel) return null;
  return {
    fixture,
    channel,
    universe: Number(fixture.universe || 1),
    absoluteChannel: absChannel(fixture, channel),
  };
}

export default function FixtureInspectorPanel({ fixtureId, layout }: FixtureInspectorPanelProps) {
  const {
    fixtures,
    fetchFixtures,
    selectedFixtureIds,
    midiLearnMode,
    midiLearnActiveControl,
    setMidiLearnActiveControl,
    midiMappings,
    removeMidiMapping,
    automationRecArmed,
    recTargetFixtureId,
    setAutomationRecArmed,
    setTimelinePlaybackState,
    getOrCreateAutomationTrack,
    recordKeyframeBatch,
    addToast,
  } = useStore();
  const recBuffersRef = useRef({
    recording: false,
    pan: [] as KeyframePoint[],
    tilt: [] as KeyframePoint[],
    fromMs: 0,
    toMs: 0,
    lastSampleAt: 0,
  });
  const [values, setValues] = useState<Record<string, number>>({});
  const [trajectoryOpen, setTrajectoryOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    gobos: layout === "page",
    optics: layout === "page",
    beam: layout === "page",
  });

  useEffect(() => {
    if (fixtures.length === 0) void fetchFixtures();
  }, [fetchFixtures, fixtures.length]);

  const fixture = fixtures.find((candidate) => candidate.nodeId === fixtureId) || null;
  const fixtureKey = fixture?.nodeId || fixtureId;
  const targets = useMemo(() => {
    if (!fixture) return [];
    const ids = selectedFixtureIds.length > 1 ? selectedFixtureIds : [fixture.nodeId || fixtureId];
    return fixtures.filter((candidate) => candidate.nodeId && ids.includes(candidate.nodeId));
  }, [fixture, fixtureId, fixtures, selectedFixtureIds]);

  useEffect(() => {
    if (!fixture) return;
    const initial: Record<string, number> = {};
    targets.forEach((target) => {
      target.channels.forEach((channel) => {
        initial[`${target.nodeId}-${channel.channel}`] = dmxEngine.getChannel(Number(target.universe || 1), absChannel(target, channel));
      });
    });
    setValues(initial);

    const onDmxSync = (data: { universe: number; channel: number; value: number }) => {
      targets.forEach((target) => {
        const localChannel = data.channel - Number(target.startAddress || target.start_address || 1) + 1;
        if (data.universe === Number(target.universe || 1) && localChannel >= 1 && localChannel <= Number(target.totalChannels || target.total_channels || 0)) {
          setValues((previous) => ({ ...previous, [`${target.nodeId}-${localChannel}`]: data.value }));
        }
      });
    };

    socket.on("dmx_sync", onDmxSync);
    return () => {
      socket.off("dmx_sync", onDmxSync);
    };
  }, [fixture, targets]);

  useEffect(() => {
    if (!automationRecArmed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAutomationRecArmed(false, null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [automationRecArmed, setAutomationRecArmed]);

  useEffect(() => {
    return () => {
      const state = useStore.getState();
      if (state.recTargetFixtureId === fixtureKey) {
        state.setAutomationRecArmed(false, null);
      }
    };
  }, [fixtureKey]);

  if (!fixture) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/5 bg-black/25 p-4 text-center text-xs font-semibold text-slate-500">
        Aucun projecteur selectionne.
      </div>
    );
  }

  const panCh = findChannel(fixture, ["pan"]);
  const tiltCh = findChannel(fixture, ["tilt"]);
  const panFineCh = findChannel(fixture, ["pan_fine"]);
  const tiltFineCh = findChannel(fixture, ["tilt_fine"]);
  const dimmerCh = findChannel(fixture, ["dimmer", "intensity"]);
  const redCh = findChannel(fixture, ["red"]);
  const greenCh = findChannel(fixture, ["green"]);
  const blueCh = findChannel(fixture, ["blue"]);
  const whiteCh = findChannel(fixture, ["white"]);
  const amberCh = findChannel(fixture, ["amber"]);
  const uvCh = findChannel(fixture, ["uv"]);
  const colorWheelCh = findChannel(fixture, ["color_wheel", "color"]);
  const goboCh = findChannel(fixture, ["gobo"]);
  const prismCh = findChannel(fixture, ["prism"]);
  const beamChannels = fixture.channels.filter((channel) => ["strobe", "shutter", "focus", "zoom", "speed"].includes(channel.type));
  const xySize = layout === "sidebar" ? 214 : 180;
  const isSidebar = layout === "sidebar";
  const panelClass = isSidebar ? "space-y-3" : "flex h-full gap-4 overflow-x-auto custom-scrollbar";
  const canRecordMovement = isSidebar && Boolean(panCh && tiltCh);
  const recActive = canRecordMovement && automationRecArmed && recTargetFixtureId === fixtureKey;

  const getValue = (channel: DmxChannel) => values[`${fixture.nodeId}-${channel.channel}`] ?? 0;

  const readDmxValue = (channel: DmxChannel) => {
    const universe = Number(fixture.universe || 1);
    return dmxEngine.getChannel(universe, absChannel(fixture, channel));
  };

  const captureAutomationSample = (force = false) => {
    if (!recActive || !panCh || !tiltCh || !recBuffersRef.current.recording) return;
    const now = Date.now();
    if (!force && recBuffersRef.current.pan.length > 0 && now - recBuffersRef.current.lastSampleAt < 50) return;
    const playhead = Math.max(0, Math.round(useStore.getState().playheadMs));
    const panValue = readDmxValue(panCh);
    const tiltValue = readDmxValue(tiltCh);
    recBuffersRef.current.pan.push({ timeMs: playhead, value: panValue });
    recBuffersRef.current.tilt.push({ timeMs: playhead, value: tiltValue });
    recBuffersRef.current.toMs = playhead;
    recBuffersRef.current.lastSampleAt = now;
  };

  const startAutomationRecording = () => {
    if (!recActive || !panCh || !tiltCh) return;
    const state = useStore.getState();
    const playhead = Math.max(0, Math.round(state.playheadMs));
    recBuffersRef.current = {
      recording: true,
      pan: [],
      tilt: [],
      fromMs: playhead,
      toMs: playhead,
      lastSampleAt: 0,
    };
    if (!state.timelinePlaying) {
      setTimelinePlaybackState(true, playhead);
    }
    captureAutomationSample(true);
  };

  const finishAutomationRecording = () => {
    if (!recBuffersRef.current.recording || !panCh || !tiltCh) return;
    captureAutomationSample(true);
    const buffers = recBuffersRef.current;
    recBuffersRef.current = { ...buffers, recording: false };

    const panKeyframes = simplifyKeyframes(buffers.pan, 2);
    const tiltKeyframes = simplifyKeyframes(buffers.tilt, 2);
    const fromMs = Math.min(buffers.fromMs, buffers.toMs);
    const toMs = Math.max(buffers.fromMs, buffers.toMs);
    const universe = Number(fixture.universe || 1);
    const panTrackId = getOrCreateAutomationTrack(fixtureKey, "pan", {
      label: `${fixture.name} Pan`,
      universe,
      channel: absChannel(fixture, panCh),
      color: "#ef4444",
    });
    const tiltTrackId = getOrCreateAutomationTrack(fixtureKey, "tilt", {
      label: `${fixture.name} Tilt`,
      universe,
      channel: absChannel(fixture, tiltCh),
      color: "#fb7185",
    });
    recordKeyframeBatch(panTrackId, panKeyframes, { fromMs, toMs });
    recordKeyframeBatch(tiltTrackId, tiltKeyframes, { fromMs, toMs });

    dmxEngine.setChannel(universe, absChannel(fixture, panCh), readDmxValue(panCh), { source: "manual", lockMs: 0 });
    dmxEngine.setChannel(universe, absChannel(fixture, tiltCh), readDmxValue(tiltCh), { source: "manual", lockMs: 0 });
    addToast({
      type: "success",
      message: "Automation REC enregistree",
      detail: `${panKeyframes.length + tiltKeyframes.length} keyframes Pan/Tilt`,
    });
  };

  const sendChannel = (channelType: string, value: number) => {
    targets.forEach((target) => {
      const channel = target.channels.find((candidate) => candidate.type === channelType || (channelType === "dimmer" && candidate.type === "intensity"));
      if (!channel) return;
      dmxEngine.setChannel(Number(target.universe || 1), absChannel(target, channel), value, { source: "manual" });
      setValues((previous) => ({ ...previous, [`${target.nodeId}-${channel.channel}`]: value }));
    });
  };

  const sendColor = (red: number, green: number, blue: number, white?: number, amber?: number, uv?: number) => {
    const entries: Array<[string, number | undefined]> = [
      ["red", red],
      ["green", green],
      ["blue", blue],
      ["white", white],
      ["amber", amber],
      ["uv", uv],
    ];
    entries.forEach(([type, value]) => {
      if (value !== undefined) sendChannel(type, value);
    });
  };

  const blackout = () => {
    ["dimmer", "intensity", "red", "green", "blue", "white", "amber", "uv"].forEach((type) => sendChannel(type, 0));
  };

  return (
    <div className={panelClass}>
      <section className={isSidebar ? "rounded-xl border border-white/5 bg-black/25 p-3" : "w-[260px] shrink-0 rounded-xl border border-white/5 bg-[#12141A] p-3"}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-widest text-white">{fixture.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
              {targets.length > 1 ? `${targets.length} projecteurs` : `${fixture.totalChannels || fixture.total_channels} canaux`}
            </p>
          </div>
          <button onClick={blackout} className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20" title="Noir total">
            <Power className="h-4 w-4" />
          </button>
        </div>

        {panCh && tiltCh ? (
          <>
            <div
              className={`rounded-xl transition-all ${recActive ? "ring-2 ring-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.2)]" : ""}`}
              onPointerDown={startAutomationRecording}
              onPointerMove={() => captureAutomationSample()}
              onPointerUp={finishAutomationRecording}
              onPointerCancel={finishAutomationRecording}
            >
              <XYPad
                panValue={getValue(panCh)}
                tiltValue={getValue(tiltCh)}
                onPanChange={(value) => sendChannel("pan", value)}
                onTiltChange={(value) => sendChannel("tilt", value)}
                onPanFineChange={panFineCh ? (value) => sendChannel("pan_fine", value) : undefined}
                onTiltFineChange={tiltFineCh ? (value) => sendChannel("tilt_fine", value) : undefined}
                universe={Number(fixture.universe || 1)}
                panChannel={absChannel(fixture, panCh)}
                tiltChannel={absChannel(fixture, tiltCh)}
                size={xySize}
                showLabels={false}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <span>Pan <b className="text-cyan-300">{getValue(panCh)}</b></span>
              <span>Tilt <b className="text-cyan-300">{getValue(tiltCh)}</b></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <MidiTarget fixtureId={fixture.nodeId || fixtureId} target="pan" label="P" />
              <MidiTarget fixtureId={fixture.nodeId || fixtureId} target="tilt" label="T" />
              {isSidebar && (
                <button
                  type="button"
                  onClick={() => setAutomationRecArmed(!recActive, recActive ? null : fixtureKey)}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-black transition-all ${
                    recActive
                      ? "border-red-400 bg-red-500/20 text-red-200 animate-pulse"
                      : "border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  }`}
                  title="Armer l'enregistrement automation Pan/Tilt"
                >
                  REC
                </button>
              )}
              <button onClick={() => { sendChannel("pan", 127); sendChannel("tilt", 127); }} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-[10px] font-black text-slate-300 hover:bg-white/5">
                <Crosshair className="mr-1 inline h-3 w-3" />
                Centrer
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTrajectoryOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20"
            >
              <PenLine className="h-3.5 w-3.5" />
              Trajectoire
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold text-slate-500">
            Mouvement X/Y indisponible pour ce projecteur.
          </div>
        )}

        {dimmerCh && (
          <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Intensite</span>
              <MidiTarget fixtureId={fixture.nodeId || fixtureId} target="dimmer" label="I" />
            </div>
            <input
              type="range"
              min={channelRange(dimmerCh).min}
              max={channelRange(dimmerCh).max}
              value={getValue(dimmerCh)}
              onChange={(event) => sendChannel(dimmerCh.type, Number(event.target.value))}
              className="w-full accent-cyan-400"
              aria-label="Intensite projecteur"
            />
          </div>
        )}
      </section>

      {(redCh && greenCh && blueCh) || colorWheelCh ? (
        <section className={isSidebar ? "rounded-xl border border-white/5 bg-black/25 p-3" : "w-[320px] shrink-0 rounded-xl border border-white/5 bg-[#12141A] p-3"}>
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Couleur</p>
          {redCh && greenCh && blueCh && (
            <ColorPicker
              compact={isSidebar}
              red={getValue(redCh)}
              green={getValue(greenCh)}
              blue={getValue(blueCh)}
              onRedChange={(value) => sendColor(value, getValue(greenCh), getValue(blueCh))}
              onGreenChange={(value) => sendColor(getValue(redCh), value, getValue(blueCh))}
              onBlueChange={(value) => sendColor(getValue(redCh), getValue(greenCh), value)}
              white={whiteCh ? getValue(whiteCh) : undefined}
              onWhiteChange={whiteCh ? (value) => sendChannel("white", value) : undefined}
              amber={amberCh ? getValue(amberCh) : undefined}
              onAmberChange={amberCh ? (value) => sendChannel("amber", value) : undefined}
              uv={uvCh ? getValue(uvCh) : undefined}
              onUvChange={uvCh ? (value) => sendChannel("uv", value) : undefined}
            />
          )}
          {colorWheelCh && (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {COLOR_WHEEL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => sendChannel(colorWheelCh.type, preset.value)}
                  className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-[9px] font-bold text-slate-300 hover:border-cyan-500/30"
                >
                  <span className="mx-auto mb-1 block h-3 w-3 rounded-full" style={{ backgroundColor: preset.color }} />
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <Accordion title="Gobos" open={openSections.gobos} onToggle={() => setOpenSections((state) => ({ ...state, gobos: !state.gobos }))} sidebar={isSidebar}>
        {goboCh ? (
          <div className="grid grid-cols-3 gap-1.5">
            {GOBO_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => sendChannel(goboCh.type, preset.value)} className="rounded-lg border border-white/10 bg-black/30 py-2 text-[10px] font-bold text-slate-300 hover:border-purple-500/40">
                {preset.name}
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">Aucun gobo detecte.</p>}
      </Accordion>

      <Accordion title="Prisme & optiques" open={openSections.optics} onToggle={() => setOpenSections((state) => ({ ...state, optics: !state.optics }))} sidebar={isSidebar}>
        {prismCh && (
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {PRISM_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => sendChannel(prismCh.type, preset.value)} className="rounded-lg border border-white/10 bg-black/30 py-2 text-[10px] font-bold text-slate-300 hover:border-teal-500/40">
                {preset.name}
              </button>
            ))}
          </div>
        )}
        {beamChannels.filter((channel) => ["focus", "zoom"].includes(channel.type)).map((channel) => (
          <ChannelSlider key={channel.channel} channel={channel} value={getValue(channel)} onChange={(value) => sendChannel(channel.type, value)} />
        ))}
      </Accordion>

      <Accordion title="Beam & strobe" open={openSections.beam} onToggle={() => setOpenSections((state) => ({ ...state, beam: !state.beam }))} sidebar={isSidebar}>
        {beamChannels.filter((channel) => ["strobe", "shutter", "speed"].includes(channel.type)).map((channel) => (
          <ChannelSlider key={channel.channel} channel={channel} value={getValue(channel)} onChange={(value) => sendChannel(channel.type, value)} />
        ))}
        {beamChannels.length === 0 && <p className="text-xs text-slate-500">Aucun controle beam detecte.</p>}
      </Accordion>

      {midiLearnMode && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] font-semibold text-blue-200">
          Clique une pastille P, T ou I puis bouge un controle MIDI.
        </div>
      )}

      {trajectoryOpen && panCh && tiltCh && (
        <TrajectoryEditor
          fixture={fixture}
          panChannel={panCh}
          tiltChannel={tiltCh}
          panValue={getValue(panCh)}
          tiltValue={getValue(tiltCh)}
          onClose={() => setTrajectoryOpen(false)}
        />
      )}
    </div>
  );

  function MidiTarget({ fixtureId, target, label }: { fixtureId: string; target: "pan" | "tilt" | "dimmer"; label: string }) {
    const id = controlId(fixtureId, target);
    const mapping = midiMappings[id];
    const learning = midiLearnMode && midiLearnActiveControl === id;
    return (
      <button
        type="button"
        onClick={() => midiLearnMode && setMidiLearnActiveControl(id)}
        onContextMenu={(event) => {
          event.preventDefault();
          if (mapping) removeMidiMapping(id);
        }}
        title={mapping ? `CC ${mapping.data1} - canal ${mapping.channel + 1}` : "Cible MIDI Learn"}
        className={`rounded-full border px-2 py-1 text-[9px] font-black transition-all ${
          learning
            ? "border-blue-400 bg-blue-500/20 text-blue-200 animate-pulse"
            : mapping
              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
              : "border-white/10 bg-black/30 text-slate-500"
        }`}
      >
        {label} {mapping && <Music2 className="ml-1 inline h-3 w-3" />}
      </button>
    );
  }
}

function ChannelSlider({ channel, value, onChange }: { channel: DmxChannel; value: number; onChange: (value: number) => void }) {
  const range = channelRange(channel);
  return (
    <div className="mb-2 rounded-lg border border-white/5 bg-black/25 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-bold capitalize text-slate-400">{channel.name || channel.function || channel.type}</span>
        <span className="font-mono text-cyan-300">{value}</span>
      </div>
      <input type="range" min={range.min} max={range.max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-cyan-400" />
    </div>
  );
}

function Accordion({ title, open, onToggle, sidebar, children }: { title: string; open: boolean; onToggle: () => void; sidebar: boolean; children: React.ReactNode }) {
  return (
    <section className={sidebar ? "rounded-xl border border-white/5 bg-black/25" : "w-[240px] shrink-0 rounded-xl border border-white/5 bg-[#12141A]"}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/5 p-3">{children}</div>}
    </section>
  );
}

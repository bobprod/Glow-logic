"use client";

import React, { useState, useEffect } from "react";
import { dmxEngine } from "@/lib/dmxEngine";
import { API_BASE } from "@/lib/config";
import { EasingType } from "@/lib/DmxFader";
import { Zap, Lightbulb, ChevronDown, Power, Flashlight, RefreshCw, Timer } from "lucide-react";
import { socket } from "@/lib/socket";
import XYPad from "./widgets/XYPad";
import ColorPicker from "./widgets/ColorPicker";
import useStore from "@/store/useStore";

// Types de canaux DMX supportés
interface DmxChannel {
  channel: number;
  function: string;
  type: string;
  minValue: number;
  maxValue: number;
}

interface Fixture {
  id: number;
  name: string;
  manufacturer?: string;
  total_channels: number;
  start_address: number;
  channels: DmxChannel[];
}

interface PatchedFixture {
  nodeId: string;
  name: string;
  universe: number;
  startAddress: number;
  totalChannels: number;
  channels: DmxChannel[];
  color: string;
}

// Mapping des types de canaux vers des groupes de contrôle
const CHANNEL_GROUPS: Record<string, { label: string; icon: string; color: string }> = {
  dimmer: { label: "Dimmer", icon: "💡", color: "#fbbf24" },
  red: { label: "Rouge", icon: "🔴", color: "#ef4444" },
  green: { label: "Vert", icon: "🟢", color: "#22c55e" },
  blue: { label: "Bleu", icon: "🔵", color: "#3b82f6" },
  white: { label: "Blanc", icon: "⚪", color: "#f8fafc" },
  amber: { label: "Ambre", icon: "🟠", color: "#f97316" },
  uv: { label: "UV", icon: "🟣", color: "#a855f7" },
  pan: { label: "Pan", icon: "↔️", color: "#06b6d4" },
  tilt: { label: "Tilt", icon: "↕️", color: "#06b6d4" },
  pan_fine: { label: "Pan Fine", icon: "↔️", color: "#0891b2" },
  tilt_fine: { label: "Tilt Fine", icon: "↕️", color: "#0891b2" },
  strobe: { label: "Strobe", icon: "⚡", color: "#eab308" },
  color_wheel: { label: "Couleur", icon: "🎨", color: "#ec4899" },
  gobo: { label: "Gobo", icon: "⭕", color: "#8b5cf6" },
  gobo_rotation: { label: "Gobo Rot", icon: "🔄", color: "#7c3aed" },
  prism: { label: "Prisme", icon: "💎", color: "#14b8a6" },
  focus: { label: "Focus", icon: "🔍", color: "#64748b" },
  zoom: { label: "Zoom", icon: "🔎", color: "#475569" },
  shutter: { label: "Shutter", icon: "📷", color: "#94a3b8" },
  speed: { label: "Speed", icon: "🏎️", color: "#f59e0b" },
  macro: { label: "Macro", icon: "🔮", color: "#d946ef" },
  reset: { label: "Reset", icon: "🔄", color: "#ef4444" },
  mode: { label: "Mode", icon: "⚙️", color: "#64748b" },
};
const getChannelGroupMeta = (type: string) => CHANNEL_GROUPS[type] ?? CHANNEL_GROUPS.mode;

// Standard presets for gobo, color_wheel, prism
const GOBO_PRESETS = [
  { name: "Open", value: 5, icon: "○" },
  { name: "Gobo 1", value: 15, icon: "◉" },
  { name: "Gobo 2", value: 25, icon: "◎" },
  { name: "Gobo 3", value: 35, icon: "◈" },
  { name: "Gobo 4", value: 45, icon: "◐" },
  { name: "Gobo 5", value: 55, icon: "◑" },
  { name: "Gobo 6", value: 65, icon: "◒" },
  { name: "Gobo 7", value: 75, icon: "◓" },
];

const COLOR_WHEEL_PRESETS = [
  { name: "Blanc", value: 5, color: "#ffffff" },
  { name: "Rouge", value: 80, color: "#ff0000" },
  { name: "Orange", value: 140, color: "#ff6600" },
  { name: "Jaune", value: 20, color: "#ffcc00" },
  { name: "Vert", value: 120, color: "#00cc00" },
  { name: "Cyan", value: 60, color: "#00ffcc" },
  { name: "Bleu", value: 40, color: "#0044ff" },
  { name: "Magenta", value: 150, color: "#ff00ff" },
  { name: "Rotation", value: 200, color: "#cccccc" },
];

const PRISM_PRESETS = [
  { name: "Off", value: 0 },
  { name: "Statique", value: 142 },
  { name: "Rotation", value: 200 },
];

// Détection du type de fixture
function detectFixtureType(channels: DmxChannel[]): string {
  const types = channels.map((c) => c.type);
  if (types.includes("pan") && types.includes("tilt")) return "moving_head";
  if (types.includes("red") && types.includes("green") && types.includes("blue")) return "par_led";
  if (types.includes("dimmer") && channels.length <= 4) return "par_led";
  if (types.includes("gobo") || types.includes("prism")) return "beam";
  if (types.includes("strobe") && !types.includes("pan")) return "strobe";
  return "generic";
}

function getFixtureIcon(type: string): string {
  const icons: Record<string, string> = {
    moving_head: "🎯",
    par_led: "💡",
    beam: "🔦",
    strobe: "⚡",
    laser: "🟥",
    generic: "🔌",
  };
  return icons[type] || "🔌";
}

interface FixtureControllerProps {
  className?: string;
  isSidebar?: boolean;
}

export default function FixtureController({ className = "" }: FixtureControllerProps) {
  const {
    selectedFixtureId,
    setSelectedFixtureId,
    selectedFixtureIds,
  } = useStore();

  const [fixtures, setFixtures] = useState<PatchedFixture[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [showSelector, setShowSelector] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [globalFadeMs, setGlobalFadeMs] = useState(0);
  const [globalEasing] = useState<EasingType>("sCurve");
  const [showFadePanel, setShowFadePanel] = useState(false);

  // Load patched fixtures from API
  useEffect(() => {
    const loadFixtures = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fixtures`);
        if (!res.ok) return;
        const data: Fixture[] = await res.json();
        
        const patched: PatchedFixture[] = data.map((f) => ({
          nodeId: `fixture-${f.id}`,
          name: f.name,
          universe: 1,
          startAddress: f.start_address || 1,
          totalChannels: f.total_channels,
          channels: f.channels || [],
          color: "#06b6d4",
        }));
        
        setFixtures(patched);
        if (patched.length > 0 && !selectedFixtureId) {
          setSelectedFixtureId(patched[0].nodeId);
        }
      } catch (err) {
        console.error("[FixtureController] Failed to load fixtures:", err);
      }
    };
    loadFixtures();
  }, [selectedFixtureId, setSelectedFixtureId]);

  const selectedFixture = fixtures.find(f => f.nodeId === selectedFixtureId) || null;

  // Sync with DMX Engine and socket in real-time
  useEffect(() => {
    if (!selectedFixture) return;

    // Load initial values from dmxEngine
    const initialValues: Record<string, number> = {};
    selectedFixture.channels.forEach((ch) => {
      const absCh = selectedFixture.startAddress + ch.channel - 1;
      initialValues[`${selectedFixture.nodeId}-${ch.channel}`] = dmxEngine.getChannel(selectedFixture.universe, absCh);
    });
    setValues(initialValues);

    const onDmxSync = (data: { universe: number; channel: number; value: number }) => {
      const localCh = data.channel - selectedFixture.startAddress + 1;
      if (
        data.universe === selectedFixture.universe &&
        localCh >= 1 &&
        localCh <= selectedFixture.totalChannels
      ) {
        setValues((prev) => ({
          ...prev,
          [`${selectedFixture.nodeId}-${localCh}`]: data.value,
        }));
      }
    };

    socket.on("dmx_sync", onDmxSync);
    return () => {
      socket.off("dmx_sync", onDmxSync);
    };
  }, [selectedFixture]);

  if (fixtures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-500 h-full w-full font-mono text-xs p-5 select-none bg-[#090b0e]">
        <p className="text-sm">Aucune fixture dans la bibliothèque.</p>
        <p className="text-slate-600 text-[10px] mt-1">Créez ou patchez une fixture pour commencer.</p>
      </div>
    );
  }

  if (!selectedFixture) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-500 h-full w-full gap-2 font-mono text-xs p-5 select-none bg-[#090b0e]">
        <Zap className="w-5 h-5 text-slate-600 animate-pulse" />
        <p>Sélectionnez un projecteur pour le contrôler</p>
      </div>
    );
  }

  const fixture = selectedFixture;
  const fixtureType = detectFixtureType(fixture.channels);

  // Group channels by category
  const panCh = fixture.channels.find((c) => c.type === "pan");
  const tiltCh = fixture.channels.find((c) => c.type === "tilt");
  const panFineCh = fixture.channels.find((c) => c.type === "pan_fine");
  const tiltFineCh = fixture.channels.find((c) => c.type === "tilt_fine");
  const hasXYPad = panCh && tiltCh;

  const redCh = fixture.channels.find((c) => c.type === "red");
  const greenCh = fixture.channels.find((c) => c.type === "green");
  const blueCh = fixture.channels.find((c) => c.type === "blue");
  const whiteCh = fixture.channels.find((c) => c.type === "white");
  const amberCh = fixture.channels.find((c) => c.type === "amber");
  const uvCh = fixture.channels.find((c) => c.type === "uv");
  const hasColorPicker = redCh && greenCh && blueCh;

  const colorWheelCh = fixture.channels.find((c) => c.type === "color_wheel");
  const goboCh = fixture.channels.find((c) => c.type === "gobo");
  const prismCh = fixture.channels.find((c) => c.type === "prism");
  const goboRotCh = fixture.channels.find((c) => c.type === "gobo_rotation");

  const beamChannels = fixture.channels.filter((c) => ["dimmer", "strobe", "shutter"].includes(c.type));
  const effectChannels = fixture.channels.filter((c) => ["focus", "zoom", "speed"].includes(c.type));
  const otherChannels = fixture.channels.filter((c) =>
    ![
      "pan", "tilt", "pan_fine", "tilt_fine",
      "red", "green", "blue", "white", "amber", "uv",
      "dimmer", "strobe", "shutter",
      "gobo", "gobo_rotation", "prism", "color_wheel",
      "focus", "zoom", "speed", "macro",
    ].includes(c.type)
  );

  const getVal = (ch: DmxChannel): number => {
    return values[`${fixture.nodeId}-${ch.channel}`] ?? 0;
  };

  // Broadcast DMX changes to all selected fixtures (Batch / Group Control)
  const sendChannelMulti = (channelType: string, val: number) => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : [fixture.nodeId];
    const targets = fixtures.filter(f => targetIds.includes(f.nodeId));

    targets.forEach((f) => {
      const ch = f.channels.find(c => c.type === channelType);
      if (!ch) return;
      const absCh = f.startAddress + ch.channel - 1;
      if (globalFadeMs > 0) {
        dmxEngine.fadeTo(f.universe, absCh, val, globalFadeMs, globalEasing);
      } else {
        dmxEngine.setChannel(f.universe, absCh, val);
      }
      setValues((prev) => ({ ...prev, [`${f.nodeId}-${ch.channel}`]: val }));
    });
  };

  const sendXYMulti = (panVal: number, tiltVal: number) => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : [fixture.nodeId];
    const targets = fixtures.filter(f => targetIds.includes(f.nodeId));

    targets.forEach((f) => {
      const panC = f.channels.find(c => c.type === "pan");
      const tiltC = f.channels.find(c => c.type === "tilt");
      if (panC) {
        dmxEngine.setChannel(f.universe, f.startAddress + panC.channel - 1, panVal);
        setValues((prev) => ({ ...prev, [`${f.nodeId}-${panC.channel}`]: panVal }));
      }
      if (tiltC) {
        dmxEngine.setChannel(f.universe, f.startAddress + tiltC.channel - 1, tiltVal);
        setValues((prev) => ({ ...prev, [`${f.nodeId}-${tiltC.channel}`]: tiltVal }));
      }
    });
  };

  const sendRGBWAMulti = (r: number, g: number, b: number, w?: number, a?: number, uv?: number) => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : [fixture.nodeId];
    const targets = fixtures.filter(f => targetIds.includes(f.nodeId));

    targets.forEach((f) => {
      const rC = f.channels.find(c => c.type === "red");
      const gC = f.channels.find(c => c.type === "green");
      const bC = f.channels.find(c => c.type === "blue");
      const wC = f.channels.find(c => c.type === "white");
      const aC = f.channels.find(c => c.type === "amber");
      const uvC = f.channels.find(c => c.type === "uv");

      if (rC) {
        dmxEngine.setChannel(f.universe, f.startAddress + rC.channel - 1, r);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${rC.channel}`]: r }));
      }
      if (gC) {
        dmxEngine.setChannel(f.universe, f.startAddress + gC.channel - 1, g);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${gC.channel}`]: g }));
      }
      if (bC) {
        dmxEngine.setChannel(f.universe, f.startAddress + bC.channel - 1, b);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${bC.channel}`]: b }));
      }
      if (wC && w !== undefined) {
        dmxEngine.setChannel(f.universe, f.startAddress + wC.channel - 1, w);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${wC.channel}`]: w }));
      }
      if (aC && a !== undefined) {
        dmxEngine.setChannel(f.universe, f.startAddress + aC.channel - 1, a);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${aC.channel}`]: a }));
      }
      if (uvC && uv !== undefined) {
        dmxEngine.setChannel(f.universe, f.startAddress + uvC.channel - 1, uv);
        setValues(prev => ({ ...prev, [`${f.nodeId}-${uvC.channel}`]: uv }));
      }
    });
  };

  const sendMasterMulti = (val: number) => {
    sendChannelMulti("dimmer", val);
    sendChannelMulti("intensity", val);
  };

  const blackoutMulti = () => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : [fixture.nodeId];
    const targets = fixtures.filter(f => targetIds.includes(f.nodeId));

    targets.forEach((f) => {
      f.channels.forEach((ch) => {
        if (["dimmer", "red", "green", "blue", "white", "amber", "uv"].includes(ch.type)) {
          dmxEngine.setChannel(f.universe, f.startAddress + ch.channel - 1, 0);
          setValues((prev) => ({ ...prev, [`${f.nodeId}-${ch.channel}`]: 0 }));
        }
      });
    });
  };

  const fullOnMulti = () => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : [fixture.nodeId];
    const targets = fixtures.filter(f => targetIds.includes(f.nodeId));

    targets.forEach((f) => {
      f.channels.forEach((ch) => {
        if (ch.type === "dimmer") {
          dmxEngine.setChannel(f.universe, f.startAddress + ch.channel - 1, 255);
          setValues((prev) => ({ ...prev, [`${f.nodeId}-${ch.channel}`]: 255 }));
        }
        if (["red", "green", "blue", "white", "amber", "uv"].includes(ch.type)) {
          dmxEngine.setChannel(f.universe, f.startAddress + ch.channel - 1, 255);
          setValues((prev) => ({ ...prev, [`${f.nodeId}-${ch.channel}`]: 255 }));
        }
      });
    });
  };

  const testFlash = (f: PatchedFixture) => {
    setIsFlashing(true);
    const dimmer = f.channels.find(c => c.type === "dimmer" || c.type === "intensity");
    if (dimmer) dmxEngine.flash(f.universe, f.startAddress + dimmer.channel - 1, 255, 800);
    const strobe = f.channels.find(c => c.type === "strobe");
    if (strobe) dmxEngine.flash(f.universe, f.startAddress + strobe.channel - 1, 200, 600);
    const colors = f.channels.filter(c => ["red", "green", "blue"].includes(c.type));
    colors.forEach(c => dmxEngine.flash(f.universe, f.startAddress + c.channel - 1, 255, 800));
    setTimeout(() => setIsFlashing(false), 900);
  };

  const restartEngine = () => {
    dmxEngine.forceAll();
    if (!dmxEngine.isRunning()) dmxEngine.start();
  };

  return (
    <div className={`flex flex-row items-stretch gap-4 p-4 overflow-x-auto w-full h-full text-slate-300 custom-scrollbar select-none bg-[#090b0e] border border-white/5 ${className}`}>
      
      {/* 1. Device: Fixture Selector & Global Actions */}
      <div className="w-[230px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-full relative z-30">
        <div className="space-y-2">
          {/* Dropdown selector */}
          <div className="relative">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold text-xs hover:border-cyan-500/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span className="text-sm shrink-0">{getFixtureIcon(fixtureType)}</span>
                <span className="truncate">{fixture.name}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>
            {showSelector && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1c23] border border-[#262c36] rounded-xl shadow-2xl z-50 py-2 max-h-48 overflow-y-auto custom-scrollbar">
                {fixtures.map((f) => {
                  const type = detectFixtureType(f.channels);
                  return (
                    <button
                      key={f.nodeId}
                      onClick={() => {
                        setSelectedFixtureId(f.nodeId);
                        setShowSelector(false);
                        setValues({});
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer ${
                        f.nodeId === fixture.nodeId ? "text-cyan-400 bg-cyan-500/10" : "text-slate-300"
                      }`}
                    >
                      <span>{getFixtureIcon(type)}</span>
                      <div className="truncate">
                        <p className="font-bold truncate">{f.name}</p>
                        <p className="text-[9px] text-slate-500">
                          U{f.universe} @ Ch{f.startAddress} | {f.totalChannels}ch
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={restartEngine}
              className="p-1.5 rounded-lg bg-slate-500/5 hover:bg-slate-500/15 text-slate-400 border border-white/5 transition-all flex items-center justify-center cursor-pointer"
              title="Resync DMX Engine"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => testFlash(fixture)}
              disabled={isFlashing}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isFlashing
                  ? "bg-yellow-500/30 border-yellow-500/50 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                  : "bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-400 border-white/5"
              }`}
              title="Test Flash"
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={blackoutMulti}
              className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 text-red-400 border border-white/5 transition-all flex items-center justify-center cursor-pointer"
              title="Blackout"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fullOnMulti}
              className="p-1.5 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-400 border border-white/5 transition-all flex items-center justify-center cursor-pointer"
              title="Full On"
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transition/Fade Time */}
          <div className="relative">
            <button
              onClick={() => setShowFadePanel(!showFadePanel)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 transition-all text-[10px] text-slate-400 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span>Transition</span>
              </div>
              <span className="font-mono text-cyan-400">
                {globalFadeMs === 0 ? "Instant" : `${(globalFadeMs / 1000).toFixed(1)}s`}
              </span>
            </button>
            {showFadePanel && (
              <div className="absolute bottom-full left-0 mb-2 w-full p-2 bg-[#1a1d24] border border-[#262c36] shadow-2xl space-y-1.5 z-[100] rounded-xl">
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-1">Temps de fondu</p>
                <div className="grid grid-cols-3 gap-1">
                  {[0, 200, 500, 1000, 2000, 3000].map(ms => (
                    <button
                      key={ms}
                      onClick={() => { setGlobalFadeMs(ms); setShowFadePanel(false); }}
                      className={`py-1 rounded text-[8px] font-bold border transition-all cursor-pointer ${
                        globalFadeMs === ms
                          ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                          : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
                      }`}
                    >
                      {ms === 0 ? "0s" : `${ms / 1000}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Master Dimmer */}
        {fixture.channels.some((c) => c.type === "dimmer") && (
          <div className="bg-black/30 rounded-lg p-2 border border-white/5 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">💡 Master</span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">
                {values[`${fixture.nodeId}-${fixture.channels.find((c) => c.type === "dimmer")?.channel}`] ?? 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={values[`${fixture.nodeId}-${fixture.channels.find((c) => c.type === "dimmer")?.channel}`] ?? 0}
              onChange={(e) => sendMasterMulti(parseInt(e.target.value))}
              className="w-full h-1.5 appearance-none bg-black rounded-full border border-white/5 cursor-pointer accent-cyan-400"
            />
          </div>
        )}
      </div>

      {/* 2. Device: Position (Pan/Tilt XYPad) */}
      {hasXYPad && (
        <div className="w-[300px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex gap-3 h-full items-center">
          <div className="shrink-0">
            <XYPad
              panValue={getVal(panCh!)}
              tiltValue={getVal(tiltCh!)}
              onPanChange={(v) => sendChannelMulti("pan", v)}
              onTiltChange={(v) => sendChannelMulti("tilt", v)}
              onPanFineChange={
                panFineCh
                  ? (v) => sendChannelMulti("pan_fine", v)
                  : undefined
              }
              onTiltFineChange={
                tiltFineCh
                  ? (v) => sendChannelMulti("tilt_fine", v)
                  : undefined
              }
              universe={fixture.universe}
              panChannel={fixture.startAddress + panCh!.channel - 1}
              tiltChannel={fixture.startAddress + tiltCh!.channel - 1}
              size={120}
              showLabels={false}
            />
          </div>
          <div className="flex-1 flex flex-col justify-between h-full py-1">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">↔️ POSITION</span>
              <p className="text-[9px] text-slate-500 font-mono">
                Pan: <span className="text-cyan-400">{getVal(panCh!)}</span>
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                Tilt: <span className="text-cyan-400">{getVal(tiltCh!)}</span>
              </p>
            </div>
            
            {/* Quick center */}
            <button
              onClick={() => sendXYMulti(127, 127)}
              className="py-1 rounded bg-black/40 border border-white/10 hover:border-cyan-500/30 text-[9px] font-bold text-slate-400 hover:text-cyan-400 transition-colors uppercase cursor-pointer"
            >
              Centrer
            </button>
          </div>
        </div>
      )}

      {/* 3. Device: Color (Picker + Wheel presets) */}
      {(hasColorPicker || colorWheelCh) && (
        <div className="w-[340px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex gap-3 h-full items-center">
          {hasColorPicker && (
            <div className="shrink-0 scale-90 -ml-2">
              <ColorPicker
                red={getVal(redCh!)}
                green={getVal(greenCh!)}
                blue={getVal(blueCh!)}
                onRedChange={(v) => sendRGBWAMulti(v, getVal(greenCh!), getVal(blueCh!))}
                onGreenChange={(v) => sendRGBWAMulti(getVal(redCh!), v, getVal(blueCh!))}
                onBlueChange={(v) => sendRGBWAMulti(getVal(redCh!), getVal(greenCh!), v)}
                white={whiteCh ? getVal(whiteCh) : undefined}
                onWhiteChange={whiteCh ? (v) => sendChannelMulti("white", v) : undefined}
                amber={amberCh ? getVal(amberCh) : undefined}
                onAmberChange={amberCh ? (v) => sendChannelMulti("amber", v) : undefined}
                uv={uvCh ? getVal(uvCh) : undefined}
                onUvChange={uvCh ? (v) => sendChannelMulti("uv", v) : undefined}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col justify-between h-full py-1 min-w-0">
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">🎨 COULEUR</span>
              {colorWheelCh && (
                <div className="flex flex-wrap gap-1 max-h-[105px] overflow-y-auto custom-scrollbar pr-1">
                  {COLOR_WHEEL_PRESETS.map((preset) => {
                    const chKey = `${fixture.nodeId}-${colorWheelCh.channel}`;
                    const active = Math.abs((values[chKey] ?? 0) - preset.value) < 10;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => sendChannelMulti("color_wheel", preset.value)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all truncate flex items-center gap-1 cursor-pointer ${
                          active
                            ? "border-cyan-400 text-white bg-cyan-500/10 shadow-[0_0_8px_rgba(34,211,238,0.2)]"
                            : "border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {preset.color && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: preset.color }}
                          />
                        )}
                        <span className="truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick RGB controllers */}
            {hasColorPicker && !colorWheelCh && (
              <p className="text-[9px] text-slate-500 font-mono">
                R: <span className="text-red-400">{getVal(redCh!)}</span> ·{" "}
                G: <span className="text-green-400">{getVal(greenCh!)}</span> ·{" "}
                B: <span className="text-blue-400">{getVal(blueCh!)}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. Device: Gobo & Gobo Rotation */}
      {goboCh && (
        <div className="w-[220px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">⭕ GOBOS</span>
            <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
              {GOBO_PRESETS.map((preset) => {
                const chKey = `${fixture.nodeId}-${goboCh.channel}`;
                const active = Math.abs((values[chKey] ?? 0) - preset.value) < 10;
                return (
                  <button
                    key={preset.name}
                    onClick={() => sendChannelMulti("gobo", preset.value)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all cursor-pointer ${
                      active
                        ? "border-purple-400 text-white bg-purple-500/10 shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                        : "border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {preset.icon && <span className="mr-0.5">{preset.icon}</span>}
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {goboRotCh && (
            <div className="bg-black/20 p-1.5 rounded-lg border border-white/5 shrink-0">
              <div className="flex items-center justify-between text-[8px] mb-1">
                <span className="text-slate-500">ROTO</span>
                <span className="text-cyan-400 font-mono">{getVal(goboRotCh)}</span>
              </div>
              <input
                type="range"
                min={goboRotCh.minValue}
                max={goboRotCh.maxValue}
                value={getVal(goboRotCh)}
                onChange={(e) => sendChannelMulti("gobo_rotation", parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-black rounded-full border border-white/5 cursor-pointer accent-cyan-400"
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Device: Optics & Beam */}
      {(prismCh || effectChannels.length > 0) && (
        <div className="w-[250px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1.5">🔍 OPTIQUE & PRISME</span>
            
            {/* Prism presets */}
            {prismCh && (
              <div className="flex gap-1 mb-2">
                {PRISM_PRESETS.map((preset) => {
                  const chKey = `${fixture.nodeId}-${prismCh.channel}`;
                  const active = Math.abs((values[chKey] ?? 0) - preset.value) < 10;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => sendChannelMulti("prism", preset.value)}
                      className={`flex-1 py-1 rounded text-[8px] font-bold border transition-all cursor-pointer ${
                        active
                          ? "border-teal-400 text-white bg-teal-500/10 shadow-[0_0_8px_rgba(20,184,166,0.2)]"
                          : "border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      Prm: {preset.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zoom & Focus Sliders */}
          <div className="space-y-1 bg-black/20 p-2 rounded-lg border border-white/5">
            {fixture.channels.filter(c => ["zoom", "focus"].includes(c.type)).map((ch) => {
              const val = getVal(ch);
              return (
                <div key={ch.channel} className="flex items-center gap-2 text-[8px]">
                  <span className="text-slate-500 w-8 capitalize">{ch.type}</span>
                  <input
                    type="range"
                    min={ch.minValue}
                    max={ch.maxValue}
                    value={val}
                    onChange={(e) => sendChannelMulti(ch.type, parseInt(e.target.value))}
                    className="flex-1 h-1 appearance-none bg-black rounded-full border border-white/5 cursor-pointer accent-cyan-400"
                  />
                  <span className="text-cyan-400 font-mono w-5 text-right">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Device: Other channels */}
      {(otherChannels.length > 0 || beamChannels.filter(c => c.type !== "dimmer").length > 0) && (
        <div className="w-[200px] shrink-0 bg-[#12141a] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-full">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">⚙️ AUTRES</span>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {[...beamChannels.filter(c => c.type !== "dimmer"), ...otherChannels].slice(0, 4).map((ch) => {
              const val = getVal(ch);
              const name = ch.function || ch.type;
              const meta = getChannelGroupMeta(ch.type);
              return (
                <div key={ch.channel} className="bg-black/20 p-1 rounded border border-white/5">
                  <div className="flex items-center justify-between text-[8px] mb-0.5">
                    <span className="truncate max-w-[120px]" style={{ color: meta.color }}>{name}</span>
                    <span className="text-cyan-400 font-mono">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={ch.minValue}
                    max={ch.maxValue}
                    value={val}
                    onChange={(e) => sendChannelMulti(ch.type, parseInt(e.target.value))}
                    className="w-full h-1 appearance-none bg-black rounded-full border border-white/5 cursor-pointer accent-cyan-400"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Small details footer inside the scroll */}
      <div className="w-[140px] shrink-0 flex flex-col justify-end items-end p-2 text-[9px] text-slate-500 font-mono">
        <span className="text-right truncate w-full">{getFixtureIcon(fixtureType)} {fixtureType.toUpperCase()}</span>
        <span>U{fixture.universe} @ Ch{fixture.startAddress}</span>
        <span className="opacity-60">Total: {fixture.totalChannels}ch</span>
      </div>

    </div>
  );
}

"use client";

import React, { useState } from "react";
import { socket } from "../lib/socket";
import useStore from "../store/useStore";
import { Minus, Plus } from "lucide-react";
import { Pad } from "./widgets/Pad";
import { VerticalFader } from "./widgets/VerticalFader";
import { ControlHeader } from "./widgets/ControlHeader";

export default function LivePerformanceView() {
  const {
    smartPads,
    bpm,
    setBpm,
    midiLearnMode,
    midiLearnActiveControl,
    setMidiLearnActiveControl,
    midiMappings,
  } = useStore();
  const [crossfader, setCrossfader] = useState(50);

  const adjustBpm = (delta: number) => {
    const next = Math.max(40, Math.min(240, bpm + delta));
    setBpm(next);
    socket?.emit("osc_send", { address: "/vkb_midi/0/bpm", args: [next] });
  };

  const leftPads = smartPads.slice(0, 12);
  const rightPads = smartPads.slice(12, 24);

  const crossfaderControlId = "crossfader_main";
  const isCrossfaderLearning =
    midiLearnMode && midiLearnActiveControl === crossfaderControlId;
  const hasCrossfaderMapping = !!midiMappings[crossfaderControlId];

  const handleCrossfaderClick = () => {
    if (midiLearnMode) {
      setMidiLearnActiveControl(
        isCrossfaderLearning ? null : crossfaderControlId,
      );
    }
  };

  const handleCrossfader = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (midiLearnMode) return;
    const val = parseInt(e.target.value);
    setCrossfader(val);
    if (socket) {
      socket.emit("smart:crossfader", { value: val });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0c10] overflow-hidden">
      {/* MAIN LAYOUT */}
      <div className="flex-1 p-6 grid grid-cols-[1fr_auto_1fr] gap-8 overflow-hidden h-full">
        {/* === LEFT PADS === */}
        <div className="flex flex-col gap-4 h-full">
          <ControlHeader title="Group A" />
          <div className="h-1 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full w-full"></div>

          {/* Pads Grid 3x4 */}
          <div className="flex-1 grid grid-cols-3 grid-rows-4 gap-3 md:gap-4 overflow-y-auto pr-2 custom-scrollbar pb-20">
            {leftPads.map((pad) => (
              <Pad key={pad.id} pad={pad} />
            ))}
          </div>
        </div>

        {/* === CENTER MIXER === */}
        <div className="w-[340px] flex flex-col gap-6">
          {/* BPM Display */}
          <div className="h-28 bg-[#1a1c23] border-2 border-[#262c36] rounded-2xl flex items-center justify-center gap-4 relative shadow-xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <span className="text-7xl font-mono text-cyan-400 tracking-widest font-black drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] select-none">
              {bpm.toFixed(0)}
            </span>
            <span className="text-2xl text-slate-500 font-bold uppercase mt-6 select-none">
              BPM
            </span>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1">
              <button
                onClick={() => adjustBpm(1)}
                className="w-6 h-6 rounded bg-slate-800/80 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-colors"
                title="BPM +1"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => adjustBpm(-1)}
                className="w-6 h-6 rounded bg-slate-800/80 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-colors"
                title="BPM -1"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Vertical Faders Section */}
          <div className="flex-1 flex gap-3 h-full pb-20">
            <VerticalFader label="MASTER" zoneName="Master" zoneId={1} />
            <VerticalFader label="STAGE" zoneName="Stage" zoneId={2} />
            <VerticalFader label="FLOOR" zoneName="Dancefloor" zoneId={4} />
          </div>
        </div>

        {/* === RIGHT PADS === */}
        <div className="flex flex-col gap-4 h-full">
          <ControlHeader title="Group B" />
          <div className="h-1 bg-gradient-to-l from-purple-500/50 to-transparent rounded-full w-full"></div>

          {/* Pads Grid 3x4 (Mirrored) */}
          <div className="flex-1 grid grid-cols-3 grid-rows-4 gap-3 md:gap-4 overflow-y-auto pl-2 custom-scrollbar pb-20">
            {rightPads.map((pad) => (
              <Pad key={pad.id} pad={pad} />
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM CROSSFADER (Absolute overlays the bottom) */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10] to-transparent pointer-events-none flex items-end justify-center pb-6">
        <div
          onClick={handleCrossfaderClick}
          className={`w-[500px] h-12 bg-[#1a1c23]/90 backdrop-blur border ${isCrossfaderLearning ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-500/10" : "border-[#262c36]"} rounded-full flex items-center px-6 pointer-events-auto ${midiLearnMode ? "cursor-pointer" : ""} shadow-2xl relative`}
        >
          {hasCrossfaderMapping && midiLearnMode && (
            <div className="absolute -top-1 right-1/2 w-2 h-2 rounded-full bg-blue-400"></div>
          )}
          <span className="text-cyan-500 font-black text-xs tracking-widest w-8 text-center bg-cyan-500/10 rounded py-1">
            A
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={crossfader}
            onChange={handleCrossfader}
            className={`flex-1 mx-4 h-1 appearance-none bg-black rounded-full border border-slate-800 ${midiLearnMode ? "pointer-events-none" : "cursor-pointer"}`}
            style={{
              accentColor: "#94a3b8",
            }}
          />
          <span className="text-purple-500 font-black text-xs tracking-widest w-8 text-center bg-purple-500/10 rounded py-1">
            B
          </span>
        </div>
      </div>
    </div>
  );
}

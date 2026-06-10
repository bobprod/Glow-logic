"use client";

import React from "react";
import { X } from "lucide-react";
import type { NodeData } from "../../types/nodes";
import { socket } from "../../lib/socket";

interface FixtureInspectorProps {
  fixtureId: string;
  nodeData: NodeData;
  onClose: () => void;
}

export default function FixtureInspector({ nodeData, onClose }: FixtureInspectorProps) {
  const channels = (nodeData.channels as any[]) ?? [];
  const startAddr = (nodeData.startAddress as number) ?? 1;
  const universe = (nodeData.universe as number) ?? 1;
  const fixtureName = (nodeData.fixtureName as string) || (nodeData.label as string) || "Fixture";

  const handleChannelChange = (chType: string, value: number) => {
    // Find the absolute channel for this type
    const ch = channels.find((c: any) => c.type === chType);
    if (!ch) return;
    const absChannel = startAddr + ch.channel - 1;
    socket.emit("dmx_update", { universe, channel: absChannel, value });
  };

  return (
    <div className="absolute top-4 left-4 w-72 bg-[#12141a]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <h3 className="text-sm font-bold text-white">{fixtureName}</h3>
          <p className="text-[10px] text-slate-500 font-mono">
            U{universe}/@{startAddr} · {channels.length}ch
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Channels */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {channels.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">Aucun canal configuré</p>
        )}

        {channels.map((ch: any) => {
          const absCh = startAddr + ch.channel - 1;
          return (
            <div key={ch.channel} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  {ch.function}
                </span>
                <span className="text-[10px] text-slate-600 font-mono">
                  CH{absCh}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                defaultValue="0"
                onChange={(e) => handleChannelChange(ch.type, Number(e.target.value))}
                className="w-full h-1.5 accent-cyan-400 bg-slate-800 rounded-full appearance-none cursor-pointer"
              />
            </div>
          );
        })}

        {/* Quick actions */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <button
            onClick={() => {
              // Flash test: set dimmer to 255 for 500ms then back
              handleChannelChange("dimmer", 255);
              setTimeout(() => handleChannelChange("dimmer", 0), 500);
            }}
            className="w-full py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-bold transition-all"
          >
            Flash Test
          </button>
        </div>
      </div>
    </div>
  );
}

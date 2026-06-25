"use client";

import React, { useState, useEffect } from "react";
import { socket } from "../../lib/socket";

type OutputId = "python" | "qlcOsc" | "qlcWs" | "artNet" | "usbDmx";
type OutputHealthState = "ok" | "degraded" | "error" | "off";

interface OutputState {
  enabled: boolean;
  state: OutputHealthState;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  errorCount: number;
}

interface OutputHealthSnapshot {
  outputs: Record<OutputId, OutputState>;
  at: number;
}

const OUTPUT_LABELS: Record<OutputId, string> = {
  python: "Python Bridge",
  qlcOsc: "QLC+ OSC",
  qlcWs: "QLC+ WebSocket",
  artNet: "ArtNet",
  usbDmx: "USB DMX",
};

const OUTPUT_ORDER: OutputId[] = ["python", "qlcOsc", "qlcWs", "artNet", "usbDmx"];

function dotColor(state: OutputHealthState): string {
  switch (state) {
    case "ok":       return "bg-emerald-400";
    case "degraded": return "bg-yellow-400";
    case "error":    return "bg-red-500";
    case "off":      return "bg-slate-600";
  }
}

function stateBadgeClass(state: OutputHealthState): string {
  switch (state) {
    case "ok":       return "text-emerald-400";
    case "degraded": return "text-yellow-400";
    case "error":    return "text-red-400";
    case "off":      return "text-slate-500";
  }
}

function stateLabel(state: OutputHealthState): string {
  switch (state) {
    case "ok":       return "OK";
    case "degraded": return "Dégradé";
    case "error":    return "Erreur";
    case "off":      return "Off";
  }
}

function timeAgo(ts: number | null): string {
  if (ts === null) return "";
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 2)  return "maintenant";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}min`;
}

export default function OutputHealthWidget() {
  const [snapshot, setSnapshot] = useState<OutputHealthSnapshot | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = (data: OutputHealthSnapshot) => setSnapshot(data);
    socket.on("dmx_output_status", handler);
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      socket.off("dmx_output_status", handler);
      clearInterval(interval);
    };
  }, []);

  if (!snapshot) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
        <span className="inline-block w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
        En attente des données...
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {OUTPUT_ORDER.map((id) => {
        const output = snapshot.outputs[id];
        if (!output) return null;
        const showDetail = output.state === "error" || output.state === "degraded";
        return (
          <div
            key={id}
            className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-black/20 px-3 py-2"
          >
            <span
              className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${dotColor(output.state)} ${
                output.state === "ok" ? "" : "animate-pulse"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {OUTPUT_LABELS[id]}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${stateBadgeClass(output.state)}`}>
                  {stateLabel(output.state)}
                </span>
              </div>
              {showDetail && output.lastErrorMessage && (
                <p className="text-[10px] text-red-400/80 mt-0.5 truncate">
                  {output.lastErrorMessage}
                </p>
              )}
              {output.state !== "off" && output.lastOkAt !== null && (
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Dernier OK : {timeAgo(output.lastOkAt)}
                  {output.errorCount > 0 && (
                    <span className="ml-2 text-red-500/60">{output.errorCount} err</span>
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-slate-600 text-right pt-1">
        Mis à jour {timeAgo(snapshot.at)}
      </p>
    </div>
  );
}

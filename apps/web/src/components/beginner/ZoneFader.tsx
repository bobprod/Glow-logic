"use client";

import React from "react";

interface ZoneFaderProps {
  label: string;
  emoji?: string;
  value: number;
  onChange: (value: number) => void;
  accentColor?: string;
  showQuickButtons?: boolean;
}

export function ZoneFader({
  label,
  emoji,
  value,
  onChange,
  accentColor = "cyan",
  showQuickButtons = false,
}: ZoneFaderProps) {
  const colorMap: Record<string, string> = {
    cyan: "accent-cyan-400",
    pink: "accent-pink-400",
    green: "accent-green-400",
    yellow: "accent-yellow-400",
    orange: "accent-orange-400",
    purple: "accent-purple-400",
    slate: "accent-slate-400",
  };

  const accent = colorMap[accentColor] || colorMap.cyan;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-300 font-bold flex items-center gap-1.5">
          {emoji && <span>{emoji}</span>}
          {label}
        </span>
        <span className="text-slate-400 font-mono font-bold">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2.5 rounded-full appearance-none bg-slate-800 ${accent} cursor-pointer transition-all`}
      />
      {showQuickButtons && (
        <div className="flex gap-1 mt-0.5">
          {[0, 25, 50, 75, 100].map((v) => (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                value === v
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-slate-800 text-slate-500 hover:bg-slate-700"
              }`}
            >
              {v}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

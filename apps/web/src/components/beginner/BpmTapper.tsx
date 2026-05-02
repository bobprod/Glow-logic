"use client";

import React, { useRef, useCallback, useState } from "react";
import { Activity } from "lucide-react";

interface BpmTapperProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  onTap?: () => void;
}

export function BpmTapper({ bpm, onBpmChange, onTap }: BpmTapperProps) {
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    let newTaps = [...tapTimes, now];

    // Reset si pause > 2s
    if (newTaps.length > 1 && now - newTaps[newTaps.length - 2] > 2000) {
      newTaps = [now];
    }
    if (newTaps.length > 8) newTaps.shift();
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculated = Math.round(60000 / avg);
      if (calculated >= 40 && calculated <= 250) {
        onBpmChange(calculated);
      }
    }

    onTap?.();

    // Animation
    btnRef.current?.classList.add("scale-95", "bg-cyan-500/30");
    setTimeout(() => btnRef.current?.classList.remove("scale-95", "bg-cyan-500/30"), 100);
  }, [tapTimes, onBpmChange, onTap]);

  return (
    <div className="flex items-center gap-2">
      <button
        ref={btnRef}
        onClick={handleTap}
        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/30 text-cyan-400 text-xs font-black tracking-widest transition-all active:scale-95 flex items-center gap-2"
      >
        <Activity className="w-4 h-4" />
        TAP
      </button>
      <div className="px-4 py-2 bg-black/40 rounded-xl border border-white/5 text-center min-w-[80px]">
        <span className="text-[9px] text-slate-500 font-bold tracking-widest block">BPM</span>
        <span className="text-cyan-400 font-mono text-xl font-bold leading-tight">{bpm.toFixed(1)}</span>
      </div>
    </div>
  );
}

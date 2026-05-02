"use client";

import React from "react";
import { Power } from "lucide-react";

interface BlackoutButtonProps {
  active: boolean;
  onToggle: () => void;
}

export function BlackoutButton({ active, onToggle }: BlackoutButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`h-12 px-6 rounded-xl font-black text-sm tracking-widest transition-all border flex items-center gap-2
        ${active
          ? "bg-red-600 border-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse"
          : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
        }`}
    >
      <Power className="w-4 h-4" />
      {active ? "BLACKOUT ACTIF" : "BLACKOUT"}
    </button>
  );
}

"use client";

import React from "react";
import { SmartPad } from "../../store/useStore";
import {
  Zap, Flame, Droplets, Sun, Moon, Mic, Music, Activity,
  Volume2, Sparkles, Star, Heart, PartyPopper, Lightbulb,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Flame, Droplets, Sun, Moon, Mic, Music, Activity,
  Volume2, Sparkles, Star, Heart, PartyPopper, Lightbulb,
};

interface ScenePadProps {
  pad: SmartPad;
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

export function ScenePad({ pad, isActive, disabled, onClick, size = "lg" }: ScenePadProps) {
  const Icon = ICON_MAP[pad.iconName || "Zap"] || Zap;

  const sizeClasses = {
    sm: "min-h-[80px] text-sm",
    md: "min-h-[120px] text-base",
    lg: "min-h-[160px] text-lg",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center gap-2 transition-all duration-150
        ${isActive
          ? "border-white shadow-[0_0_40px_rgba(255,255,255,0.15)] scale-[0.97]"
          : "border-transparent hover:border-white/20 hover:scale-[1.02] hover:shadow-lg"
        }
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
        ${sizeClasses[size]}
      `}
    >
      {/* Background glow */}
      <div className={`absolute inset-0 ${pad.color} transition-opacity ${isActive ? "opacity-30" : "opacity-10"}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Active ping dot */}
      {isActive && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 rounded-full bg-white animate-ping" />
          <div className="w-3 h-3 rounded-full bg-white absolute inset-0" />
        </div>
      )}

      {/* Icon */}
      <div className={`relative z-10 p-3 rounded-xl bg-white/10 ${isActive ? pad.textColor : "text-slate-400"} transition-colors`}>
        <Icon className="w-7 h-7" />
      </div>

      {/* Label */}
      <div className="relative z-10 text-center px-2">
        <h3 className="text-white font-black tracking-tight leading-tight">{pad.name}</h3>
        <p className={`text-[10px] font-bold mt-0.5 ${isActive ? pad.textColor : "text-slate-500"}`}>
          {isActive ? "⏵ EN COURS" : "Cliquer pour lancer"}
        </p>
      </div>
    </button>
  );
}

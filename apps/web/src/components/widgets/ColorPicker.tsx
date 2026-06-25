"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

// Preset color buttons
const COLOR_PRESETS = [
  { name: "Blanc", r: 255, g: 255, b: 255, hex: "#ffffff" },
  { name: "Rouge", r: 255, g: 0, b: 0, hex: "#ff0000" },
  { name: "Vert", r: 0, g: 255, b: 0, hex: "#00ff00" },
  { name: "Bleu", r: 0, g: 0, b: 255, hex: "#0000ff" },
  { name: "Cyan", r: 0, g: 255, b: 255, hex: "#00ffff" },
  { name: "Magenta", r: 255, g: 0, b: 255, hex: "#ff00ff" },
  { name: "Jaune", r: 255, g: 255, b: 0, hex: "#ffff00" },
  { name: "Ambre", r: 255, g: 176, b: 0, hex: "#ffb000" },
  { name: "Orange", r: 255, g: 100, b: 0, hex: "#ff6400" },
  { name: "Rose", r: 255, g: 105, b: 180, hex: "#ff69b4" },
  { name: "Violet", r: 148, g: 0, b: 211, hex: "#9400d3" },
  { name: "Off", r: 0, g: 0, b: 0, hex: "#000000" },
];

interface ColorPickerProps {
  red: number;
  green: number;
  blue: number;
  onRedChange: (v: number) => void;
  onGreenChange: (v: number) => void;
  onBlueChange: (v: number) => void;
  /** Optional white channel */
  white?: number;
  onWhiteChange?: (v: number) => void;
  /** Optional amber channel */
  amber?: number;
  onAmberChange?: (v: number) => void;
  /** Optional UV channel */
  uv?: number;
  onUvChange?: (v: number) => void;
  /** Compact mode */
  compact?: boolean;
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): [number, number, number] {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export default function ColorPicker({
  red,
  green,
  blue,
  onRedChange,
  onGreenChange,
  onBlueChange,
  white,
  onWhiteChange,
  amber,
  onAmberChange,
  uv,
  onUvChange,
  compact = false,
}: ColorPickerProps) {
  const hueBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const [hsl, setHsl] = useState<[number, number, number]>(() =>
    rgbToHsl(red, green, blue)
  );

  // Sync HSL when RGB changes externally
  useEffect(() => {
    const newHsl = rgbToHsl(red, green, blue);
    // Only update if the difference is significant to avoid loops
    if (
      Math.abs(newHsl[0] - hsl[0]) > 5 ||
      Math.abs(newHsl[1] - hsl[1]) > 5 ||
      Math.abs(newHsl[2] - hsl[2]) > 5
    ) {
      setHsl(newHsl);
    }
  }, [red, green, blue, hsl]);

  const applyColor = useCallback(
    (r: number, g: number, b: number) => {
      onRedChange(r);
      onGreenChange(g);
      onBlueChange(b);
    },
    [onRedChange, onGreenChange, onBlueChange]
  );

  const handleHueChange = useCallback(
    (clientX: number) => {
      const bar = hueBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const hue = Math.round((x / rect.width) * 360);
      const newHsl: [number, number, number] = [hue, 100, 50];
      setHsl(newHsl);
      const [r, g, b] = hslToRgb(hue, 100, 50);
      applyColor(r, g, b);
    },
    [applyColor]
  );

  const handleHuePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDraggingHue(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleHueChange(e.clientX);
    },
    [handleHueChange]
  );

  const handleHuePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingHue) return;
      handleHueChange(e.clientX);
    },
    [isDraggingHue, handleHueChange]
  );

  const currentColor = `rgb(${red}, ${green}, ${blue})`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          Couleur
        </span>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full border-2 border-white/20 shadow-inner"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-[10px] text-slate-400 font-mono">
            {red},{green},{blue}
          </span>
        </div>
      </div>

      {/* Hue bar */}
      <div
        ref={hueBarRef}
        className="h-6 rounded-lg cursor-crosshair relative overflow-hidden border border-white/10"
        style={{
          background:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
        onPointerDown={handleHuePointerDown}
        onPointerMove={handleHuePointerMove}
        onPointerUp={() => setIsDraggingHue(false)}
        onPointerLeave={() => setIsDraggingHue(false)}
      >
        {/* Indicator */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-md pointer-events-none"
          style={{
            left: `${(hsl[0] / 360) * 100}%`,
            transform: "translateX(-50%)",
            boxShadow: "0 0 6px rgba(255,255,255,0.5)",
          }}
        />
      </div>

      {/* Brightness slider */}
      <div className="bg-[#0a0c10] rounded-lg p-2 border border-white/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase">
            Luminosité
          </span>
          <span className="text-[9px] text-slate-400 font-mono">
            {Math.round(((red + green + blue) / 765) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(((red + green + blue) / 765) * 100)}
          onChange={(e) => {
            const pct = parseInt(e.target.value) / 100;
            const [r, g, b] = hslToRgb(hsl[0], hsl[1], pct * 50);
            applyColor(r, g, b);
          }}
          className="w-full h-1.5 appearance-none bg-gradient-to-r from-black to-white rounded-full cursor-pointer"
          style={{ accentColor: currentColor }}
        />
      </div>

      {/* RGB sliders */}
      {!compact && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "R", value: red, onChange: onRedChange, color: "#ef4444" },
            {
              label: "G",
              value: green,
              onChange: onGreenChange,
              color: "#22c55e",
            },
            {
              label: "B",
              value: blue,
              onChange: onBlueChange,
              color: "#3b82f6",
            },
          ].map((ch) => (
            <div
              key={ch.label}
              className="bg-[#0a0c10] rounded-lg p-1.5 border border-white/5"
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[9px] font-bold"
                  style={{ color: ch.color }}
                >
                  {ch.label}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {ch.value}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={ch.value}
                onChange={(e) => ch.onChange(parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-black rounded-full cursor-pointer"
                style={{ accentColor: ch.color }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Extra channels (White, Amber, UV) */}
      {(onWhiteChange || onAmberChange || onUvChange) && (
        <div className="grid grid-cols-3 gap-1.5">
          {onWhiteChange && white !== undefined && (
            <div className="bg-[#0a0c10] rounded-lg p-1.5 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-200">W</span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {white}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={white}
                onChange={(e) => onWhiteChange(parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-black rounded-full cursor-pointer"
                style={{ accentColor: "#f8fafc" }}
              />
            </div>
          )}
          {onAmberChange && amber !== undefined && (
            <div className="bg-[#0a0c10] rounded-lg p-1.5 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-orange-400">A</span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {amber}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={amber}
                onChange={(e) => onAmberChange(parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-black rounded-full cursor-pointer"
                style={{ accentColor: "#f97316" }}
              />
            </div>
          )}
          {onUvChange && uv !== undefined && (
            <div className="bg-[#0a0c10] rounded-lg p-1.5 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-purple-400">UV</span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {uv}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={uv}
                onChange={(e) => onUvChange(parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-black rounded-full cursor-pointer"
                style={{ accentColor: "#a855f7" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Color presets */}
      <div className="grid grid-cols-6 gap-1">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            title={preset.name}
            onClick={() => applyColor(preset.r, preset.g, preset.b)}
            className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
              red === preset.r && green === preset.g && blue === preset.b
                ? "border-white scale-105 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                : "border-white/10 hover:border-white/30"
            }`}
            style={{ backgroundColor: preset.hex }}
          />
        ))}
      </div>
    </div>
  );
}

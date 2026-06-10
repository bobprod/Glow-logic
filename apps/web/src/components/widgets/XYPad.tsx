"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Crosshair, Lock, Unlock, Circle, Infinity, ArrowLeftRight, Zap, Pause, Play } from "lucide-react";
import { dmxEngine } from "@/lib/dmxEngine";
import { EffectType } from "@/lib/EffectEngine";

interface XYPadProps {
  /** Current Pan value 0-255 */
  panValue: number;
  /** Current Tilt value 0-255 */
  tiltValue: number;
  /** Called when pan changes */
  onPanChange: (value: number) => void;
  /** Called when tilt changes */
  onTiltChange: (value: number) => void;
  /** Optional Pan Fine channel */
  onPanFineChange?: (value: number) => void;
  /** Optional Tilt Fine channel */
  onTiltFineChange?: (value: number) => void;
  /** Universe for effect engine (default 1) */
  universe?: number;
  /** Absolute Pan channel number for effect engine */
  panChannel?: number;
  /** Absolute Tilt channel number for effect engine */
  tiltChannel?: number;
  /** Size of the pad in pixels */
  size?: number;
  /** Whether to show labels */
  showLabels?: boolean;
}

export default function XYPad({
  panValue,
  tiltValue,
  onPanChange,
  onTiltChange,
  onPanFineChange,
  onTiltFineChange,
  universe = 1,
  panChannel,
  tiltChannel,
  size = 200,
  showLabels = true,
}: XYPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lockPan, setLockPan] = useState(false);
  const [lockTilt, setLockTilt] = useState(false);
  const [fineMode, setFineMode] = useState(false);
  const [activePattern, setActivePattern] = useState<EffectType | null>(null);
  const [effectSpeed, setEffectSpeed] = useState(10);
  const [effectSize, setEffectSize] = useState(80);
  const [effectPaused, setEffectPaused] = useState(false);
  const effectIdRef = useRef<string | null>(null);

  // Visual tracking for active patterns
  const [visualPan, setVisualPan] = useState(panValue);
  const [visualTilt, setVisualTilt] = useState(tiltValue);
  const rafRef = useRef<number | null>(null);

  // Listen for shift key for fine mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setFineMode(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setFineMode(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Sync visual position to props when no pattern
  useEffect(() => {
    if (!activePattern) {
      setVisualPan(panValue);
      setVisualTilt(tiltValue);
    }
  }, [panValue, tiltValue, activePattern]);

  // Poll DMX engine for visual position when pattern active
  useEffect(() => {
    if (!activePattern || !panChannel || !tiltChannel) return;
    const poll = () => {
      setVisualPan(dmxEngine.getChannel(universe, panChannel));
      setVisualTilt(dmxEngine.getChannel(universe, tiltChannel));
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [activePattern, panChannel, tiltChannel, universe]);

  // Draw the pad
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Center crosshair
    const cx = size / 2;
    const cy = size / 2;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(size, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current position
    const x = (visualPan / 255) * size;
    const y = (visualTilt / 255) * size;

    // Line from center to point
    ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20);
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.4)");
    gradient.addColorStop(1, "rgba(6, 182, 212, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Point
    ctx.fillStyle = isDragging ? "#22d3ee" : "#06b6d4";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Border ring
    ctx.strokeStyle = isDragging
      ? "rgba(34, 211, 238, 0.8)"
      : "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Lock indicators
    if (lockPan) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    if (lockTilt) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }, [visualPan, visualTilt, size, isDragging, lockPan, lockTilt]);

  const updateFromPosition = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(size, clientX - rect.left));
      const y = Math.max(0, Math.min(size, clientY - rect.top));

      const newPan = Math.round((x / size) * 255);
      const newTilt = Math.round((y / size) * 255);

      if (!lockPan) onPanChange(newPan);
      if (!lockTilt) onTiltChange(newTilt);

      // Fine mode sends fine channels
      if (fineMode) {
        const fineX = Math.round(((x / size) * 255 * 256) % 256);
        const fineY = Math.round(((y / size) * 255 * 256) % 256);
        if (!lockPan && onPanFineChange) onPanFineChange(fineX);
        if (!lockTilt && onTiltFineChange) onTiltFineChange(fineY);
      }
    },
    [
      size,
      lockPan,
      lockTilt,
      fineMode,
      onPanChange,
      onTiltChange,
      onPanFineChange,
      onTiltFineChange,
    ]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPosition(e.clientX, e.clientY);
    },
    [updateFromPosition]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      updateFromPosition(e.clientX, e.clientY);
    },
    [isDragging, updateFromPosition]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const startPattern = useCallback((type: EffectType) => {
    if (!panChannel || !tiltChannel) return;

    if (effectIdRef.current) {
      dmxEngine.stopEffect(effectIdRef.current);
    }

    const id = `xy-${universe}-${panChannel}-${Date.now()}`;
    effectIdRef.current = id;
    setActivePattern(type);
    setEffectPaused(false);

    dmxEngine.startEffect({
      id,
      type,
      channels: { pan: panChannel, tilt: tiltChannel },
      universe,
      centerPan: panValue,
      centerTilt: tiltValue,
      size: effectSize,
      speed: effectSpeed,
    });
  }, [panChannel, tiltChannel, universe, panValue, tiltValue, effectSize, effectSpeed]);

  const stopPattern = useCallback(() => {
    if (effectIdRef.current) {
      dmxEngine.stopEffect(effectIdRef.current);
      effectIdRef.current = null;
    }
    setActivePattern(null);
    setEffectPaused(false);
  }, []);

  const togglePausePattern = useCallback(() => {
    if (!effectIdRef.current) return;
    if (effectPaused) {
      dmxEngine.resumeEffect(effectIdRef.current);
      setEffectPaused(false);
    } else {
      dmxEngine.pauseEffect(effectIdRef.current);
      setEffectPaused(true);
    }
  }, [effectPaused]);

  // Update effect params when speed/size change
  useEffect(() => {
    if (effectIdRef.current && activePattern) {
      dmxEngine.updateEffect(effectIdRef.current, {
        speed: effectSpeed,
        size: effectSize,
      });
    }
  }, [effectSpeed, effectSize, activePattern]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (effectIdRef.current) {
        dmxEngine.stopEffect(effectIdRef.current);
      }
    };
  }, []);

  const PATTERNS: Array<{ type: EffectType; icon: React.ReactNode; label: string }> = [
    { type: "circle", icon: <Circle className="w-3 h-3" />, label: "Cercle" },
    { type: "figure8", icon: <Infinity className="w-3 h-3" />, label: "8" },
    { type: "sweep", icon: <ArrowLeftRight className="w-3 h-3" />, label: "Sweep" },
    { type: "random", icon: <Zap className="w-3 h-3" />, label: "Random" },
  ];

  const resetCenter = () => {
    if (!lockPan) onPanChange(127);
    if (!lockTilt) onTiltChange(127);
  };

  return (
    <div className="flex flex-col gap-2">
      {showLabels && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Pan / Tilt
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-cyan-400 font-mono">
              {visualPan},{visualTilt}
            </span>
            {fineMode && (
              <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded">
                FINE
              </span>
            )}
            {activePattern && (
              <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 rounded animate-pulse">
                {activePattern.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
          isDragging
            ? "border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            : activePattern
            ? "border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            : "border-white/10"
        }`}
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, cursor: activePattern ? "default" : "crosshair" }}
          onPointerDown={activePattern ? undefined : handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Pattern running overlay */}
        {activePattern && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-xl px-4 py-2 backdrop-blur-sm">
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
                {activePattern === "figure8" ? "∞" : activePattern}
              </p>
            </div>
          </div>
        )}

        {/* Axis labels */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-cyan-400/50 font-bold pointer-events-none">
          PAN →
        </span>
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-cyan-400/50 font-bold pointer-events-none"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          TILT →
        </span>
      </div>

      {/* Pattern Controls */}
      {panChannel && tiltChannel && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Mouvement
            </span>
            {activePattern && (
              <div className="flex gap-1">
                <button
                  onClick={togglePausePattern}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  title={effectPaused ? "Reprendre" : "Pause"}
                >
                  {effectPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </button>
                <button
                  onClick={stopPattern}
                  className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                  title="Arrêter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {PATTERNS.map((p) => (
              <button
                key={p.type}
                onClick={() => activePattern === p.type ? stopPattern() : startPattern(p.type)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                  activePattern === p.type
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                    : "bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/10"
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>
          {activePattern && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-8">Vit.</span>
                <input
                  type="range"
                  min="2"
                  max="60"
                  value={effectSpeed}
                  onChange={(e) => setEffectSpeed(parseInt(e.target.value))}
                  className="flex-1 h-1 appearance-none bg-black rounded-full border border-[#262c36] cursor-pointer"
                  style={{ accentColor: "#06b6d4" }}
                />
                <span className="text-[9px] text-cyan-400 font-mono w-6 text-right">{effectSpeed}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-8">Amp.</span>
                <input
                  type="range"
                  min="10"
                  max="127"
                  value={effectSize}
                  onChange={(e) => setEffectSize(parseInt(e.target.value))}
                  className="flex-1 h-1 appearance-none bg-black rounded-full border border-[#262c36] cursor-pointer"
                  style={{ accentColor: "#06b6d4" }}
                />
                <span className="text-[9px] text-cyan-400 font-mono w-6 text-right">{effectSize}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1.5">
        <button
          onClick={resetCenter}
          className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 text-[10px] text-slate-400 hover:text-cyan-400 font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
        >
          <Crosshair className="w-3 h-3" />
          Centre
        </button>
        <button
          onClick={() => setLockPan(!lockPan)}
          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
            lockPan
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
          }`}
          title="Verrouiller Pan"
        >
          {lockPan ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
          P
        </button>
        <button
          onClick={() => setLockTilt(!lockTilt)}
          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
            lockTilt
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
          }`}
          title="Verrouiller Tilt"
        >
          {lockTilt ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
          T
        </button>
      </div>
    </div>
  );
}

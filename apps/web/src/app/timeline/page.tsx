"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Pause, SkipBack, SkipForward, Clock, ArrowLeft,
  Plus, X, Flag, Volume2, Lightbulb, Music, Zap, Trash2,
} from "lucide-react";
import useStore from "../../store/useStore";
import { socket } from "../../lib/socket";
import { TimelineClip, CueMarker } from "../../store/slices/timelineSlice";

// ─── Helpers ───
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function msToPct(ms: number, viewStart: number, viewDuration: number): number {
  if (viewDuration <= 0) return 0;
  return ((ms - viewStart) / viewDuration) * 100;
}

const TRACK_CONFIG = [
  { id: "lights", label: "LUMIÈRES", icon: Lightbulb, color: "text-yellow-400" },
  { id: "visuals", label: "VISUELS", icon: Music, color: "text-purple-400" },
  { id: "fx", label: "EFFETS", icon: Zap, color: "text-cyan-400" },
] as const;

const CLIP_PRESETS = [
  { name: "Intro", color: "bg-cyan-500", textColor: "text-cyan-300", duration: 30000 },
  { name: "Build Up", color: "bg-blue-500", textColor: "text-blue-300", duration: 20000 },
  { name: "Drop", color: "bg-pink-500", textColor: "text-pink-300", duration: 45000 },
  { name: "Ambiance", color: "bg-amber-500", textColor: "text-amber-300", duration: 60000 },
  { name: "Strobe", color: "bg-white", textColor: "text-slate-200", duration: 15000 },
  { name: "Outro", color: "bg-slate-500", textColor: "text-slate-300", duration: 30000 },
];

export default function TimelinePage() {
  const router = useRouter();
  const tracksRef = useRef<HTMLDivElement>(null);

  // Store
  const {
    clips, addClip, updateClip, deleteClip,
    markers, addMarker, deleteMarker,
    duration, setDuration,
    smartPads,
  } = useStore();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Zoom / view
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const viewDuration = duration / zoom;
  const viewEnd = Math.min(viewStart + viewDuration, duration);

  // Modals
  const [showAddClip, setShowAddClip] = useState(false);
  const [addClipTrack, setAddClipTrack] = useState<string>("lights");
  const [addClipTime, setAddClipTime] = useState(0);
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [markerTime, setMarkerTime] = useState(0);
  const [markerName, setMarkerName] = useState("");

  // Duration editing
  const [durationMin, setDurationMin] = useState(Math.floor(duration / 60000));

  // ─── Timer ───
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 100;
          if (next >= duration) { setIsPlaying(false); return duration; }
          return next;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, duration]);

  // Auto-scroll playhead
  useEffect(() => {
    if (elapsed > viewEnd) {
      setViewStart(Math.max(0, elapsed - viewDuration / 2));
    } else if (elapsed < viewStart) {
      setViewStart(Math.max(0, elapsed - viewDuration / 4));
    }
  }, [elapsed, viewEnd, viewStart, viewDuration]);

  // ─── Actions ───
  const handlePlayPause = () => setIsPlaying((p) => !p);
  const handleStop = () => { setIsPlaying(false); setElapsed(0); };
  const handleSkipBack = () => setElapsed((p) => Math.max(0, p - 15000));
  const handleSkipForward = () => setElapsed((p) => Math.min(duration, p + 15000));

  const handleAddClip = (presetIdx: number) => {
    const preset = CLIP_PRESETS[presetIdx];
    if (!preset) return;
    addClip({
      id: `clip-${Date.now()}`,
      track: addClipTrack as any,
      name: preset.name,
      startTime: addClipTime,
      duration: preset.duration,
      color: preset.color,
      textColor: preset.textColor,
    });
    setShowAddClip(false);

    // Auto-trigger sur la piste lights
    if (addClipTrack === "lights") {
      socket.emit("smart:trigger_scene", { pageId: 1, widgetId: presetIdx + 10, active: true });
    }
  };

  const handleAddMarker = () => {
    if (!markerName.trim()) return;
    addMarker({
      id: `mkr-${Date.now()}`,
      name: markerName.trim(),
      time: markerTime,
      color: "#f43f5e",
    });
    setShowAddMarker(false);
    setMarkerName("");
  };

  const handleTrackDoubleClick = (e: React.MouseEvent, trackId: string) => {
    if (!tracksRef.current) return;
    const rect = tracksRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const time = Math.max(0, Math.min(viewStart + pct * viewDuration, duration - 10000));
    setAddClipTrack(trackId);
    setAddClipTime(time);
    setShowAddClip(true);
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!tracksRef.current) return;
    const rect = tracksRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const time = Math.max(0, Math.min(viewStart + pct * viewDuration, duration));
    if (e.shiftKey) {
      setMarkerTime(time);
      setShowAddMarker(true);
    } else {
      setElapsed(time);
    }
  };

  const handleDurationChange = (mins: number) => {
    setDurationMin(mins);
    setDuration(mins * 60000);
  };

  const playheadPct = msToPct(elapsed, viewStart, viewDuration);

  // ─── Active clip detection ───
  const getActiveClip = (track: string): TimelineClip | null => {
    return clips.find(
      (c) => c.track === track && elapsed >= c.startTime && elapsed < c.startTime + c.duration
    ) || null;
  };

  return (
    <div className="w-screen h-screen bg-[#0a0c10] overflow-hidden flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="h-16 shrink-0 bg-[#12141a] border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Clock className="w-5 h-5 text-cyan-400" />
          <h1 className="text-white font-black tracking-widest text-lg">TIMELINE</h1>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-2">
          <button onClick={handleStop} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors" title="Stop">
            <div className="w-3 h-3 bg-current rounded-sm" />
          </button>
          <button onClick={handleSkipBack} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handlePlayPause}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-black transition-all ${
              isPlaying ? "bg-yellow-400 hover:bg-yellow-300" : "bg-cyan-500 hover:bg-cyan-400"
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
          </button>
          <button onClick={handleSkipForward} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="ml-3 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 text-center min-w-[100px]">
            <span className="text-[9px] text-slate-500 font-bold tracking-widest">TEMPS</span>
            <div className="text-white font-mono text-sm font-bold">{formatTime(elapsed)}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-xl">
            <span className="text-[9px] text-slate-400 font-bold">DURÉE</span>
            <input
              type="number"
              min={1}
              max={60}
              value={durationMin}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              className="w-10 bg-transparent text-white font-mono text-sm text-center focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">min</span>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(Math.max(1, zoom / 1.3))} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-bold">-</button>
            <span className="text-[10px] text-slate-500 w-10 text-center">{zoom.toFixed(1)}x</span>
            <button onClick={() => setZoom(Math.min(10, zoom * 1.3))} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-bold">+</button>
          </div>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* ─── Timeline Tracks ─── */}
        <div className="flex-1 bg-[#12141a] rounded-2xl border border-white/5 flex flex-col overflow-hidden">
          {/* Ruler */}
          <div
            ref={tracksRef}
            className="h-8 bg-[#0f1116] border-b border-white/5 relative cursor-crosshair shrink-0"
            onClick={handleRulerClick}
          >
            {/* Ticks */}
            {Array.from({ length: Math.ceil(viewDuration / 30000) + 1 }).map((_, i) => {
              const t = Math.floor(viewStart / 30000) * 30000 + i * 30000;
              if (t > duration) return null;
              const pct = msToPct(t, viewStart, viewDuration);
              return (
                <div key={t} className="absolute top-0 h-full flex items-end pb-1 pointer-events-none" style={{ left: `${pct}%` }}>
                  <span className="text-[8px] text-slate-600 font-mono">{formatTime(t)}</span>
                </div>
              );
            })}

            {/* Markers */}
            {markers.map((m) => {
              const pct = msToPct(m.time, viewStart, viewDuration);
              if (pct < -5 || pct > 105) return null;
              return (
                <div key={m.id} className="absolute top-0 h-full flex flex-col items-center z-10 group" style={{ left: `${pct}%` }}>
                  <Flag className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-[7px] text-yellow-400 font-bold whitespace-nowrap -translate-x-1/2">{m.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMarker(m.id); }}
                    className="absolute -top-1 -right-3 opacity-0 group-hover:opacity-100 text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Playhead */}
            <div className="absolute top-0 h-full z-20 pointer-events-none" style={{ left: `${playheadPct}%`, transform: "translateX(-50%)" }}>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>
          </div>

          {/* Tracks */}
          <div className="flex-1 relative overflow-hidden">
            {/* Playhead line */}
            <div className="absolute top-0 bottom-0 w-px bg-red-500/50 z-20 pointer-events-none" style={{ left: `${playheadPct}%` }} />

            {TRACK_CONFIG.map((track) => {
              const activeClip = getActiveClip(track.id);
              const trackClips = clips.filter((c) => c.track === track.id);

              return (
                <div
                  key={track.id}
                  className="h-1/3 border-b border-white/5 flex relative"
                  onDoubleClick={(e) => handleTrackDoubleClick(e, track.id)}
                >
                  {/* Label */}
                  <div className="w-24 shrink-0 bg-[#0a0c10] border-r border-white/5 flex flex-col items-center justify-center gap-1">
                    <track.icon className={`w-4 h-4 ${track.color}`} />
                    <span className="text-[9px] text-slate-500 font-bold tracking-widest">{track.label}</span>
                    {activeClip && (
                      <span className="text-[8px] text-white font-bold truncate max-w-[80px] px-1">{activeClip.name}</span>
                    )}
                  </div>

                  {/* Clips area */}
                  <div className="flex-1 relative">
                    {trackClips.map((clip) => {
                      const left = msToPct(clip.startTime, viewStart, viewDuration);
                      const right = msToPct(clip.startTime + clip.duration, viewStart, viewDuration);
                      const width = right - left;
                      const isActive = elapsed >= clip.startTime && elapsed < clip.startTime + clip.duration;

                      return (
                        <div
                          key={clip.id}
                          className={`absolute top-1 bottom-1 rounded-lg border flex items-center px-2 text-[9px] font-bold overflow-hidden cursor-pointer transition-all
                            ${isActive ? "ring-1 ring-white/50 border-white/30" : "border-white/10 hover:border-white/20"}
                          `}
                          style={{
                            left: `${Math.max(0, left)}%`,
                            width: `${Math.min(width, 100 - Math.max(0, left))}%`,
                          }}
                          title={`${clip.name} (${formatTime(clip.startTime)} - ${formatTime(clip.startTime + clip.duration)})`}
                        >
                          <div className={`absolute inset-0 ${clip.color} opacity-20`} />
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${clip.color}`} />
                          <span className="relative z-10 truncate text-white">{clip.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 text-red-400 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Bottom: Presets + Quick Add ─── */}
        <div className="h-24 shrink-0 flex gap-4">
          {/* Quick presets */}
          <div className="flex-1 bg-[#12141a] rounded-2xl border border-white/5 p-3 flex items-center gap-3 overflow-x-auto">
            <span className="text-[10px] text-slate-500 font-bold tracking-widest shrink-0">AJOUT RAPIDE:</span>
            {CLIP_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setAddClipTrack("lights");
                  setAddClipTime(elapsed);
                  handleAddClip(idx);
                }}
                className={`shrink-0 px-4 py-2 rounded-xl border text-xs font-bold transition-all hover:scale-105
                  ${preset.color.replace("bg-", "border-")} ${preset.textColor} border-white/10 hover:border-white/30 bg-white/5`}
              >
                + {preset.name}
              </button>
            ))}
          </div>

          {/* Scene pads from Smart */}
          <div className="w-64 bg-[#12141a] rounded-2xl border border-white/5 p-3 flex flex-col gap-2">
            <span className="text-[10px] text-slate-500 font-bold tracking-widest">SCÈNES ENREGISTRÉES</span>
            <div className="flex gap-2 overflow-x-auto">
              {smartPads.slice(0, 4).map((pad) => (
                <button
                  key={pad.id}
                  onClick={() => {
                    // Add to timeline at current playhead
                    addClip({
                      id: `clip-${Date.now()}-${pad.id}`,
                      track: "lights",
                      name: pad.name,
                      startTime: elapsed,
                      duration: 30000,
                      color: pad.color,
                      textColor: pad.textColor,
                      qlcPage: pad.qlcPage,
                      qlcWidget: pad.qlcWidget,
                    });
                    socket.emit("smart:trigger_scene", {
                      pageId: pad.qlcPage, widgetId: pad.qlcWidget, active: true,
                    });
                  }}
                  className={`shrink-0 w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110`}
                  title={pad.name}
                >
                  <div className={`w-4 h-4 rounded-full ${pad.color}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Hint ─── */}
        <p className="text-[9px] text-slate-600 shrink-0">
          Clic = déplacer playhead · Shift+clic règle = ajouter marqueur · Double-clic piste = ajouter clip · Clic sur preset = ajouter à la position actuelle
        </p>
      </main>

      {/* ===== MODAL: Add Clip ===== */}
      {showAddClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#12141A] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
            <h2 className="text-white font-black text-sm mb-4">Ajouter un clip à {formatTime(addClipTime)}</h2>
            <div className="grid grid-cols-2 gap-2">
              {CLIP_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddClip(idx)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all hover:scale-105 text-left
                    ${preset.color.replace("bg-", "border-")} ${preset.textColor} border-white/10 hover:border-white/30 bg-white/5`}
                >
                  <div className={`w-3 h-3 rounded-full ${preset.color} mb-1`} />
                  {preset.name}
                  <span className="block text-[9px] text-slate-500">{formatTime(preset.duration)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddClip(false)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: Add Marker ===== */}
      {showAddMarker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#12141A] border border-white/10 rounded-2xl p-5 w-80 shadow-2xl">
            <h2 className="text-white font-black text-sm mb-3 flex items-center gap-2">
              <Flag className="w-4 h-4 text-yellow-400" />
              Marqueur à {formatTime(markerTime)}
            </h2>
            <input
              autoFocus
              value={markerName}
              onChange={(e) => setMarkerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMarker()}
              placeholder="Nom du marqueur..."
              className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-3 focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddMarker}
                className="flex-1 py-2 rounded-xl bg-yellow-500 text-black font-bold text-xs hover:bg-yellow-400 transition-colors"
              >
                Ajouter
              </button>
              <button
                onClick={() => setShowAddMarker(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

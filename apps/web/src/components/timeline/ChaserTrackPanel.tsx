"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Repeat,
  ArrowRightLeft,
  Timer,
} from "lucide-react";
import useStore from "@/store/useStore";
import type { SmartPad } from "@/store/useStore";

interface ChaserStep {
  padId: number;
  duration: number; // ms
  fadeTime: number; // ms
}

interface Chaser {
  id: string;
  name: string;
  steps: ChaserStep[];
  mode: "loop" | "pingpong" | "oneshot";
  bpmSync: boolean;
}

export default function ChaserTrackPanel() {
  const { smartPads, triggerSmartPad, bpm, addClip, clips, addToast } = useStore();

  const [chasers, setChasers] = useState<Chaser[]>([]);
  const [activeChaser, setActiveChaser] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingChaser, setEditingChaser] = useState<Chaser | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directionRef = useRef<1 | -1>(1); // for pingpong

  // Playback engine
  useEffect(() => {
    if (!isPlaying || !activeChaser) return;

    const chaser = chasers.find((c) => c.id === activeChaser);
    if (!chaser || chaser.steps.length === 0) {
      setIsPlaying(false);
      return;
    }

    const step = chaser.steps[currentStep];
    if (!step) {
      setIsPlaying(false);
      return;
    }

    // Trigger the pad for this step
    const pad = smartPads.find((p) => p.id === step.padId);
    if (pad) {
      triggerSmartPad(pad);
    }

    // Calculate duration
    let dur = step.duration;
    if (chaser.bpmSync && bpm > 0) {
      const beatMs = 60000 / bpm;
      dur = beatMs * (step.duration / 1000); // duration field = number of beats * 1000
    }

    timerRef.current = setTimeout(() => {
      let nextStep = currentStep;

      if (chaser.mode === "loop") {
        nextStep = (currentStep + 1) % chaser.steps.length;
      } else if (chaser.mode === "pingpong") {
        nextStep = currentStep + directionRef.current;
        if (nextStep >= chaser.steps.length) {
          directionRef.current = -1;
          nextStep = chaser.steps.length - 2;
        } else if (nextStep < 0) {
          directionRef.current = 1;
          nextStep = 1;
        }
        if (nextStep < 0 || nextStep >= chaser.steps.length) nextStep = 0;
      } else {
        // oneshot
        if (currentStep + 1 < chaser.steps.length) {
          nextStep = currentStep + 1;
        } else {
          setIsPlaying(false);
          return;
        }
      }

      setCurrentStep(nextStep);
    }, dur);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeChaser, currentStep, chasers, smartPads, triggerSmartPad, bpm]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
    directionRef.current = 1;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const createNewChaser = () => {
    const newChaser: Chaser = {
      id: `chaser-${Date.now()}`,
      name: `Chaser ${chasers.length + 1}`,
      steps: [],
      mode: "loop",
      bpmSync: false,
    };
    setChasers((prev) => [...prev, newChaser]);
    setEditingChaser(newChaser);
    setShowEditor(true);
  };

  const deleteChaser = (id: string) => {
    if (activeChaser === id) stopPlayback();
    setChasers((prev) => prev.filter((c) => c.id !== id));
    if (editingChaser?.id === id) {
      setEditingChaser(null);
      setShowEditor(false);
    }
  };

  const addStep = (padId: number) => {
    if (!editingChaser) return;
    const updated = {
      ...editingChaser,
      steps: [
        ...editingChaser.steps,
        { padId, duration: 1000, fadeTime: 0 },
      ],
    };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const removeStep = (idx: number) => {
    if (!editingChaser) return;
    const updated = {
      ...editingChaser,
      steps: editingChaser.steps.filter((_, i) => i !== idx),
    };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const moveStep = (idx: number, direction: -1 | 1) => {
    if (!editingChaser) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= editingChaser.steps.length) return;
    const steps = [...editingChaser.steps];
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    const updated = { ...editingChaser, steps };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const updateStepDuration = (idx: number, duration: number) => {
    if (!editingChaser) return;
    const steps = [...editingChaser.steps];
    steps[idx] = { ...steps[idx], duration };
    const updated = { ...editingChaser, steps };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const updateChaserMode = (mode: Chaser["mode"]) => {
    if (!editingChaser) return;
    const updated = { ...editingChaser, mode };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const toggleBpmSync = () => {
    if (!editingChaser) return;
    const updated = { ...editingChaser, bpmSync: !editingChaser.bpmSync };
    setEditingChaser(updated);
    setChasers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const playChaser = (id: string) => {
    if (activeChaser === id && isPlaying) {
      stopPlayback();
      return;
    }
    setActiveChaser(id);
    setCurrentStep(0);
    directionRef.current = 1;
    setIsPlaying(true);
  };

  const getPadById = (id: number): SmartPad | undefined =>
    smartPads.find((p) => p.id === id);

  const addChaserToTimeline = (chaser: Chaser) => {
    if (chaser.steps.length === 0) {
      addToast({ type: "warning", message: "Chaser vide", detail: chaser.name });
      return;
    }

    let cursor = clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0) + 1000;
    chaser.steps.forEach((step, index) => {
      const pad = getPadById(step.padId);
      if (!pad) return;
      const dmxCommands = [
        ...(pad.dmxCommands || []),
        ...Object.entries(pad.dmxValues || {}).map(([channel, value]) => ({
          universe: 1,
          channel: Number(channel),
          value: Number(value),
        })),
      ];
      addClip({
        id: `chaser-${chaser.id}-${index}-${Date.now()}`,
        track: "lights",
        name: `${chaser.name.toUpperCase()} ${index + 1}`,
        startTime: cursor,
        duration: Math.max(500, step.duration),
        color: pad.color,
        textColor: pad.textColor,
        qlcPage: pad.qlcPage,
        qlcWidget: pad.qlcWidget,
        dmxCommands,
        sourceType: "chaser",
        sourceId: chaser.id,
      });
      cursor += Math.max(500, step.duration);
    });
    addToast({
      type: "success",
      message: "Chaser ajoute a la timeline",
      detail: `${chaser.steps.length} etape(s)`,
    });
  };

  return (
    <div className="bg-[#12141a] border border-[#262c36] rounded-2xl p-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-black text-sm tracking-wider flex items-center gap-2">
          <Timer className="w-4 h-4 text-green-400" />
          SÉQUENCEUR
        </h3>
        <button
          onClick={createNewChaser}
          className="text-[10px] bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
        >
          <Plus className="w-3 h-3" />
          Nouveau
        </button>
      </div>

      {/* Chaser list */}
      {chasers.length === 0 && (
        <p className="text-slate-500 text-xs text-center py-4">
          Aucun chaser. Crée-en un pour enchaîner des scènes automatiquement.
        </p>
      )}

      <div className="space-y-2">
        {chasers.map((chaser) => {
          const isActive = activeChaser === chaser.id && isPlaying;
          return (
            <div
              key={chaser.id}
              className={`bg-[#0a0c10] rounded-xl border p-3 transition-all ${isActive
                  ? "border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                  : "border-white/5"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white font-bold">
                  {chaser.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-500 font-mono">
                    {chaser.steps.length} étapes
                  </span>

                  {/* Mode indicator */}
                  <span className="text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">
                    {chaser.mode === "loop" ? "∞" : chaser.mode === "pingpong" ? "↔" : "→"}
                  </span>

                  {chaser.bpmSync && (
                    <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded font-bold">
                      BPM
                    </span>
                  )}
                </div>
              </div>

              {/* Step indicators */}
              {chaser.steps.length > 0 && (
                <div className="flex gap-0.5 mb-2">
                  {chaser.steps.map((step, i) => {
                    const pad = getPadById(step.padId);
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-1.5 rounded-full transition-all ${isActive && currentStep === i
                            ? "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                            : "bg-white/10"
                          }`}
                        title={pad?.name || `Step ${i + 1}`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-1">
                <button
                  onClick={() => playChaser(chaser.id)}
                  disabled={chaser.steps.length === 0}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${isActive
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 text-slate-400 hover:text-green-400 border border-white/5 disabled:opacity-30"
                    }`}
                >
                  {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isActive ? "Pause" : "Play"}
                </button>
                {isActive && (
                  <button
                    onClick={stopPlayback}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold transition-all"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingChaser(chaser);
                    setShowEditor(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/5 text-[10px] font-bold transition-all"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteChaser(chaser.id)}
                  className="px-2 py-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-red-400 border border-white/5 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => addChaserToTimeline(chaser)}
                  disabled={chaser.steps.length === 0}
                  className="px-2 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-[10px] font-bold transition-all disabled:opacity-30"
                  title="Ajouter dans la timeline"
                >
                  TL
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ EDITOR PANEL ═══ */}
      {showEditor && editingChaser && (
        <div className="mt-3 bg-[#0a0c10] rounded-xl border border-cyan-500/20 p-3">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={editingChaser.name}
              onChange={(e) => {
                const updated = { ...editingChaser, name: e.target.value };
                setEditingChaser(updated);
                setChasers((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                );
              }}
              className="bg-transparent text-white font-bold text-xs border-b border-white/10 focus:border-cyan-500/50 focus:outline-none px-1 py-0.5 w-32"
            />
            <button
              onClick={() => setShowEditor(false)}
              className="text-slate-500 hover:text-white text-[10px] font-bold"
            >
              Fermer
            </button>
          </div>

          {/* Mode & BPM */}
          <div className="flex gap-1 mb-3">
            {(["loop", "pingpong", "oneshot"] as const).map((m) => (
              <button
                key={m}
                onClick={() => updateChaserMode(m)}
                className={`flex-1 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1 ${editingChaser.mode === m
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                    : "bg-white/5 text-slate-500 border-white/5"
                  }`}
              >
                {m === "loop" && <Repeat className="w-3 h-3" />}
                {m === "pingpong" && <ArrowRightLeft className="w-3 h-3" />}
                {m === "oneshot" && <Play className="w-3 h-3" />}
                {m === "loop" ? "Boucle" : m === "pingpong" ? "Ping-Pong" : "Une fois"}
              </button>
            ))}
            <button
              onClick={toggleBpmSync}
              className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${editingChaser.bpmSync
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-white/5 text-slate-500 border-white/5"
                }`}
            >
              BPM
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-1 mb-3 max-h-40 overflow-y-auto custom-scrollbar">
            {editingChaser.steps.map((step, idx) => {
              const pad = getPadById(step.padId);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white/5 rounded-lg p-2"
                >
                  <span className="text-[9px] text-slate-500 font-mono w-4">
                    {idx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-bold flex-1 truncate ${pad ? "text-white" : "text-red-400"}`}
                  >
                    {pad?.name || "Scène supprimée"}
                  </span>
                  <input
                    type="number"
                    min="100"
                    max="30000"
                    step="100"
                    value={step.duration}
                    onChange={(e) =>
                      updateStepDuration(idx, parseInt(e.target.value) || 1000)
                    }
                    className="w-16 bg-black/60 border border-white/10 rounded px-1 py-0.5 text-[9px] text-cyan-400 font-mono text-center focus:outline-none focus:border-cyan-500/50"
                    title="Durée (ms)"
                  />
                  <span className="text-[8px] text-slate-600">ms</span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => moveStep(idx, -1)}
                      className="p-0.5 text-slate-500 hover:text-white"
                      disabled={idx === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveStep(idx, 1)}
                      className="p-0.5 text-slate-500 hover:text-white"
                      disabled={idx === editingChaser.steps.length - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeStep(idx)}
                      className="p-0.5 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add step from pads */}
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">
            Ajouter une scène
          </p>
          <div className="flex flex-wrap gap-1">
            {smartPads.map((pad) => (
              <button
                key={pad.id}
                onClick={() => addStep(pad.id)}
                className={`text-[9px] px-2 py-1 rounded-lg border border-white/5 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/20 text-slate-400 hover:text-cyan-400 font-bold transition-all`}
              >
                {pad.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

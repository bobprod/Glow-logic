"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, MousePointer2, PenLine, Play, Square, X } from "lucide-react";
import useStore from "../../store/useStore";
import { dmxEngine } from "../../lib/dmxEngine";
import {
  generateTrajectoryKeyframes,
  type TrajectoryDef,
  type TrajectoryPoint,
  type TrajectoryShape,
} from "../../lib/trajectoryGenerator";
import type { AutomationEasing } from "../../store/slices/timelineSlice";
import type { DmxChannel, PatchedFixture } from "../../types/dmx";

type Props = {
  fixture: PatchedFixture;
  panChannel: DmxChannel;
  tiltChannel: DmxChannel;
  panValue: number;
  tiltValue: number;
  onClose: () => void;
};

const SHAPES: Array<{ id: TrajectoryShape; label: string }> = [
  { id: "circle", label: "Cercle" },
  { id: "eight", label: "Huit" },
  { id: "sweep", label: "Sweep" },
  { id: "free", label: "Libre" },
];

const EASINGS: AutomationEasing[] = ["linear", "easeIn", "easeOut", "easeInOut", "hold"];
const BEAT_OPTIONS = [1, 2, 4, 8, 16];

function clampDmx(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function absChannel(fixture: PatchedFixture, channel: DmxChannel) {
  return Number(fixture.startAddress || fixture.start_address || 1) + Number(channel.channel || 1) - 1;
}

function pointToCanvas(point: TrajectoryPoint, size: number) {
  return {
    x: (clampDmx(point.pan) / 255) * size,
    y: (clampDmx(point.tilt) / 255) * size,
  };
}

function canvasToPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): TrajectoryPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    pan: clampDmx(((event.clientX - rect.left) / rect.width) * 255),
    tilt: clampDmx(((event.clientY - rect.top) / rect.height) * 255),
  };
}

function valueAt(keyframes: Array<{ timeMs: number; value: number }>, elapsed: number) {
  if (keyframes.length === 0) return 0;
  const nextIndex = keyframes.findIndex((keyframe) => keyframe.timeMs >= elapsed);
  if (nextIndex <= 0) return keyframes[0].value;
  const previous = keyframes[nextIndex - 1];
  const next = keyframes[nextIndex] || keyframes[keyframes.length - 1];
  const span = Math.max(1, next.timeMs - previous.timeMs);
  const progress = Math.max(0, Math.min(1, (elapsed - previous.timeMs) / span));
  return Math.round(previous.value + (next.value - previous.value) * progress);
}

export default function TrajectoryEditor({ fixture, panChannel, tiltChannel, panValue, tiltValue, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const testRafRef = useRef<number | null>(null);
  const drawingRef = useRef(false);
  const { bpm, playheadMs, getOrCreateAutomationTrack, recordKeyframeBatch, addToast } = useStore();

  const [shape, setShape] = useState<TrajectoryShape>("circle");
  const [center, setCenter] = useState<TrajectoryPoint>({ pan: panValue || 127, tilt: tiltValue || 127 });
  const [amplitudePan, setAmplitudePan] = useState(60);
  const [amplitudeTilt, setAmplitudeTilt] = useState(40);
  const [phaseDeg, setPhaseDeg] = useState(0);
  const [clockwise, setClockwise] = useState(true);
  const [syncBpm, setSyncBpm] = useState(true);
  const [beats, setBeats] = useState(4);
  const [seconds, setSeconds] = useState(4);
  const [repetitions, setRepetitions] = useState(1);
  const [pointA, setPointA] = useState<TrajectoryPoint>({ pan: Math.max(0, center.pan - 60), tilt: center.tilt });
  const [pointB, setPointB] = useState<TrajectoryPoint>({ pan: Math.min(255, center.pan + 60), tilt: center.tilt });
  const [editingSweepPoint, setEditingSweepPoint] = useState<"a" | "b">("a");
  const [roundTrip, setRoundTrip] = useState(true);
  const [easing, setEasing] = useState<AutomationEasing>("linear");
  const [freePoints, setFreePoints] = useState<TrajectoryPoint[]>([]);
  const [testing, setTesting] = useState(false);

  const universe = Number(fixture.universe || 1);
  const panAbs = absChannel(fixture, panChannel);
  const tiltAbs = absChannel(fixture, tiltChannel);
  const cycleDurationMs = syncBpm ? Math.round(beats * 60000 / Math.max(1, bpm || 120)) : Math.round(seconds * 1000);

  const trajectoryDef = useMemo<TrajectoryDef>(() => ({
    shape,
    centerPan: center.pan,
    centerTilt: center.tilt,
    amplitudePan,
    amplitudeTilt,
    cycleDurationMs,
    phaseDeg,
    clockwise,
    repetitions,
    pointA,
    pointB,
    roundTrip,
    easing,
    freePoints,
  }), [amplitudePan, amplitudeTilt, center, clockwise, cycleDurationMs, easing, freePoints, phaseDeg, pointA, pointB, repetitions, roundTrip, shape]);

  const preview = useMemo(() => generateTrajectoryKeyframes({ ...trajectoryDef, repetitions: 1 }, 0), [trajectoryDef]);

  const draw = useCallback((previewElapsed: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#08090c";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(148,163,184,0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const pos = (i / 4) * size;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(34,211,238,0.45)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const points = preview.pan.map((pan, index) => ({ pan: pan.value, tilt: preview.tilt[index]?.value ?? 127 }));
    if (points.length > 0) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((point, index) => {
        const canvasPoint = pointToCanvas(point, size);
        if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
        else ctx.lineTo(canvasPoint.x, canvasPoint.y);
      });
      ctx.stroke();
    }

    if (shape === "sweep") {
      for (const [label, point] of [["A", pointA], ["B", pointB]] as const) {
        const canvasPoint = pointToCanvas(point, size);
        ctx.fillStyle = label === editingSweepPoint.toUpperCase() ? "#f59e0b" : "#a78bfa";
        ctx.beginPath();
        ctx.arc(canvasPoint.x, canvasPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#020617";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, canvasPoint.x, canvasPoint.y + 0.5);
      }
    } else if (shape !== "free") {
      const canvasPoint = pointToCanvas(center, size);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvasPoint.x, canvasPoint.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const duration = Math.max(1, cycleDurationMs);
    const elapsed = previewElapsed % duration;
    const active = {
      pan: valueAt(preview.pan, elapsed),
      tilt: valueAt(preview.tilt, elapsed),
    };
    const activeCanvas = pointToCanvas(active, size);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(activeCanvas.x, activeCanvas.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [center, cycleDurationMs, editingSweepPoint, pointA, pointB, preview, shape]);

  useEffect(() => {
    const startedAt = performance.now();
    const tick = () => {
      draw(performance.now() - startedAt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => () => {
    if (testRafRef.current !== null) cancelAnimationFrame(testRafRef.current);
  }, []);

  const updateFromPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = canvasToPoint(event, canvas);
    if (shape === "sweep") {
      if (editingSweepPoint === "a") setPointA(point);
      else setPointB(point);
    } else if (shape === "free") {
      setFreePoints((points) => [...points, point].slice(-160));
    } else {
      setCenter(point);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (shape === "free") setFreePoints([canvasToPoint(event, event.currentTarget)]);
    else updateFromPointer(event);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    updateFromPointer(event);
  };

  const onPointerUp = () => {
    drawingRef.current = false;
    if (shape === "sweep") setEditingSweepPoint((point) => (point === "a" ? "b" : "a"));
  };

  const stopTest = () => {
    if (testRafRef.current !== null) cancelAnimationFrame(testRafRef.current);
    testRafRef.current = null;
    setTesting(false);
  };

  const testTrajectory = () => {
    if (testing) {
      stopTest();
      return;
    }
    const generated = generateTrajectoryKeyframes({ ...trajectoryDef, repetitions: 1 }, 0);
    const startedAt = performance.now();
    const duration = Math.max(1, cycleDurationMs);
    setTesting(true);
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      dmxEngine.setChannel(universe, panAbs, valueAt(generated.pan, elapsed), { source: "manual", lockMs: 0 });
      dmxEngine.setChannel(universe, tiltAbs, valueAt(generated.tilt, elapsed), { source: "manual", lockMs: 0 });
      if (elapsed >= duration) {
        stopTest();
        return;
      }
      testRafRef.current = requestAnimationFrame(tick);
    };
    testRafRef.current = requestAnimationFrame(tick);
  };

  const insertTrajectory = () => {
    const startMs = Math.max(0, Math.round(playheadMs));
    const generated = generateTrajectoryKeyframes(trajectoryDef, startMs);
    const totalDurationMs = cycleDurationMs * Math.max(1, Math.min(64, repetitions));
    const fixtureKey = fixture.nodeId || String(fixture.id);
    const panTrackId = getOrCreateAutomationTrack(fixtureKey, "pan", {
      label: `${fixture.name} Pan`,
      universe,
      channel: panAbs,
      color: "#22d3ee",
    });
    const tiltTrackId = getOrCreateAutomationTrack(fixtureKey, "tilt", {
      label: `${fixture.name} Tilt`,
      universe,
      channel: tiltAbs,
      color: "#a78bfa",
    });
    recordKeyframeBatch(panTrackId, generated.pan, { fromMs: startMs, toMs: startMs + totalDurationMs });
    recordKeyframeBatch(tiltTrackId, generated.tilt, { fromMs: startMs, toMs: startMs + totalDurationMs });
    addToast({
      type: "success",
      message: `Trajectoire ${SHAPES.find((item) => item.id === shape)?.label || shape} inseree`,
      detail: `${generated.pan.length + generated.tilt.length} keyframes sur ${Math.round(totalDurationMs / 100) / 10}s`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-[640px] rounded-lg border border-white/10 bg-[#0c0e12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white">
              <PenLine className="mr-2 inline h-4 w-4 text-cyan-300" />
              Trajectoire - {fixture.name}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Fige au BPM courant ({Math.round(bpm || 120)}) lors de l'insertion.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[minmax(260px,1fr)_240px]">
          <div className="space-y-3">
            <div role="tablist" className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
              {SHAPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={shape === item.id}
                  onClick={() => setShape(item.id)}
                  className={`rounded-md px-2 py-2 text-[10px] font-black uppercase tracking-widest ${shape === item.id ? "bg-cyan-500/20 text-cyan-200" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="aspect-square w-full rounded-lg border border-white/10 bg-black touch-none"
              aria-label="Canvas trajectoire Pan Tilt"
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <MousePointer2 className="h-3.5 w-3.5" />
              {shape === "free" ? "Dessine le trace libre." : shape === "sweep" ? `Place le point ${editingSweepPoint.toUpperCase()}.` : "Glisse pour deplacer le centre."}
            </div>
          </div>

          <div className="space-y-3">
            {(shape === "circle" || shape === "eight") && (
              <>
                <Range label="Amplitude pan" min={0} max={127} value={amplitudePan} onChange={setAmplitudePan} />
                <Range label="Amplitude tilt" min={0} max={127} value={amplitudeTilt} onChange={setAmplitudeTilt} />
                <Range label="Phase" min={0} max={360} value={phaseDeg} onChange={setPhaseDeg} suffix="deg" />
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">
                  Sens
                  <select value={clockwise ? "cw" : "ccw"} onChange={(event) => setClockwise(event.target.value === "cw")} className="bg-black text-white">
                    <option value="cw">Horaire</option>
                    <option value="ccw">Antihoraire</option>
                  </select>
                </label>
              </>
            )}

            {shape === "sweep" && (
              <>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">
                  Aller-retour
                  <input type="checkbox" checked={roundTrip} onChange={(event) => setRoundTrip(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">
                  Easing
                  <select value={easing} onChange={(event) => setEasing(event.target.value as AutomationEasing)} className="bg-black text-white">
                    {EASINGS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </>
            )}

            {shape === "free" && (
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-slate-400">
                Points libres: <span className="font-mono text-cyan-300">{freePoints.length}</span>
              </div>
            )}

            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">
              Synchro BPM
              <input type="checkbox" checked={syncBpm} onChange={(event) => setSyncBpm(event.target.checked)} />
            </label>

            {syncBpm ? (
              <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">
                Duree
                <select value={beats} onChange={(event) => setBeats(Number(event.target.value))} className="bg-black text-white">
                  {BEAT_OPTIONS.map((beatCount) => <option key={beatCount} value={beatCount}>{beatCount} temps</option>)}
                </select>
              </label>
            ) : (
              <Range label="Secondes" min={0.5} max={30} step={0.5} value={seconds} onChange={setSeconds} suffix="s" />
            )}

            <Range label="Repetitions" min={1} max={64} value={repetitions} onChange={setRepetitions} />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={testTrajectory}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${testing ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-white/10 bg-black/30 text-slate-200 hover:bg-white/5"}`}
              >
                {testing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {testing ? "Stop" : "Tester"}
              </button>
              <button
                type="button"
                onClick={insertTrajectory}
                className="flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/25"
              >
                <Download className="h-4 w-4" />
                Inserer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  step = 1,
  value,
  suffix = "",
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-400">{label}</span>
        <span className="font-mono text-cyan-300">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-400"
        aria-label={label}
      />
    </label>
  );
}

import { simplifyKeyframes } from "./simplifyKeyframes";
import type { AutomationEasing } from "../store/slices/timelineSlice";

export type TrajectoryShape = "circle" | "eight" | "sweep" | "free";

export interface TrajectoryPoint {
  pan: number;
  tilt: number;
}

export interface TrajectoryDef {
  shape: TrajectoryShape;
  centerPan: number;
  centerTilt: number;
  amplitudePan: number;
  amplitudeTilt: number;
  cycleDurationMs: number;
  phaseDeg: number;
  clockwise: boolean;
  repetitions: number;
  pointA?: TrajectoryPoint;
  pointB?: TrajectoryPoint;
  roundTrip?: boolean;
  easing?: AutomationEasing;
  freePoints?: TrajectoryPoint[];
}

export type GeneratedTrajectory = {
  pan: Array<{ timeMs: number; value: number; easing?: AutomationEasing }>;
  tilt: Array<{ timeMs: number; value: number; easing?: AutomationEasing }>;
};

function clampDmx(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampRepetitions(value: number) {
  return Math.max(1, Math.min(64, Math.round(value || 1)));
}

function clampDuration(value: number) {
  return Math.max(100, Math.round(value || 1000));
}

function pointAt(def: TrajectoryDef, progress: number): TrajectoryPoint {
  const direction = def.clockwise ? 1 : -1;
  const phase = (def.phaseDeg * Math.PI) / 180;
  const angle = direction * progress * Math.PI * 2 + phase;

  if (def.shape === "eight") {
    return {
      pan: clampDmx(def.centerPan + def.amplitudePan * Math.sin(angle)),
      tilt: clampDmx(def.centerTilt + def.amplitudeTilt * Math.sin(direction * progress * Math.PI * 4)),
    };
  }

  return {
    pan: clampDmx(def.centerPan + def.amplitudePan * Math.cos(angle)),
    tilt: clampDmx(def.centerTilt + def.amplitudeTilt * Math.sin(angle)),
  };
}

function appendPoint(output: GeneratedTrajectory, timeMs: number, point: TrajectoryPoint, easing?: AutomationEasing) {
  output.pan.push({ timeMs, value: clampDmx(point.pan), easing });
  output.tilt.push({ timeMs, value: clampDmx(point.tilt), easing });
}

function generateLoop(def: TrajectoryDef, startMs: number, output: GeneratedTrajectory) {
  const repetitions = clampRepetitions(def.repetitions);
  const cycleDurationMs = clampDuration(def.cycleDurationMs);
  const totalSamples = 16 * repetitions;
  for (let index = 0; index <= totalSamples; index += 1) {
    const cycleProgress = (index % 16) / 16;
    const timeMs = startMs + Math.round((index / 16) * cycleDurationMs);
    appendPoint(output, timeMs, pointAt(def, cycleProgress), "linear");
  }
}

function interpolate(a: TrajectoryPoint, b: TrajectoryPoint, progress: number): TrajectoryPoint {
  return {
    pan: a.pan + (b.pan - a.pan) * progress,
    tilt: a.tilt + (b.tilt - a.tilt) * progress,
  };
}

function generateSweep(def: TrajectoryDef, startMs: number, output: GeneratedTrajectory) {
  const repetitions = clampRepetitions(def.repetitions);
  const cycleDurationMs = clampDuration(def.cycleDurationMs);
  const pointA = def.pointA || { pan: def.centerPan - def.amplitudePan, tilt: def.centerTilt };
  const pointB = def.pointB || { pan: def.centerPan + def.amplitudePan, tilt: def.centerTilt };
  const easing = def.easing || "linear";

  for (let repeat = 0; repeat < repetitions; repeat += 1) {
    const base = startMs + repeat * cycleDurationMs;
    appendPoint(output, base, pointA, easing);
    if (def.roundTrip) {
      appendPoint(output, base + Math.round(cycleDurationMs / 2), pointB, easing);
      appendPoint(output, base + cycleDurationMs, pointA, easing);
    } else {
      appendPoint(output, base + cycleDurationMs, pointB, easing);
    }
  }
}

function resampleFreePoints(points: TrajectoryPoint[], count: number): TrajectoryPoint[] {
  if (points.length <= 2) return points;
  const distances = points.map((point, index) => {
    if (index === 0) return 0;
    const previous = points[index - 1];
    return Math.hypot(point.pan - previous.pan, point.tilt - previous.tilt);
  });
  const cumulative = distances.reduce<number[]>((acc, distance) => {
    acc.push((acc.at(-1) || 0) + distance);
    return acc;
  }, []);
  const total = cumulative.at(-1) || 1;
  return Array.from({ length: count }, (_, index) => {
    const target = (index / Math.max(1, count - 1)) * total;
    const nextIndex = cumulative.findIndex((distance) => distance >= target);
    const pointIndex = Math.max(1, nextIndex === -1 ? points.length - 1 : nextIndex);
    const prevDistance = cumulative[pointIndex - 1] || 0;
    const nextDistance = cumulative[pointIndex] || total;
    const segmentProgress = nextDistance === prevDistance ? 0 : (target - prevDistance) / (nextDistance - prevDistance);
    return interpolate(points[pointIndex - 1], points[pointIndex], segmentProgress);
  });
}

function generateFree(def: TrajectoryDef, startMs: number, output: GeneratedTrajectory) {
  const repetitions = clampRepetitions(def.repetitions);
  const cycleDurationMs = clampDuration(def.cycleDurationMs);
  const rawPoints = (def.freePoints || []).filter((point) => Number.isFinite(point.pan) && Number.isFinite(point.tilt));
  const sourcePoints = rawPoints.length >= 2
    ? rawPoints
    : [
        { pan: def.centerPan - def.amplitudePan, tilt: def.centerTilt },
        { pan: def.centerPan + def.amplitudePan, tilt: def.centerTilt },
      ];
  const resampled = resampleFreePoints(sourcePoints, Math.max(2, Math.min(96, sourcePoints.length)));

  for (let repeat = 0; repeat < repetitions; repeat += 1) {
    const base = startMs + repeat * cycleDurationMs;
    const pan = simplifyKeyframes(resampled.map((point, index) => ({
      timeMs: base + Math.round((index / Math.max(1, resampled.length - 1)) * cycleDurationMs),
      value: clampDmx(point.pan),
    })), 2);
    const tilt = simplifyKeyframes(resampled.map((point, index) => ({
      timeMs: base + Math.round((index / Math.max(1, resampled.length - 1)) * cycleDurationMs),
      value: clampDmx(point.tilt),
    })), 2);
    output.pan.push(...pan.map((keyframe) => ({ ...keyframe, easing: "linear" as const })));
    output.tilt.push(...tilt.map((keyframe) => ({ ...keyframe, easing: "linear" as const })));
  }
}

export function generateTrajectoryKeyframes(def: TrajectoryDef, startMs: number): GeneratedTrajectory {
  const output: GeneratedTrajectory = { pan: [], tilt: [] };
  if (def.shape === "circle" || def.shape === "eight") {
    generateLoop(def, startMs, output);
  } else if (def.shape === "sweep") {
    generateSweep(def, startMs, output);
  } else {
    generateFree(def, startMs, output);
  }
  return output;
}

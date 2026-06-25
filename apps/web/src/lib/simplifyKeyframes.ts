export type KeyframePoint = {
  timeMs: number;
  value: number;
};

function normalizedDistance(point: KeyframePoint, start: KeyframePoint, end: KeyframePoint) {
  const span = Math.max(1, end.timeMs - start.timeMs);
  const x = ((point.timeMs - start.timeMs) / span) * 255;
  const x1 = 0;
  const y1 = start.value;
  const x2 = 255;
  const y2 = end.value;
  const numerator = Math.abs((y2 - y1) * x - (x2 - x1) * point.value + x2 * y1 - y2 * x1);
  const denominator = Math.hypot(y2 - y1, x2 - x1);
  return denominator === 0 ? Math.abs(point.value - start.value) : numerator / denominator;
}

function simplifySegment(points: KeyframePoint[], epsilon: number): KeyframePoint[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = normalizedDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= epsilon) return [first, last];

  const left = simplifySegment(points.slice(0, index + 1), epsilon);
  const right = simplifySegment(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

export function simplifyKeyframes(points: KeyframePoint[], epsilon = 2): KeyframePoint[] {
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.timeMs) && Number.isFinite(point.value))
    .sort((a, b) => a.timeMs - b.timeMs);
  if (sorted.length <= 2) return sorted;

  const deduped = sorted.reduce<KeyframePoint[]>((acc, point) => {
    const previous = acc[acc.length - 1];
    if (previous && previous.timeMs === point.timeMs) {
      acc[acc.length - 1] = point;
    } else {
      acc.push(point);
    }
    return acc;
  }, []);

  return simplifySegment(deduped, epsilon);
}

export type StageGridPosition = {
  x: number;
  y: number;
  z: number;
};

export type StageWorldSize = {
  width: number;
  depth: number;
};

const DEFAULT_STAGE_SIZE: StageWorldSize = { width: 20, depth: 14 };

export function clampStagePercent(value: unknown, fallback = 50) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, numeric));
}

export function normalizeStageGridPosition(position: Partial<StageGridPosition> | null | undefined): StageGridPosition {
  return {
    x: clampStagePercent(position?.x),
    y: clampStagePercent(position?.y),
    z: typeof position?.z === "number" && Number.isFinite(position.z) ? position.z : 0,
  };
}

export function stagePlanToWorld(
  position: Partial<StageGridPosition> | null | undefined,
  size: Partial<StageWorldSize> = DEFAULT_STAGE_SIZE,
) {
  const grid = normalizeStageGridPosition(position);
  const width = typeof size.width === "number" && Number.isFinite(size.width) ? size.width : DEFAULT_STAGE_SIZE.width;
  const depth = typeof size.depth === "number" && Number.isFinite(size.depth) ? size.depth : DEFAULT_STAGE_SIZE.depth;

  return {
    x: ((grid.x - 50) * width) / 100,
    y: grid.z ?? 0,
    z: ((grid.y - 50) * depth) / 100,
  };
}

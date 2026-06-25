/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { generateTrajectoryKeyframes } = require("../src/lib/trajectoryGenerator");

const result = generateTrajectoryKeyframes({
  shape: "circle",
  centerPan: 127,
  centerTilt: 127,
  amplitudePan: 60,
  amplitudeTilt: 40,
  cycleDurationMs: 1875,
  phaseDeg: 0,
  clockwise: true,
  repetitions: 2,
}, 1000);

assert.equal(result.pan.length, 33);
assert.equal(result.tilt.length, 33);
assert.deepEqual(result.pan[0], { timeMs: 1000, value: 187, easing: "linear" });
assert.deepEqual(result.tilt[0], { timeMs: 1000, value: 127, easing: "linear" });
assert.equal(result.pan.at(-1)?.timeMs, 4750);
assert.ok(result.pan.every((keyframe) => keyframe.value >= 0 && keyframe.value <= 255));
assert.ok(result.tilt.every((keyframe) => keyframe.value >= 0 && keyframe.value <= 255));

const sweep = generateTrajectoryKeyframes({
  shape: "sweep",
  centerPan: 127,
  centerTilt: 127,
  amplitudePan: 60,
  amplitudeTilt: 40,
  cycleDurationMs: 1000,
  phaseDeg: 0,
  clockwise: true,
  repetitions: 1,
  pointA: { pan: 10, tilt: 20 },
  pointB: { pan: 200, tilt: 220 },
  roundTrip: true,
  easing: "easeInOut",
}, 0);

assert.equal(sweep.pan.length, 3);
assert.deepEqual(sweep.pan.map((keyframe) => keyframe.value), [10, 200, 10]);
assert.ok(sweep.pan.every((keyframe) => keyframe.easing === "easeInOut"));

console.log("trajectoryGenerator tests passed");

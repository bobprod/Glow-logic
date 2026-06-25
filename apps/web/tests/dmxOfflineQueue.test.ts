/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { DmxOfflineQueue } = require("../src/lib/dmxOfflineQueue");

const queue = new DmxOfflineQueue();

queue.queue(1, 1, 10, 1000);
queue.queue(1, 1, 240, 1001);
queue.queue(1, 2, 999, 1002);

assert.equal(queue.status().pending, 2);
assert.equal(queue.status().lastQueuedAt, 1002);

const serialized = queue.toSerialized();
assert.equal(serialized.version, 1);
assert.equal(serialized.writes.length, 2);
assert.deepEqual(serialized.writes.find((write) => write.channel === 1), {
  universe: 1,
  channel: 1,
  value: 240,
  at: 1001,
});
assert.deepEqual(serialized.writes.find((write) => write.channel === 2), {
  universe: 1,
  channel: 2,
  value: 255,
  at: 1002,
});

const restored = new DmxOfflineQueue();
restored.replaceFromSerialized(serialized);
assert.deepEqual(restored.status(), {
  pending: 2,
  lastQueuedAt: 1002,
  lastFlushedAt: null,
});

const drained = restored.drain(2000);
assert.equal(drained.length, 2);
assert.deepEqual(restored.status(), {
  pending: 0,
  lastQueuedAt: 1002,
  lastFlushedAt: 2000,
});

const sanitized = new DmxOfflineQueue();
sanitized.replaceFromSerialized({
  version: 1,
  writes: [
    { universe: -4, channel: 900, value: -1, at: Number.NaN },
    { universe: 2, channel: 3, value: 127.6, at: 3000 },
  ],
  lastQueuedAt: "bad",
  lastFlushedAt: 2500,
});

const sanitizedDrained = sanitized.drain(4000);
assert.equal(sanitizedDrained.length, 2);
assert.deepEqual(
  sanitizedDrained.map(({ universe, channel, value }) => ({ universe, channel, value })),
  [
    { universe: 1, channel: 512, value: 0 },
    { universe: 2, channel: 3, value: 128 },
  ],
);
assert.equal(Number.isFinite(sanitizedDrained[0].at), true);
assert.equal(sanitizedDrained[1].at, 3000);
assert.equal(sanitized.status().lastFlushedAt, 4000);

sanitized.replaceFromSerialized({ version: 1, writes: "bad" });
assert.equal(sanitized.status().pending, 0);

console.log("dmxOfflineQueue tests passed");

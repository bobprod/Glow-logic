export type DmxQueuedWrite = {
  universe: number;
  channel: number;
  value: number;
  at: number;
};

export type DmxOfflineQueueStatus = {
  pending: number;
  lastQueuedAt: number | null;
  lastFlushedAt: number | null;
};

export type SerializedDmxOfflineQueue = {
  version: 1;
  writes: DmxQueuedWrite[];
  lastQueuedAt: number | null;
  lastFlushedAt: number | null;
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const nullableTime = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export class DmxOfflineQueue {
  private writes = new Map<string, DmxQueuedWrite>();
  private lastQueuedAt: number | null = null;
  private lastFlushedAt: number | null = null;

  queue(universe: number, channel: number, value: number, at = Date.now()) {
    const write: DmxQueuedWrite = {
      universe: clampInt(universe, 1, Number.MAX_SAFE_INTEGER, 1),
      channel: clampInt(channel, 1, 512, 1),
      value: clampInt(value, 0, 255, 0),
      at: clampInt(at, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    };

    this.writes.set(this.channelKey(write.universe, write.channel), write);
    this.lastQueuedAt = write.at;
    return write;
  }

  replaceFromSerialized(serialized: unknown) {
    this.writes.clear();
    this.lastQueuedAt = null;
    this.lastFlushedAt = null;

    if (!this.isSerializedQueue(serialized)) return;

    serialized.writes.forEach((write) => {
      this.queue(write.universe, write.channel, write.value, write.at);
    });

    this.lastQueuedAt = nullableTime(serialized.lastQueuedAt);
    this.lastFlushedAt = nullableTime(serialized.lastFlushedAt);
  }

  toSerialized(): SerializedDmxOfflineQueue {
    return {
      version: 1,
      writes: Array.from(this.writes.values()),
      lastQueuedAt: this.lastQueuedAt,
      lastFlushedAt: this.lastFlushedAt,
    };
  }

  drain(markFlushedAt = Date.now()) {
    const drained = Array.from(this.writes.values());
    if (drained.length === 0) return drained;

    this.writes.clear();
    this.lastFlushedAt = clampInt(markFlushedAt, 0, Number.MAX_SAFE_INTEGER, Date.now());
    return drained;
  }

  status(): DmxOfflineQueueStatus {
    return {
      pending: this.writes.size,
      lastQueuedAt: this.lastQueuedAt,
      lastFlushedAt: this.lastFlushedAt,
    };
  }

  private channelKey(universe: number, channel: number) {
    return `${universe}:${channel}`;
  }

  private isSerializedQueue(value: unknown): value is SerializedDmxOfflineQueue {
    if (typeof value !== 'object' || value === null) return false;
    const queue = value as Partial<SerializedDmxOfflineQueue>;
    return queue.version === 1 && Array.isArray(queue.writes);
  }
}

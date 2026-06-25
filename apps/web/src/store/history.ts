export interface HistoryEntry {
  id: string;
  label: string;
  at: number;
  undo: () => void;
  redo: () => void;
  coalesceKey?: string;
}

type HistoryInput = Omit<HistoryEntry, "id" | "at"> & {
  coalesceMs?: number;
};

const MAX_HISTORY = 100;
let past: HistoryEntry[] = [];
let future: HistoryEntry[] = [];
let lockDepth: number | null = null;
let replaying = false;

function makeEntry(entry: HistoryInput): HistoryEntry {
  return {
    ...entry,
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
}

export function isReplayingHistory() {
  return replaying;
}

export function pushHistory(entry: HistoryInput) {
  if (replaying) return;
  const previous = past[past.length - 1];
  if (
    entry.coalesceKey &&
    previous?.coalesceKey === entry.coalesceKey &&
    Date.now() - previous.at < (entry.coalesceMs ?? 600)
  ) {
    past = [
      ...past.slice(0, -1),
      { ...previous, label: entry.label, at: Date.now(), redo: entry.redo },
    ];
    future = [];
    return;
  }
  past = [...past.slice(-(MAX_HISTORY - 1)), makeEntry(entry)];
  future = [];
}

export function undoHistory() {
  if (lockDepth !== null && past.length <= lockDepth) return null;
  const entry = past[past.length - 1];
  if (!entry) return null;
  replaying = true;
  try {
    entry.undo();
  } finally {
    replaying = false;
  }
  past = past.slice(0, -1);
  future = [entry, ...future].slice(0, MAX_HISTORY);
  return entry;
}

export function redoHistory() {
  const entry = future[0];
  if (!entry) return null;
  replaying = true;
  try {
    entry.redo();
  } finally {
    replaying = false;
  }
  future = future.slice(1);
  past = [...past, entry].slice(-MAX_HISTORY);
  return entry;
}

export function clearHistory() {
  past = [];
  future = [];
  lockDepth = null;
}

export function setHistoryLock(locked: boolean) {
  lockDepth = locked ? past.length : null;
}

export function getHistoryState() {
  return {
    canUndo: past.length > 0 && (lockDepth === null || past.length > lockDepth),
    canRedo: future.length > 0,
    undoDepth: past.length,
    redoDepth: future.length,
    lockDepth,
  };
}

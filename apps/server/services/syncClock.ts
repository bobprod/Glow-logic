import { getSetting, setSetting } from "./database";
import { addSupportLog } from "./supportLog";

export type SyncSource = "manual" | "midi_clock" | "ableton_link" | "os2l" | "virtualdj" | "serato" | "rekordbox";

export interface SyncClockConfig {
  enabled: boolean;
  trustExternalBpm: boolean;
  source: SyncSource;
}

export interface SyncClockState extends SyncClockConfig {
  bpm: number;
  phase: number;
  beat: number;
  lastSeenAt: string | null;
  confidence: number;
  online: boolean;
}

const DEFAULT_BPM = 128;
const OFFLINE_AFTER_MS = 5000;

let bpm = DEFAULT_BPM;
let phase = 0;
let beat = 0;
let confidence = 0;
let lastSeenAt: string | null = null;

function isSyncSource(value: unknown): value is SyncSource {
  return ["manual", "midi_clock", "ableton_link", "os2l", "virtualdj", "serato", "rekordbox"].includes(String(value));
}

function readBool(key: string, fallback: boolean) {
  const value = getSetting(key);
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

export function getSyncClockConfig(): SyncClockConfig {
  const savedSource = getSetting("sync_clock_source");
  return {
    enabled: readBool("sync_clock_enabled", false),
    trustExternalBpm: readBool("sync_clock_trust_external_bpm", true),
    source: isSyncSource(savedSource) ? savedSource : "manual",
  };
}

export function setSyncClockConfig(input: Partial<SyncClockConfig>) {
  if (input.enabled !== undefined) setSetting("sync_clock_enabled", input.enabled ? "1" : "0");
  if (input.trustExternalBpm !== undefined) {
    setSetting("sync_clock_trust_external_bpm", input.trustExternalBpm ? "1" : "0");
  }
  if (input.source !== undefined && isSyncSource(input.source)) {
    setSetting("sync_clock_source", input.source);
  }
  addSupportLog("SYNC", "Configuration sync mise a jour", "info", { ...getSyncClockConfig() });
  return getSyncClockState();
}

export function getSyncClockState(): SyncClockState {
  const config = getSyncClockConfig();
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  return {
    ...config,
    bpm,
    phase,
    beat,
    lastSeenAt,
    confidence,
    online: Boolean(lastSeenMs && Date.now() - lastSeenMs < OFFLINE_AFTER_MS),
  };
}

export function ingestSyncClock(input: {
  bpm?: number;
  phase?: number;
  source?: SyncSource;
  confidence?: number;
}) {
  const config = getSyncClockConfig();
  const nextBpm = Number(input.bpm);
  if (Number.isFinite(nextBpm)) {
    bpm = Math.max(20, Math.min(300, nextBpm));
  }
  const nextPhase = Number(input.phase);
  phase = Number.isFinite(nextPhase) ? Math.max(0, Math.min(1, nextPhase)) : phase;
  confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 1)));
  beat += 1;
  lastSeenAt = new Date().toISOString();

  if (input.source && isSyncSource(input.source) && input.source !== config.source) {
    setSetting("sync_clock_source", input.source);
  }

  const state = getSyncClockState();
  addSupportLog("SYNC", `BPM externe ${state.bpm.toFixed(1)} (${state.source})`, "info", {
    bpm: state.bpm,
    source: state.source,
    confidence: state.confidence,
  });
  return state;
}

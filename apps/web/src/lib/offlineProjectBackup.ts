"use client";

export const OFFLINE_PROJECT_BACKUP_KEY = "glow-logic-offline-project-backup";
export const OFFLINE_PROJECT_BACKUP_INTERVAL_MS = 15000;
const OFFLINE_PROJECT_BACKUP_VERSION = 1;

const BACKUP_FIELDS = [
  "nodes",
  "edges",
  "appMode",
  "proView",
  "smartSidebarPanel",
  "showLock",
  "laserArmed",
  "pyroArmed",
  "dmxOutputs",
  "networkState",
  "smartBlackout",
  "blackout",
  "masterDimmer",
  "smartAutoPilot",
  "smartActiveScene",
  "smartZoneValues",
  "smartZoneMappings",
  "smartPads",
  "smartWidgets",
  "smartPadColumns",
  "activePadPage",
  "smartPadViewMode",
  "stagePlanHidden",
  "midiMappings",
  "currentProjectName",
  "clips",
  "markers",
  "automationTracks",
  "duration",
  "zoom",
  "viewStart",
  "playlist",
  "currentTrackIndex",
  "isPlaying",
  "dmxGroups",
  "groupPresets",
  "groupLevels",
  "groupMutes",
  "groupColors",
  "masterVolume",
  "audioSource",
] as const;

export type OfflineProjectBackupMeta = {
  version: number;
  updatedAt: number;
  projectName: string | null;
  pads: number;
  clips: number;
  fixtures: number;
};

export type OfflineProjectBackup = OfflineProjectBackupMeta & {
  state: Record<string, unknown>;
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function buildOfflineProjectBackup(storeState: Record<string, unknown>): OfflineProjectBackup {
  const state = BACKUP_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = storeState[field];
    return acc;
  }, {});
  const pads = asList(state.smartPads);
  const clips = asList(state.clips);
  const fixtures = asList(storeState.fixtures);
  const projectName = typeof state.currentProjectName === "string" ? state.currentProjectName : null;

  return {
    version: OFFLINE_PROJECT_BACKUP_VERSION,
    updatedAt: Date.now(),
    projectName,
    pads: pads.length,
    clips: clips.length,
    fixtures: fixtures.length,
    state,
  };
}

export function saveOfflineProjectBackup(storeState: Record<string, unknown>) {
  if (!hasLocalStorage()) return null;
  const backup = buildOfflineProjectBackup(storeState);
  try {
    window.localStorage.setItem(OFFLINE_PROJECT_BACKUP_KEY, JSON.stringify(backup));
    window.dispatchEvent(new CustomEvent("glowlogic:offline-backup", { detail: readOfflineProjectBackupMeta() }));
    return backup;
  } catch {
    return null;
  }
}

export function readOfflineProjectBackup(): OfflineProjectBackup | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_PROJECT_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineProjectBackup>;
    if (parsed.version !== OFFLINE_PROJECT_BACKUP_VERSION || typeof parsed.updatedAt !== "number" || !parsed.state) {
      return null;
    }
    return {
      version: parsed.version,
      updatedAt: parsed.updatedAt,
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : null,
      pads: Number(parsed.pads || 0),
      clips: Number(parsed.clips || 0),
      fixtures: Number(parsed.fixtures || 0),
      state: parsed.state,
    };
  } catch {
    return null;
  }
}

export function readOfflineProjectBackupMeta(): OfflineProjectBackupMeta | null {
  const backup = readOfflineProjectBackup();
  if (!backup) return null;
  return {
    version: backup.version,
    updatedAt: backup.updatedAt,
    projectName: backup.projectName,
    pads: backup.pads,
    clips: backup.clips,
    fixtures: backup.fixtures,
  };
}

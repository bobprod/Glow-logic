"use client";

import { useEffect, useRef } from "react";
import useStore from "../store/useStore";

const CRASH_SNAPSHOT_KEY = "glow-logic-crash-snapshot";
const SNAPSHOT_INTERVAL_MS = 10000;
const MAX_RESTORE_AGE_MS = 48 * 60 * 60 * 1000;

type CrashSnapshot = {
  version: 1;
  updatedAt: number;
  clean: boolean;
  state: Record<string, unknown>;
};

const SNAPSHOT_FIELDS = [
  "nodes",
  "edges",
  "appMode",
  "smartBlackout",
  "smartAutoPilot",
  "smartActiveScene",
  "smartZoneValues",
  "smartZoneMappings",
  "smartPads",
  "smartWidgets",
  "smartPadColumns",
  "midiMappings",
  "currentProjectName",
  "clips",
  "markers",
  "duration",
  "zoom",
  "viewStart",
  "playlist",
  "currentTrackIndex",
  "isPlaying",
  "groupLevels",
  "groupMutes",
  "groupColors",
  "masterVolume",
  "audioSource",
] as const;

function buildSnapshot(clean: boolean): CrashSnapshot {
  const store = useStore.getState() as any;
  const state = SNAPSHOT_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = store[field];
    return acc;
  }, {});

  return {
    version: 1,
    updatedAt: Date.now(),
    clean,
    state,
  };
}

function saveSnapshot(clean = false) {
  try {
    localStorage.setItem(CRASH_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(clean)));
  } catch {
    // Local recovery should never interrupt live operation.
  }
}

function readSnapshot(): CrashSnapshot | null {
  try {
    const raw = localStorage.getItem(CRASH_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrashSnapshot;
    if (parsed.version !== 1 || !parsed.state || typeof parsed.updatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useCrashRecovery() {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const snapshot = readSnapshot();
      const freshEnough = snapshot && Date.now() - snapshot.updatedAt < MAX_RESTORE_AGE_MS;

      if (snapshot && !snapshot.clean && freshEnough) {
        useStore.setState(snapshot.state as any);
        useStore.getState().addToast({
          type: "warning",
          message: "Session live récupérée",
          detail: `Instantané ${new Date(snapshot.updatedAt).toLocaleString("fr-FR")}`,
          duration: 6000,
        });
      }
    }

    saveSnapshot(false);
    const interval = window.setInterval(() => saveSnapshot(false), SNAPSHOT_INTERVAL_MS);

    const markDirty = () => saveSnapshot(false);
    const markClean = () => saveSnapshot(true);

    window.addEventListener("visibilitychange", markDirty);
    window.addEventListener("beforeunload", markClean);
    window.addEventListener("pagehide", markClean);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", markDirty);
      window.removeEventListener("beforeunload", markClean);
      window.removeEventListener("pagehide", markClean);
    };
  }, []);
}

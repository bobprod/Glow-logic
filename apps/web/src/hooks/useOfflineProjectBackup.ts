"use client";

import { useEffect } from "react";
import {
  OFFLINE_PROJECT_BACKUP_INTERVAL_MS,
  saveOfflineProjectBackup,
} from "../lib/offlineProjectBackup";
import useStore from "../store/useStore";

function saveCurrentState() {
  saveOfflineProjectBackup(useStore.getState() as unknown as Record<string, unknown>);
}

export function useOfflineProjectBackup() {
  useEffect(() => {
    saveCurrentState();
    const timer = window.setInterval(saveCurrentState, OFFLINE_PROJECT_BACKUP_INTERVAL_MS);
    const saveOnExit = () => saveCurrentState();

    window.addEventListener("visibilitychange", saveOnExit);
    window.addEventListener("pagehide", saveOnExit);
    window.addEventListener("beforeunload", saveOnExit);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", saveOnExit);
      window.removeEventListener("pagehide", saveOnExit);
      window.removeEventListener("beforeunload", saveOnExit);
    };
  }, []);
}

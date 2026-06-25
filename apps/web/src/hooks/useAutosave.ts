"use client";

import { useEffect, useRef } from "react";
import useStore from "../store/useStore";
import { API_BASE } from "../lib/config";

export function useAutosave() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    async function setup() {
      try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (!res.ok || !active) return;
        const settings: Record<string, string> = await res.json();
        const enabled = settings.backup_autosave === "true";
        const intervalMin = parseInt(settings.backup_interval ?? "5", 10) || 5;

        if (!enabled) return;

        timerRef.current = setInterval(async () => {
          const name = useStore.getState().currentProjectName;
          if (!name) return;
          try {
            await useStore.getState().saveProject(name);
            useStore.getState().addToast({
              type: "info",
              message: "Autosave",
              detail: name,
              duration: 2000,
            });
          } catch {
            // Silent autosave failure — don't interrupt the user
          }
        }, intervalMin * 60 * 1000);
      } catch {
        // Server offline — autosave skipped silently
      }
    }

    setup();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // Runs once on mount; server settings drive the interval
}

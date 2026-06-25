"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../lib/config";
import { dmxEngine, type DmxOfflineQueueStatus } from "../lib/dmxEngine";
import { readOfflineProjectBackupMeta, type OfflineProjectBackupMeta } from "../lib/offlineProjectBackup";
import useStore from "../store/useStore";

export interface OfflineReadiness {
  browserOnline: boolean;
  backendOnline: boolean | null;
  serviceWorkerReady: boolean;
  licenseOfflineReady: boolean | null;
  libraryReady: boolean | null;
  projectReady: boolean;
  offlineProjectBackup: OfflineProjectBackupMeta | null;
  dmxQueue: DmxOfflineQueueStatus;
  ready: boolean;
}

export function useOfflineReadiness(pollMs = 10000): OfflineReadiness {
  const currentProjectName = useStore((state) => state.currentProjectName);
  const smartPads = useStore((state) => state.smartPads);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [licenseOfflineReady, setLicenseOfflineReady] = useState<boolean | null>(null);
  const [libraryReady, setLibraryReady] = useState<boolean | null>(null);
  const [offlineProjectBackup, setOfflineProjectBackup] = useState<OfflineProjectBackupMeta | null>(null);
  const [dmxQueue, setDmxQueue] = useState<DmxOfflineQueueStatus>(() => dmxEngine.getOfflineQueueStatus());

  useEffect(() => {
    const updateBrowser = () => setBrowserOnline(navigator.onLine);
    updateBrowser();
    window.addEventListener("online", updateBrowser);
    window.addEventListener("offline", updateBrowser);
    return () => {
      window.removeEventListener("online", updateBrowser);
      window.removeEventListener("offline", updateBrowser);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) {
        if (!cancelled) setServiceWorkerReady(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        if (!cancelled) setServiceWorkerReady(Boolean(registration?.active || navigator.serviceWorker.controller));
      } catch {
        if (!cancelled) setServiceWorkerReady(false);
      }
    };
    checkServiceWorker();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkBackend = async () => {
      try {
        const [licenseResponse, libraryResponse] = await Promise.all([
          fetch(`${API_BASE}/api/license`),
          fetch(`${API_BASE}/api/library`),
        ]);
        if (cancelled) return;
        setBackendOnline(licenseResponse.ok || libraryResponse.ok);
        if (licenseResponse.ok) {
          const license = await licenseResponse.json();
          if (!cancelled) setLicenseOfflineReady(Boolean(license.offlineReady));
        } else {
          setLicenseOfflineReady(null);
        }
        if (libraryResponse.ok) {
          const library = await libraryResponse.json();
          if (!cancelled) setLibraryReady(Array.isArray(library) && library.length > 0);
        } else {
          setLibraryReady(null);
        }
      } catch {
        if (!cancelled) {
          setBackendOnline(false);
          setLicenseOfflineReady(null);
          setLibraryReady(null);
        }
      }
    };
    checkBackend();
    const timer = window.setInterval(checkBackend, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  useEffect(() => {
    const refreshBackup = () => setOfflineProjectBackup(readOfflineProjectBackupMeta());
    refreshBackup();
    window.addEventListener("glowlogic:offline-backup", refreshBackup);
    return () => window.removeEventListener("glowlogic:offline-backup", refreshBackup);
  }, []);

  useEffect(() => {
    const refreshDmxQueue = () => setDmxQueue(dmxEngine.getOfflineQueueStatus());
    refreshDmxQueue();
    window.addEventListener("glowlogic:dmx-queue", refreshDmxQueue);
    const timer = window.setInterval(refreshDmxQueue, pollMs);
    return () => {
      window.removeEventListener("glowlogic:dmx-queue", refreshDmxQueue);
      window.clearInterval(timer);
    };
  }, [pollMs]);

  const projectReady = Boolean(currentProjectName || smartPads.length > 0);
  const offlineProjectReady = Boolean(offlineProjectBackup && (offlineProjectBackup.pads > 0 || offlineProjectBackup.projectName));
  const ready = serviceWorkerReady && projectReady && offlineProjectReady && libraryReady !== false && licenseOfflineReady !== false;

  return {
    browserOnline,
    backendOnline,
    serviceWorkerReady,
    licenseOfflineReady,
    libraryReady,
    projectReady,
    offlineProjectBackup,
    dmxQueue,
    ready,
  };
}

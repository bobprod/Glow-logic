"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Settings,
  Play,
  Activity,
  StopCircle,
  PanelLeftClose,
  PanelLeft,
  Clock,
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  Library,
  Wifi,
  WifiOff,
  Wrench,
  Save,
  Link2,
  RadioTower,
  MoreHorizontal,
  Sun,
  Timer,
  Gauge,
} from "lucide-react";
import useStore from "../store/useStore";
import { socket } from "../lib/socket";
import { SettingsModal } from "./ui/SettingsModal";
import { ProjectModal } from "./ui/ProjectModal";
import { HelpCenterModal } from "./ui/HelpCenterModal";
import { SupportCenterModal } from "./ui/SupportCenterModal";
import DmxStatusBadge from "./smart/DmxStatusBadge";
import { calcBPM, MAX_TAPS } from "../utils/bpm";
import { useOfflineReadiness } from "../hooks/useOfflineReadiness";
import { API_BASE } from "../lib/config";

interface SyncStatus {
  enabled: boolean;
  trustExternalBpm: boolean;
  source: string;
  bpm: number;
  phase: number;
  beat: number;
  lastSeenAt: string | null;
  confidence: number;
  online: boolean;
}

function formatOfflineAge(timestamp: number | null | undefined) {
  if (!timestamp) return "-";
  const ageMs = Date.now() - timestamp;
  if (ageMs < 60_000) return "<1 min";
  if (ageMs < 60 * 60_000) return `${Math.round(ageMs / 60_000)} min`;
  return `${Math.round(ageMs / 60 / 60_000)} h`;
}

export default function TopBar() {
  const {
    appMode,
    setAppMode,
    isTimelineVisible,
    setIsTimelineVisible,
    isSidebarVisible,
    setIsSidebarVisible,
    smartBlackout,
    setSmartBlackout,
    masterDimmer,
    setMasterDimmer,
    fadeSeconds,
    setFadeSeconds,
    effectSpeed,
    setEffectSpeed,
    smartActiveScene,
    smartPads,
    previewMode,
    laserArmed,
    pyroArmed,
    setLaserArmed,
    setPyroArmed,
    bpm,
    setBpm,
    currentProjectName,
    proView,
    setProView,
    setDesignStep,
    setOpenTool,
    setSmartSidebarPanel,
    addToast,
    saveProject,
    setLivePerformanceMode,
  } = useStore();

  const pathname = usePathname();
  const router = useRouter();
  const goHome = () => {
    if (pathname !== "/") router.push("/");
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showMorePanel, setShowMorePanel] = useState(false);
  const toolsPanelRef = useRef<HTMLDivElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const previousSafetyRef = useRef<{ laserArmed: boolean; pyroArmed: boolean } | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncSource, setSyncSource] = useState("manual");
  const [syncBusy, setSyncBusy] = useState(false);
  const offline = useOfflineReadiness();
  const activeSceneName = smartPads.find((pad) => pad.qlcWidget === smartActiveScene)?.name || "-";

  useEffect(() => {
    const openProjectModal = () => setIsProjectOpen(true);
    window.addEventListener("glowlogic:open-project-modal", openProjectModal);
    return () => window.removeEventListener("glowlogic:open-project-modal", openProjectModal);
  }, []);

  useEffect(() => {
    setBackendConnected(socket.connected);
    const onConnect = () => setBackendConnected(true);
    const onDisconnect = () => setBackendConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!showToolsPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!toolsPanelRef.current?.contains(event.target as Node)) {
        setShowToolsPanel(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowToolsPanel(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showToolsPanel]);

  useEffect(() => {
    if (!showMorePanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!morePanelRef.current?.contains(event.target as Node)) {
        setShowMorePanel(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMorePanel(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showMorePanel]);

  const openSmartTool = (tool: "diagnostic" | "preflight" | "recovery") => {
    setOpenTool(tool);
    setShowToolsPanel(false);
  };

  useEffect(() => {
    const applySafetyStatus = (status: { laserArmed?: boolean; pyroArmed?: boolean }) => {
      const next = {
        laserArmed: Boolean(status.laserArmed),
        pyroArmed: Boolean(status.pyroArmed),
      };
      const previous = previousSafetyRef.current;
      if (previous?.laserArmed && !next.laserArmed) {
        addToast({ type: "info", message: "Laser desarme", detail: "Armement desactive ou expire.", duration: 3500 });
      }
      if (previous?.pyroArmed && !next.pyroArmed) {
        addToast({ type: "info", message: "Pyro desarme", detail: "Armement desactive ou expire.", duration: 3500 });
      }
      previousSafetyRef.current = next;
      setLaserArmed(next.laserArmed);
      setPyroArmed(next.pyroArmed);
    };

    const refreshSafetyStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/safety/status`);
        if (!response.ok) return;
        applySafetyStatus(await response.json() as { laserArmed?: boolean; pyroArmed?: boolean });
      } catch {
        // The local store remains the source of truth if the backend is offline.
      }
    };

    refreshSafetyStatus();
    const timer = setInterval(refreshSafetyStatus, 3000);
    socket.on("safety_status", applySafetyStatus);
    return () => {
      clearInterval(timer);
      socket.off("safety_status", applySafetyStatus);
    };
  }, [addToast, setLaserArmed, setPyroArmed]);

  useEffect(() => {
    const applySyncStatus = (state: SyncStatus) => {
      setSyncStatus(state);
      setSyncSource(state.source || "manual");
      if (state.enabled && state.trustExternalBpm && Number.isFinite(state.bpm)) {
        setBpm(state.bpm);
        socket.emit("smart:bpm", { bpm: state.bpm });
      }
    };

    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sync/status`);
        if (!response.ok) return;
        applySyncStatus(await response.json());
      } catch {
        setSyncStatus(null);
      }
    };

    refresh();
    const timer = setInterval(refresh, 3000);
    socket.on("sync:bpm", applySyncStatus);
    socket.on("sync:status", applySyncStatus);
    return () => {
      clearInterval(timer);
      socket.off("sync:bpm", applySyncStatus);
      socket.off("sync:status", applySyncStatus);
    };
  }, [setBpm]);

  const saveSyncConfig = async (updates: Partial<SyncStatus>) => {
    setSyncBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/sync/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: updates.enabled ?? syncStatus?.enabled ?? false,
          trustExternalBpm: updates.trustExternalBpm ?? syncStatus?.trustExternalBpm ?? true,
          source: updates.source ?? syncSource,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync impossible");
      setSyncStatus(data);
      setSyncSource(data.source || "manual");
      addToast({
        type: "success",
        message: data.enabled ? "Sync externe active" : "Sync externe desactivee",
        detail: `${data.source} · ${Number(data.bpm || bpm).toFixed(1)} BPM`,
      });
    } catch (error: any) {
      addToast({ type: "error", message: "Sync externe indisponible", detail: error.message });
    } finally {
      setSyncBusy(false);
    }
  };

  const pushManualSyncBpm = async () => {
    setSyncBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/sync/bpm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm, source: syncSource, confidence: 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "BPM sync refuse");
      setSyncStatus(data);
      addToast({ type: "success", message: "BPM envoye au moteur sync", detail: `${data.bpm.toFixed(1)} BPM` });
    } catch (error: any) {
      addToast({ type: "error", message: "BPM sync echoue", detail: error.message });
    } finally {
      setSyncBusy(false);
    }
  };
  const tapTimesRef = useRef<number[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("00:00:00");

  // Update digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // BPM TAP Handler
  const handleTap = () => {
    const now = Date.now();
    let newTaps = [...tapTimesRef.current, now];

    // Reset if gap > 2 seconds
    if (newTaps.length > 1 && now - newTaps[newTaps.length - 2] > 2000) {
      newTaps = [now];
    }
    if (newTaps.length > MAX_TAPS) {
      newTaps.shift();
    }

    tapTimesRef.current = newTaps;

    const calculatedBpm = calcBPM(newTaps);
    if (calculatedBpm > 0) {
      setBpm(calculatedBpm);
      socket.emit("smart:bpm", { bpm: calculatedBpm });
    }

    // Small tap animation on the button
    const btn = document.getElementById("tap-btn");
    if (btn) {
      btn.classList.add("scale-95", "bg-cyan-500/20");
      setTimeout(() => btn.classList.remove("scale-95", "bg-cyan-500/20"), 100);
    }
  };

  const handleBlackout = () => {
    const newState = !smartBlackout;
    setSmartBlackout(newState);
    socket.emit("smart:blackout", { active: newState });
    addToast({
      type: newState ? "warning" : "info",
      message: newState ? "BLACKOUT activé" : "Blackout désactivé",
      detail: newState ? "Toutes les sorties coupées" : undefined,
    });
  };

  const handleQuickSave = async () => {
    const name =
      currentProjectName || `Projet ${new Date().toLocaleString("fr-FR")}`;
    try {
      await saveProject(name);
      addToast({ type: "success", message: "Projet sauvegardé", detail: name });
    } catch {
      addToast({
        type: "error",
        message: "Échec de la sauvegarde",
        detail: "Vérifier le backend (port 3005)",
      });
    }
  };

  const goSmartView = () => {
    setAppMode("smart");
    setProView("canvas");
    goHome();
  };

  const goPatchView = () => {
    setAppMode("creator");
    setProView("patch");
    goHome();
  };

  const goVisualizerView = () => {
    setAppMode("smart");
    setProView("visualizer");
    goHome();
  };

  return (
    <div className="h-16 bg-[#0a0c10]/95 backdrop-blur-xl border-b border-white/5 flex items-center gap-3 px-4 z-50 shrink-0 sticky top-0">
      {/* LEFT : Mode & Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Sidebar toggle */}
        <button
          onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          className="text-slate-500 hover:text-white transition-colors shrink-0"
          title="Toggle Left Panel"
        >
          {isSidebarVisible ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </button>

        {/* Logo — compact */}
        <div
          className="flex items-center gap-1.5 cursor-pointer shrink-0"
          onClick={goHome}
          title="Retour au dashboard"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="text-white font-black tracking-widest text-sm whitespace-nowrap">
            GL<span className="font-light opacity-60">OW</span>
          </span>
        </div>

        <div className="h-5 w-px bg-white/10 shrink-0" />

        {/* MODE SWITCHER */}
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 shrink-0">
          <button
            onClick={() => { setAppMode("smart"); setProView("canvas"); goHome(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              appMode === "smart"
                ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Play className="w-3 h-3" />
            PERFORM
          </button>
          <button
            onClick={() => { setAppMode("creator"); setDesignStep("patch"); goHome(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              appMode === "creator"
                ? "bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Settings className="w-3 h-3" />
            DESIGN
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLivePerformanceMode(true)}
          className="flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 transition-all hover:border-red-400/45 hover:bg-red-500/20"
          title="Mode Live Performance (F10)"
        >
          <Play className="h-3.5 w-3.5" />
          LIVE
        </button>
      </div>

      {/* MIDDLE: Global Controls */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
        {/* BPM */}
        <div className="flex items-center gap-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
          <button
            id="tap-btn"
            onClick={handleTap}
            className="px-3 py-2 hover:bg-white/5 text-slate-400 hover:text-white transition-all border-r border-white/5"
            title="TAP BPM"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <div className="px-3 py-1.5 text-center flex flex-col items-center justify-center min-w-[80px]">
            <span className="text-[10px] text-slate-500 font-bold tracking-widest leading-none mb-0.5">BPM</span>
            <span className="text-cyan-400 font-mono text-sm leading-none font-bold">{bpm.toFixed(1)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSyncPanel((open) => !open)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              syncStatus?.enabled
                ? syncStatus.online
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"
                : "bg-black/40 border-white/5 text-slate-400 hover:text-white"
            }`}
            title="Sync DJ / Ableton / OS2L"
          >
            {syncStatus?.online ? <RadioTower className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            SYNC
          </button>

          {showSyncPanel && (
            <div className="absolute left-1/2 -translate-x-1/2 top-11 w-80 rounded-2xl border border-white/10 bg-[#12141A] shadow-2xl p-4 z-[120]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white text-xs font-black uppercase tracking-widest">Sync externe</h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">Ableton Link, OS2L, VirtualDJ, rekordbox, Serato.</p>
                </div>
                <button
                  onClick={() => setShowSyncPanel(false)}
                  className="text-slate-500 hover:text-white text-xs font-black"
                >
                  X
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                  <span className="block text-slate-500 font-black uppercase tracking-widest">BPM</span>
                  <span className="text-cyan-400 font-mono font-black">{(syncStatus?.bpm || bpm).toFixed(1)}</span>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                  <span className="block text-slate-500 font-black uppercase tracking-widest">Etat</span>
                  <span className={syncStatus?.online ? "text-green-400 font-black" : "text-slate-400 font-black"}>
                    {syncStatus?.online ? "Signal" : syncStatus?.enabled ? "En attente" : "Off"}
                  </span>
                </div>
              </div>

              <label className="block text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Source</label>
              <select
                value={syncSource}
                onChange={(event) => {
                  setSyncSource(event.target.value);
                  saveSyncConfig({ source: event.target.value });
                }}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none mb-3"
              >
                <option value="manual">Manual / Tap</option>
                <option value="midi_clock">MIDI Clock</option>
                <option value="ableton_link">Ableton Link bridge</option>
                <option value="os2l">OS2L / VirtualDJ</option>
                <option value="virtualdj">VirtualDJ</option>
                <option value="rekordbox">rekordbox</option>
                <option value="serato">Serato</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => saveSyncConfig({ enabled: !syncStatus?.enabled })}
                  disabled={syncBusy}
                  className={`min-h-[38px] rounded-xl border text-xs font-black transition-all disabled:opacity-50 ${
                    syncStatus?.enabled
                      ? "bg-green-500/10 border-green-500/30 text-green-300"
                      : "bg-black/40 border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  {syncStatus?.enabled ? "Actif" : "Activer"}
                </button>
                <button
                  onClick={() => saveSyncConfig({ trustExternalBpm: !syncStatus?.trustExternalBpm })}
                  disabled={syncBusy}
                  className={`min-h-[38px] rounded-xl border text-xs font-black transition-all disabled:opacity-50 ${
                    syncStatus?.trustExternalBpm
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                      : "bg-black/40 border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  Auto BPM
                </button>
                <button
                  onClick={pushManualSyncBpm}
                  disabled={syncBusy}
                  className="col-span-2 min-h-[38px] rounded-xl bg-black/40 border border-white/10 text-white text-xs font-black hover:bg-white/5 disabled:opacity-50"
                >
                  Envoyer BPM actuel
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleBlackout}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
            smartBlackout
              ? "bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              : "bg-black/40 border-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
          }`}
        >
          <StopCircle className="w-3.5 h-3.5" />
          BLACKOUT
        </button>

        <div className="h-5 w-px bg-white/10 shrink-0" />

        {/* MASTER : Global Dimmer + Fade + Speed */}
        <div className="flex items-center gap-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden shrink-0">
          {/* Master Dimmer (global, distinct des dimmers de zone) */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-r border-white/5"
            title="Master Dimmer global (atténue toutes les sorties DMX)"
          >
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={masterDimmer}
              onChange={(event) => setMasterDimmer(Number(event.target.value))}
              className="w-16 h-1 accent-amber-400 cursor-pointer"
              aria-label="Master Dimmer"
            />
            <span className="text-amber-300 font-mono text-xs leading-none font-bold min-w-[32px] text-right">
              {Math.round((masterDimmer / 255) * 100)}%
            </span>
          </div>

          {/* Fade / Crossfade (secondes) */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5"
            title="Temps de fondu (secondes)"
          >
            <Timer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="number"
              min={0}
              step={0.1}
              value={fadeSeconds}
              onChange={(event) => setFadeSeconds(Number(event.target.value))}
              className="w-12 bg-transparent text-cyan-400 font-mono text-xs leading-none font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Fade en secondes"
            />
            <span className="text-[10px] text-slate-500 font-bold tracking-widest leading-none">S</span>
          </div>

          {/* SPEED : multiplicateur global de vitesse des oscillateurs (effets) */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-l border-white/5"
            title="Vitesse globale des effets (oscillateurs) — 1.00x = vitesse normale"
          >
            <Gauge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.05}
              value={effectSpeed}
              onChange={(event) => setEffectSpeed(Number(event.target.value))}
              className="w-16 h-1 accent-purple-400 cursor-pointer"
              aria-label="Vitesse des effets"
            />
            <span className="text-purple-300 font-mono text-xs leading-none font-bold min-w-[36px] text-right">
              {effectSpeed.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-white/10 shrink-0" />
        {appMode === "smart" && (
          <div className="flex items-center gap-2 shrink-0">
            <div
              title={backendConnected ? "Backend connecté" : "Backend déconnecté"}
              className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-black/40 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              <span className={`h-2 w-2 rounded-full ${backendConnected ? "bg-green-400 shadow-[0_0_7px_#4ade80]" : "bg-red-400 shadow-[0_0_7px_#f87171]"}`} />
              Backend
            </div>
            <div
              title={`Scène active: ${activeSceneName}`}
              className="max-w-[120px] truncate rounded-xl border border-white/5 bg-black/40 px-2.5 py-1.5 text-[10px] font-mono font-black text-cyan-300"
            >
              {activeSceneName}
            </div>
          </div>
        )}
      </div>
      {/* RIGHT : User & System */}
      <div className="flex items-center gap-2 justify-end flex-shrink-0">
        {/* Digital Clock + Timeline toggle merged */}
        <button
          onClick={() => setIsTimelineVisible(!isTimelineVisible)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${
            isTimelineVisible
              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
              : "bg-black/40 text-slate-500 border-white/5 hover:bg-white/5"
          }`}
          title="Toggle Timeline"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono tracking-wider font-semibold">{currentTime}</span>
        </button>

        <DmxStatusBadge backendConnected={backendConnected} previewMode={previewMode} onConfigure={() => setIsSettingsOpen(true)} />

        <div
          title={`Laser ${laserArmed ? "armé" : "désarmé"}`}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-default ${
            laserArmed
              ? "bg-red-500/10 border-red-500/35 text-red-300"
              : "bg-green-500/10 border-green-500/25 text-green-400"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${laserArmed ? "bg-red-400 shadow-[0_0_7px_#f87171]" : "bg-green-400"}`}
          />
          LASER
        </div>

        <div
          title={`Pyro ${pyroArmed ? "armé" : "désarmé"}`}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-default ${
            pyroArmed
              ? "bg-red-500/10 border-red-500/35 text-red-300"
              : "bg-green-500/10 border-green-500/25 text-green-400"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${pyroArmed ? "bg-red-400 shadow-[0_0_7px_#f87171]" : "bg-green-400"}`}
          />
          PYRO
        </div>

        {appMode === "smart" && (
          <div className="relative" ref={toolsPanelRef}>
            <button
              onClick={() => setShowToolsPanel((open) => !open)}
              title="Outils SMART"
              aria-label="Outils SMART"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                showToolsPanel
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                  : "bg-black/40 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Outils</span>
            </button>

            {showToolsPanel && (
              <div className="absolute right-0 top-11 z-[120] w-60 rounded-2xl border border-white/10 bg-[#12141A] p-2 shadow-2xl">
                <button
                  onClick={() => openSmartTool("diagnostic")}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  Diagnostic IA du DMX
                </button>
                <button
                  onClick={() => openSmartTool("preflight")}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  Vérification avant show
                </button>
                <button
                  onClick={() => openSmartTool("recovery")}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  Récupération de show
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowOfflinePanel((open) => !open)}
            title="Statut offline"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
              offline.ready
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
          >
            {offline.browserOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {offline.ready ? "OFFLINE READY" : "CHECK OFFLINE"}
          </button>

          {showOfflinePanel && (
            <div className="absolute right-0 top-11 w-80 rounded-2xl border border-white/10 bg-[#12141A] shadow-2xl p-4 z-[120]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white text-xs font-black uppercase tracking-widest">Mode offline</h3>
                <button
                  onClick={() => setShowOfflinePanel(false)}
                  className="text-slate-500 hover:text-white text-xs font-black"
                >
                  X
                </button>
              </div>
              <div className="space-y-2 text-[11px]">
                {[
                  ["Navigateur", offline.browserOnline ? "Online" : "Offline", true],
                  ["Backend local", offline.backendOnline === null ? "..." : offline.backendOnline ? "OK" : "Hors ligne", offline.backendOnline !== false],
                  ["App cache / PWA", offline.serviceWorkerReady ? "OK" : "A preparer", offline.serviceWorkerReady],
                  ["Licence offline", offline.licenseOfflineReady === null ? "..." : offline.licenseOfflineReady ? "OK" : "Non pret", offline.licenseOfflineReady !== false],
                  ["Bibliotheque locale", offline.libraryReady === null ? "..." : offline.libraryReady ? "OK" : "Vide", offline.libraryReady !== false],
                  ["Show/pads", offline.projectReady ? "OK" : "A sauvegarder", offline.projectReady],
                  [
                    "Snapshot local",
                    offline.offlineProjectBackup
                      ? `${formatOfflineAge(offline.offlineProjectBackup.updatedAt)} - ${offline.offlineProjectBackup.pads} pads`
                      : "Absent",
                    Boolean(offline.offlineProjectBackup),
                  ],
                  [
                    "Queue DMX",
                    offline.dmxQueue.pending > 0
                      ? `${offline.dmxQueue.pending} en attente`
                      : offline.dmxQueue.lastFlushedAt
                        ? `Sync ${formatOfflineAge(offline.dmxQueue.lastFlushedAt)}`
                        : "Vide",
                    true,
                  ],
                ].map(([label, value, ok]) => (
                  <div key={String(label)} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                    <span className="text-slate-400 font-semibold">{label}</span>
                    <span className={ok ? "text-green-400 font-black" : "text-amber-400 font-black"}>{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-3">
                Le show doit rester utilisable sans internet. Le backend local reste necessaire pour DMX, logs, fixtures et licences locales.
              </p>
            </div>
          )}
        </div>

        {/* Hotkeys hint badge */}
        <div
          title={"Raccourcis clavier Smart Mode:\nEspace / B → Blackout\n← → → Piste précédente / suivante\nL → Verrou show\nÉchap → Quitter mode édition\n1-9 → Déclencher pad N"}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg border border-white/5 bg-black/30 text-[10px] font-mono text-slate-500 cursor-default select-none"
        >
          ⌨ Hotkeys
        </div>

        {/* More … menu — Save / Library / Help / Tour / Support */}
        <div className="relative" ref={morePanelRef}>
          <button
            onClick={() => setShowMorePanel((open) => !open)}
            title="Plus d'options"
            className={`flex items-center gap-1 p-2 rounded-xl border text-[10px] font-bold transition-all ${
              showMorePanel
                ? "bg-white/10 border-white/20 text-white"
                : "bg-black/40 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMorePanel && (
            <div className="absolute right-0 top-11 z-[120] w-52 rounded-2xl border border-white/10 bg-[#12141A] p-2 shadow-2xl">
              <button
                onClick={() => { handleQuickSave(); setShowMorePanel(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-green-500/10 hover:text-green-300"
              >
                <Save className="h-3.5 w-3.5" />
                Sauvegarder
              </button>
              <button
                onClick={() => { setIsSidebarVisible(true); setSmartSidebarPanel("library"); setShowMorePanel(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-purple-500/10 hover:text-purple-300"
              >
                <Library className="h-3.5 w-3.5" />
                Bibliothèque
              </button>
              <button
                onClick={() => { setIsHelpOpen(true); setShowMorePanel(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Aide
              </button>
              <button
                onClick={() => {
                  goSmartView();
                  window.setTimeout(() => window.dispatchEvent(new Event("glowlogic:start-tour")), 80);
                  setShowMorePanel(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                <RadioTower className="h-3.5 w-3.5" />
                Guide interactif
              </button>
              <button
                onClick={() => { setIsSupportOpen(true); setShowMorePanel(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                Support
              </button>
            </div>
          )}
        </div>

        {/* Settings Toggle */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-2 bg-black/40 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-slate-400 hover:text-white group relative"
          title="Settings"
        >
          <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
          {/* Tiny status dot */}
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]"></div>
        </button>

        <div className="h-6 w-[1px] bg-white/10" />

        {/* Project Manager Toggle */}
        <button
          onClick={() => setIsProjectOpen(true)}
          className="flex items-center gap-3 pl-2 pr-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl transition-all group"
        >
          <div className="p-1.5 bg-cyan-500 rounded-lg text-black group-hover:scale-110 transition-transform">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[10px] font-black text-cyan-500 uppercase leading-none mb-0.5 tracking-tighter">
              Current Project
            </p>
            <p className="text-xs font-bold text-white leading-none tracking-tight truncate max-w-[120px]">
              {currentProjectName || "Untitled Project"}
            </p>
          </div>
        </button>
      </div>

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {isProjectOpen && (
        <ProjectModal onClose={() => setIsProjectOpen(false)} />
      )}
      {isHelpOpen && (
        <HelpCenterModal
          onClose={() => setIsHelpOpen(false)}
          onGoPatch={goPatchView}
          onGoSmart={goSmartView}
          onGoSettings={() => setIsSettingsOpen(true)}
          onGoVisualizer={goVisualizerView}
        />
      )}
      {isSupportOpen && (
        <SupportCenterModal onClose={() => setIsSupportOpen(false)} />
      )}
    </div>
  );
}

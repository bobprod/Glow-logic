"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Settings,
  Play,
  Radio,
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
  Save,
  Link2,
  RadioTower,
} from "lucide-react";
import useStore from "../store/useStore";
import { socket } from "../lib/socket";
import { SettingsModal } from "./ui/SettingsModal";
import { ProjectModal } from "./ui/ProjectModal";
import { HelpCenterModal } from "./ui/HelpCenterModal";
import { LibraryModal } from "./ui/LibraryModal";
import { SupportCenterModal } from "./ui/SupportCenterModal";
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
    laserArmed,
    pyroArmed,
    setLaserArmed,
    setPyroArmed,
    bpm,
    setBpm,
    currentProjectName,
    proView,
    setProView,
    addToast,
    saveProject,
  } = useStore();

  const pathname = usePathname();
  const router = useRouter();
  const goHome = () => {
    if (pathname !== "/") router.push("/");
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncSource, setSyncSource] = useState("manual");
  const [syncBusy, setSyncBusy] = useState(false);
  const [qlcStatus, setQlcStatus] = useState<"offline"|"launching"|"configuring"|"ready"|"error">("offline");
  const offline = useOfflineReadiness();

  // Poll QLC+ engine status every 3s
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("http://localhost:3005/api/qlc/engine-status");
        const d = await r.json();
        setQlcStatus(d.status);
      } catch { setQlcStatus("offline"); }
    };
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const refreshSafetyStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/safety/status`);
        if (!response.ok) return;
        const status = await response.json() as { laserArmed?: boolean; pyroArmed?: boolean };
        setLaserArmed(Boolean(status.laserArmed));
        setPyroArmed(Boolean(status.pyroArmed));
      } catch {
        // The local store remains the source of truth if the backend is offline.
      }
    };

    refreshSafetyStatus();
    const timer = setInterval(refreshSafetyStatus, 3000);
    return () => clearInterval(timer);
  }, [setLaserArmed, setPyroArmed]);

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
    <div className="h-16 bg-[#0a0c10]/95 backdrop-blur-xl border-b border-white/5 grid grid-cols-[1fr_auto_1fr] items-center px-4 z-50 shrink-0 sticky top-0">
      {/* LEFT : Mode & Toggle */}
      <div className="flex items-center gap-2 min-w-0">
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
            SMART
          </button>
          <button
            onClick={() => { setAppMode("creator"); setProView("canvas"); goHome(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              appMode === "creator"
                ? "bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Settings className="w-3 h-3" />
            CREATOR
          </button>
        </div>
      </div>

      {/* MIDDLE: Global Controls */}
      <div className="flex items-center gap-2">
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

        {/* CANVAS / FIXTURES / 3D — always visible */}
        <div className="h-5 w-px bg-white/10 shrink-0" />
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 shrink-0">
          <button
            onClick={() => setProView("canvas")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              proView === "canvas"
                ? "bg-purple-500/20 text-purple-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            CANVAS
          </button>
          <button
            onClick={() => setProView("patch")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              proView === "patch"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            FIXTURES
          </button>
          <button
            onClick={() => setProView("visualizer")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              proView === "visualizer"
                ? "bg-purple-500/20 text-purple-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Radio className="w-3 h-3" />
            3D
          </button>
        </div>
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

        {/* QLC+ Engine indicator */}
        <div
          title={`QLC+ Engine: ${qlcStatus}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-default"
          style={{
            background: qlcStatus === "ready" ? "rgba(34,197,94,0.1)" : qlcStatus === "error" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)",
            borderColor: qlcStatus === "ready" ? "rgba(34,197,94,0.3)" : qlcStatus === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.07)",
            color: qlcStatus === "ready" ? "#22c55e" : qlcStatus === "error" ? "#ef4444" : "#64748b",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: qlcStatus === "ready" ? "#22c55e" : qlcStatus === "launching" || qlcStatus === "configuring" ? "#f59e0b" : qlcStatus === "error" ? "#ef4444" : "#475569",
              boxShadow: qlcStatus === "ready" ? "0 0 6px #22c55e" : qlcStatus === "launching" ? "0 0 6px #f59e0b" : "none",
              animation: (qlcStatus === "launching" || qlcStatus === "configuring") ? "pulse 1s infinite" : "none",
            }}
          />
          DMX
        </div>

        <div
          title={`Laser ${laserArmed ? "arme" : "desarme"}`}
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
          title={`Pyro ${pyroArmed ? "arme" : "desarme"}`}
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

        {/* Quick Save */}
        <button
          onClick={handleQuickSave}
          title="Sauvegarder le projet courant (Ctrl+S)"
          className="p-2 bg-black/40 hover:bg-green-500/10 rounded-xl border border-white/5 hover:border-green-500/30 transition-all text-slate-400 hover:text-green-400"
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Help Center */}
        <button
          onClick={() => setIsHelpOpen(true)}
          title="Aide et tutoriels"
          className="p-2 bg-black/40 hover:bg-cyan-500/10 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-all text-slate-400 hover:text-cyan-400"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Interactive Tour */}
        <button
          onClick={() => {
            goSmartView();
            window.setTimeout(() => window.dispatchEvent(new Event("glowlogic:start-tour")), 80);
          }}
          title="Guide interactif"
          className="p-2 bg-black/40 hover:bg-blue-500/10 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all text-slate-400 hover:text-blue-400"
        >
          <RadioTower className="w-4 h-4" />
        </button>

        {/* Local Library */}
        <button
          onClick={() => setIsLibraryOpen(true)}
          title="Bibliotheque locale"
          className="p-2 bg-black/40 hover:bg-purple-500/10 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all text-slate-400 hover:text-purple-400"
        >
          <Library className="w-4 h-4" />
        </button>

        {/* Support Center */}
        <button
          onClick={() => setIsSupportOpen(true)}
          title="Centre support"
          className="p-2 bg-black/40 hover:bg-amber-500/10 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all text-slate-400 hover:text-amber-400"
        >
          <LifeBuoy className="w-4 h-4" />
        </button>

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
      {isLibraryOpen && (
        <LibraryModal onClose={() => setIsLibraryOpen(false)} />
      )}
      {isSupportOpen && (
        <SupportCenterModal onClose={() => setIsSupportOpen(false)} />
      )}
    </div>
  );
}

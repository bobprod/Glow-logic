"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Clock, LogOut, StopCircle } from "lucide-react";
import useStore from "../../store/useStore";
import { socket } from "../../lib/socket";
import DmxStatusBadge from "./DmxStatusBadge";
import GroupStrips from "./GroupStrips";
import SceneController from "./SceneController";

function formatClock() {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

export default function LivePerformanceView() {
  const {
    bpm,
    currentProjectName,
    previewMode,
    smartBlackout,
    setSmartBlackout,
    setLivePerformanceMode,
    setSmartEditMode,
    setSmartPadViewMode,
    addToast,
  } = useStore();
  const [backendConnected, setBackendConnected] = useState(false);
  const [clock, setClock] = useState(formatClock);
  const [escapeHint, setEscapeHint] = useState(false);
  const escapeTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const exitLivePerformance = useCallback(() => {
    if (escapeTimerRef.current !== null) {
      window.clearTimeout(escapeTimerRef.current);
      escapeTimerRef.current = null;
    }
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setEscapeHint(false);
    setLivePerformanceMode(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [setLivePerformanceMode]);

  useEffect(() => {
    // Memoriser l'etat precedent pour le restaurer a la sortie du live.
    const prevState = useStore.getState();
    const prevSmartEditMode = prevState.smartEditMode;
    const prevSmartPadViewMode = prevState.smartPadViewMode;
    setSmartEditMode(false);
    setSmartPadViewMode("visual");
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      // Restaurer les valeurs forcees au montage (sinon session bloquee en lecture seule).
      setSmartEditMode(prevSmartEditMode);
      setSmartPadViewMode(prevSmartPadViewMode);
    };
  }, [setSmartEditMode, setSmartPadViewMode]);

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
    const timer = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const showShortHint = () => {
      setEscapeHint(true);
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = window.setTimeout(() => setEscapeHint(false), 1500);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      setEscapeHint(true);
      escapeTimerRef.current = window.setTimeout(exitLivePerformance, 800);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (escapeTimerRef.current !== null) {
        window.clearTimeout(escapeTimerRef.current);
        escapeTimerRef.current = null;
        showShortHint();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (escapeTimerRef.current !== null) window.clearTimeout(escapeTimerRef.current);
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    };
  }, [exitLivePerformance]);

  const toggleBlackout = () => {
    const next = !smartBlackout;
    setSmartBlackout(next);
    socket.emit("smart:blackout", { active: next });
    addToast({
      type: next ? "warning" : "info",
      message: next ? "BLACKOUT active" : "Blackout desactive",
      detail: next ? "Sorties DMX coupees depuis le mode Live Performance." : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-[#050608] text-white" role="dialog" aria-modal="true" aria-label="Mode Live Performance">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-white/10 bg-black/70 px-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-widest text-slate-200">
          {currentProjectName || "Glow Logic Show"}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 font-mono text-[11px] font-black text-cyan-300">
          <Activity className="h-3.5 w-3.5" />
          {bpm.toFixed(1)} BPM
        </div>
        <DmxStatusBadge backendConnected={backendConnected} previewMode={previewMode} onConfigure={() => undefined} />
        <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold text-slate-300 sm:flex">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          {clock}
        </div>
        <button
          type="button"
          onClick={exitLivePerformance}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-white"
          title="Quitter le mode Live Performance"
        >
          <LogOut className="h-3.5 w-3.5" />
          Quitter
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.08),transparent_34%),#050608] p-3 pb-20 custom-scrollbar lg:grid lg:grid-rows-[minmax(0,3fr)_minmax(200px,1fr)] lg:gap-3 lg:overflow-hidden lg:pb-16">
        <section className="min-h-[560px] overflow-hidden rounded-lg border border-cyan-500/20 bg-[#090b10]/95 shadow-[0_0_35px_rgba(6,182,212,0.07)] lg:min-h-0">
          <SceneController variant="performance" readonly />
        </section>
        <section className="mt-3 min-h-[260px] rounded-lg border border-white/10 bg-[#090b10]/95 p-3 lg:mt-0 lg:min-h-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Groupes DMX</h2>
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Faders + Mute</span>
          </div>
          <GroupStrips performanceMode readonly />
        </section>
      </main>

      {escapeHint && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[1010] -translate-x-1/2 rounded-full border border-cyan-400/25 bg-black/85 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-cyan-100 shadow-2xl">
          Maintenir Echap pour quitter
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[1005] border-t border-red-500/30 bg-black/80 p-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={toggleBlackout}
          className={`flex h-14 w-full items-center justify-center gap-3 rounded-lg border text-sm font-black uppercase tracking-[0.2em] transition-all ${
            smartBlackout
              ? "border-red-300 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,0.45)]"
              : "border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25"
          }`}
        >
          <StopCircle className="h-5 w-5" />
          {smartBlackout ? "Blackout actif" : "Blackout"}
        </button>
      </div>
    </div>
  );
}
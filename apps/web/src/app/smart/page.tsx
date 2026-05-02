"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import useStore, { SmartPad } from "../../store/useStore";
import { socket } from "../../lib/socket";
import {
  ScenePad,
  ZoneFader,
  BpmTapper,
  BlackoutButton,
  ConnectionStatus,
} from "../../components/beginner";

// ─── Presets pour débutants (noms humains) ───
const BEGINNER_PADS: SmartPad[] = [
  { id: 1, name: "Éteint",     color: "bg-slate-700",    textColor: "text-slate-300",   iconName: "Moon",         qlcPage: 1, qlcWidget: 1 },
  { id: 2, name: "Accueil",    color: "bg-orange-400",  textColor: "text-orange-300", iconName: "Sun",          qlcPage: 1, qlcWidget: 2 },
  { id: 3, name: "Parole",     color: "bg-amber-200",   textColor: "text-amber-100",  iconName: "Mic",          qlcPage: 1, qlcWidget: 3 },
  { id: 4, name: "Bleu Calme", color: "bg-cyan-500",    textColor: "text-cyan-300",   iconName: "Droplets",     qlcPage: 1, qlcWidget: 4 },
  { id: 5, name: "Soirée",     color: "bg-pink-500",    textColor: "text-pink-300",   iconName: "Music",        qlcPage: 1, qlcWidget: 5 },
  { id: 6, name: "Strobe",     color: "bg-white",       textColor: "text-slate-800",  iconName: "Zap",          qlcPage: 1, qlcWidget: 6 },
];

const ZONES = [
  { key: "Master",     label: "Général", emoji: "🔆", accent: "cyan" },
  { key: "Stage",      label: "Scène",   emoji: "🎭", accent: "green" },
  { key: "Bar",        label: "Bar",     emoji: "🍷", accent: "orange" },
  { key: "Dancefloor", label: "Piste",   emoji: "💃", accent: "pink" },
] as const;

export default function SmartBeginnerPage() {
  const router = useRouter();
  const [socketConnected, setSocketConnected] = useState(false);

  const {
    smartActiveScene,
    setSmartActiveScene,
    smartZoneValues,
    setSmartZoneValue,
    setSmartBlackout,
    smartBlackout,
    bpm,
    setBpm,
    addToast,
  } = useStore();

  // Socket status
  useEffect(() => {
    setSocketConnected(socket.connected);
    const on = () => setSocketConnected(true);
    const off = () => setSocketConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => { socket.off("connect", on); socket.off("disconnect", off); };
  }, []);

  // ─── Zone fader ───
  const handleZoneChange = useCallback((zoneKey: string, value: number) => {
    setSmartZoneValue(zoneKey, value);
    const zoneIndex = ZONES.findIndex((z) => z.key === zoneKey) + 1;
    if (zoneIndex > 0) {
      socket.emit("smart:zone_intensity", {
        zoneId: zoneIndex,
        value: Math.round((value / 100) * 255),
      });
    }
  }, [setSmartZoneValue]);

  // ─── Scene pad click ───
  const handlePadClick = useCallback((pad: SmartPad) => {
    if (smartBlackout) {
      addToast({
        type: "warning",
        message: "Blackout actif",
        detail: "Désactivez le blackout avant de lancer une scène",
        duration: 2500,
      });
      return;
    }

    const isActive = smartActiveScene === pad.id;

    // Désactiver scène précédente
    if (smartActiveScene !== null && smartActiveScene !== pad.id) {
      const prev = BEGINNER_PADS.find((p) => p.id === smartActiveScene);
      if (prev) {
        socket.emit("smart:trigger_scene", {
          pageId: prev.qlcPage, widgetId: prev.qlcWidget, active: false,
        });
      }
    }

    // Activer / désactiver
    socket.emit("smart:trigger_scene", {
      pageId: pad.qlcPage, widgetId: pad.qlcWidget, active: !isActive,
    });
    setSmartActiveScene(isActive ? null : pad.id);

    addToast({
      type: isActive ? "info" : "success",
      message: isActive ? `"${pad.name}" arrêtée` : `"${pad.name}" lancée`,
      duration: 2000,
    });
  }, [smartActiveScene, smartBlackout, setSmartActiveScene, addToast]);

  // ─── Blackout ───
  const toggleBlackout = useCallback(() => {
    const next = !smartBlackout;
    setSmartBlackout(next);
    socket.emit("smart:blackout", { active: next });
    if (next) setSmartActiveScene(null);
    addToast({
      type: next ? "warning" : "info",
      message: next ? "BLACKOUT ACTIVÉ" : "Blackout désactivé",
      duration: 3000,
    });
  }, [smartBlackout, setSmartBlackout, setSmartActiveScene, addToast]);

  // ─── BPM ───
  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
    socket.emit("smart:bpm", { bpm: newBpm });
  }, [setBpm]);

  // Scene active name
  const activeSceneName = smartActiveScene
    ? BEGINNER_PADS.find((p) => p.id === smartActiveScene)?.name ?? "—"
    : "Aucune";

  return (
    <div className="w-screen h-screen bg-[#0a0c10] overflow-hidden flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="h-16 shrink-0 bg-[#12141a] border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${socketConnected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"} animate-pulse`} />
            <h1 className="text-white font-black tracking-widest text-lg">
              SMART <span className="text-cyan-400">MODE</span>
            </h1>
          </div>
        </div>

        <BpmTapper bpm={bpm} onBpmChange={handleBpmChange} />
        <BlackoutButton active={smartBlackout} onToggle={toggleBlackout} />
      </header>

      {/* ===== MAIN ===== */}
      <main className="flex-1 flex p-6 gap-6 overflow-hidden">
        {/* ─── Scène Pads ─── */}
        <section className="flex-1 flex flex-col min-w-0">
          <h2 className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Scènes
            {smartBlackout && (
              <span className="ml-auto text-red-400 text-[10px] animate-pulse">● BLACKOUT ACTIF</span>
            )}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 content-start">
            {BEGINNER_PADS.map((pad) => (
              <ScenePad
                key={pad.id}
                pad={pad}
                isActive={smartActiveScene === pad.id}
                disabled={smartBlackout && smartActiveScene !== pad.id}
                onClick={() => handlePadClick(pad)}
              />
            ))}
          </div>
        </section>

        {/* ─── Sidebar Controls ─── */}
        <aside className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Master */}
          <div className="bg-[#12141a] rounded-2xl border border-white/5 p-5">
            <ZoneFader
              label="MASTER"
              emoji="🔆"
              value={smartZoneValues["Master"] ?? 50}
              onChange={(v) => handleZoneChange("Master", v)}
              accentColor="cyan"
              showQuickButtons
            />
          </div>

          {/* Zones */}
          <div className="bg-[#12141a] rounded-2xl border border-white/5 p-5 flex flex-col gap-4">
            <h3 className="text-slate-400 text-xs font-bold tracking-widest uppercase">Zones</h3>
            {ZONES.map((zone) => (
              <ZoneFader
                key={zone.key}
                label={zone.label}
                emoji={zone.emoji}
                value={smartZoneValues[zone.key] ?? 50}
                onChange={(v) => handleZoneChange(zone.key, v)}
                accentColor={zone.accent}
              />
            ))}
          </div>

          {/* Status */}
          <div className="bg-[#12141a] rounded-2xl border border-white/5 p-4 space-y-2">
            <ConnectionStatus connected={socketConnected} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-widest">Scène active</span>
              <span className="text-white font-bold truncate max-w-[140px]">{activeSceneName}</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

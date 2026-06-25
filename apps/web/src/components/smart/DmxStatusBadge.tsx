"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import useStore from "../../store/useStore";
import { API_BASE } from "../../lib/config";
import { socket } from "../../lib/socket";
import type { DmxOutputHealthSnapshot, DmxOutputHealthState, DmxOutputId, DmxOutputState } from "../../types/dmx";

const OUTPUT_ORDER: DmxOutputId[] = ["usbDmx", "python", "artNet", "qlcOsc", "qlcWs"];

const OUTPUT_LABELS: Record<DmxOutputId, string> = {
  usbDmx: "USB DMX (UTD-10)",
  python: "Bridge Python",
  artNet: "Art-Net",
  qlcOsc: "QLC+ OSC",
  qlcWs: "QLC+ WebSocket",
};

const STATE_STYLES: Record<DmxOutputHealthState, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-green-400 shadow-[0_0_7px_#4ade80]", text: "text-green-300", label: "ok" },
  degraded: { dot: "bg-amber-400 shadow-[0_0_7px_#f59e0b]", text: "text-amber-300", label: "degrade" },
  error: { dot: "bg-red-400 shadow-[0_0_7px_#f87171]", text: "text-red-300", label: "erreur" },
  off: { dot: "bg-slate-600", text: "text-slate-500", label: "off" },
};

function shortError(message: string | null) {
  if (!message) return "Erreur inconnue";
  return message.length > 72 ? `${message.slice(0, 69)}...` : message;
}

function formatAge(timestamp: number | null, now: number) {
  if (!timestamp) return "jamais";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 2) return "a l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `il y a ${minutes} min`;
}

function getAggregateState(snapshot: DmxOutputHealthSnapshot | null, backendConnected: boolean, previewMode: boolean) {
  if (!backendConnected) {
    return {
      label: "Backend deconnecte - aucune sortie DMX",
      dotClass: "bg-red-400 shadow-[0_0_7px_#f87171]",
      className: "bg-red-500/10 border-red-500/30 text-red-300",
    };
  }
  if (previewMode) {
    return {
      label: "Preview : sorties coupees",
      dotClass: "bg-slate-500",
      className: "bg-black/40 border-white/5 text-slate-500",
    };
  }
  if (!snapshot) {
    return {
      label: "Statut DMX en attente",
      dotClass: "bg-amber-400",
      className: "bg-amber-500/10 border-amber-500/25 text-amber-300",
    };
  }

  const outputs = Object.values(snapshot.outputs).filter((output) => output.enabled);
  if (outputs.length === 0) {
    return {
      label: "Aucune sortie DMX active",
      dotClass: "bg-amber-400 shadow-[0_0_7px_#f59e0b]",
      className: "bg-amber-500/10 border-amber-500/25 text-amber-300",
    };
  }
  if (outputs.some((output) => output.state === "error")) {
    return {
      label: "Une sortie DMX est en erreur",
      dotClass: "bg-red-400 shadow-[0_0_7px_#f87171]",
      className: "bg-red-500/10 border-red-500/30 text-red-300",
    };
  }
  if (outputs.some((output) => output.state === "degraded")) {
    return {
      label: "Sortie DMX degradee",
      dotClass: "bg-amber-400 shadow-[0_0_7px_#f59e0b]",
      className: "bg-amber-500/10 border-amber-500/25 text-amber-300",
    };
  }
  return {
    label: "Sorties DMX OK",
    dotClass: "bg-green-400 shadow-[0_0_7px_#4ade80]",
    className: "bg-green-500/10 border-green-500/25 text-green-300",
  };
}

function OutputRow({ id, output, now }: { id: DmxOutputId; output: DmxOutputState; now: number }) {
  const style = STATE_STYLES[output.state];
  const lastActivity = output.state === "error" ? output.lastErrorAt : output.lastOkAt;
  const isUdp = id === "artNet" || id === "qlcOsc";

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-black text-slate-200">{OUTPUT_LABELS[id]}</span>
        <span className="font-mono text-[9px] text-slate-500">{output.enabled ? formatAge(lastActivity, now) : "desactivee"}</span>
        <span className={`text-[9px] font-black uppercase ${style.text}`}>{style.label}</span>
      </div>
      {output.state === "error" && (
        <p className="mt-1 truncate pl-4 text-[10px] font-semibold text-red-200/80">{shortError(output.lastErrorMessage)}</p>
      )}
      {isUdp && output.enabled && (
        <p className="mt-1 truncate pl-4 text-[9px] font-semibold text-slate-500">Envoi best-effort UDP, sans accuse de reception.</p>
      )}
    </div>
  );
}

export default function DmxStatusBadge({
  backendConnected,
  previewMode = false,
  onConfigure,
}: {
  backendConnected: boolean;
  previewMode?: boolean;
  onConfigure: () => void;
}) {
  const dmxOutputHealth = useStore((state) => state.dmxOutputHealth);
  const setDmxOutputHealth = useStore((state) => state.setDmxOutputHealth);
  const addToast = useStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousStatesRef = useRef<Partial<Record<DmxOutputId, DmxOutputHealthState>>>({});
  const recoveredAtRef = useRef<Partial<Record<DmxOutputId, number>>>({});

  const aggregate = useMemo(
    () => getAggregateState(dmxOutputHealth, backendConnected, previewMode),
    [backendConnected, dmxOutputHealth, previewMode],
  );

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dmx/output-status`);
        if (!response.ok) return;
        setDmxOutputHealth(await response.json() as DmxOutputHealthSnapshot);
      } catch {
        setDmxOutputHealth(null);
      }
    };
    refresh();

    const onStatus = (snapshot: DmxOutputHealthSnapshot) => setDmxOutputHealth(snapshot);
    socket.on("dmx_output_status", onStatus);
    return () => {
      socket.off("dmx_output_status", onStatus);
    };
  }, [setDmxOutputHealth]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!dmxOutputHealth) return;
    const currentTime = Date.now();
    OUTPUT_ORDER.forEach((id) => {
      const output = dmxOutputHealth.outputs[id];
      const previous = previousStatesRef.current[id];

      if (output.enabled && output.state === "error" && previous && previous !== "error") {
        const recoveredAt = recoveredAtRef.current[id];
        if (!recoveredAt || currentTime - recoveredAt >= 10000) {
          addToast({
            type: "error",
            message: `Sortie ${OUTPUT_LABELS[id]} en echec`,
            detail: shortError(output.lastErrorMessage),
          });
        }
      }

      if (output.enabled && output.state === "ok" && previous === "error") {
        recoveredAtRef.current[id] = currentTime;
        addToast({
          type: "success",
          message: `Sortie ${OUTPUT_LABELS[id]} retablie`,
        });
      }

      previousStatesRef.current[id] = output.state;
    });
  }, [addToast, dmxOutputHealth]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={aggregate.label}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold transition-all ${aggregate.className}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${aggregate.dotClass}`} />
        DMX
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[120] w-80 rounded-2xl border border-white/10 bg-[#12141A] p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sorties DMX</h3>
            <span className="font-mono text-[9px] text-slate-500">{dmxOutputHealth ? formatAge(dmxOutputHealth.at, now) : "offline"}</span>
          </div>

          <div className="space-y-1.5">
            {!backendConnected ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-200">
                Backend deconnecte - aucune sortie DMX.
              </div>
            ) : dmxOutputHealth ? (
              OUTPUT_ORDER.map((id) => (
                <OutputRow key={id} id={id} output={dmxOutputHealth.outputs[id]} now={now} />
              ))
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                Statut des sorties en attente.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onConfigure();
            }}
            className="mt-3 flex min-h-[34px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-xs font-black text-cyan-200 hover:bg-cyan-500/20"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurer...
          </button>
        </div>
      )}
    </div>
  );
}

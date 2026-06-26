"use client";

// ─────────────────────────────────────────────────────────────────────────
// EffectsArmingControl — armement des effets (laser / pyro-fumigène) en DESIGN.
//
// NE DUPLIQUE PAS la sécurité : la source de vérité reste le serveur
// (POST /api/safety/arm → setHazardArmed, TTL 30 min, broadcast socket
// "safety_status" qui re-synchronise laserArmed/pyroArmed dans le store).
// Ce composant ne fait qu'exposer un déclencheur VISIBLE en mode DESIGN, là où
// l'IA Lumière et la safety bloquent sinon tout effet non armé.
//
// Armement = geste délibéré en 2 clics (Armer → Confirmer) ; le 2e clic envoie
// la chaîne de confirmation attendue par le serveur ("ARM LASER" / "ARM PYRO").
// Désarmement = 1 clic. Le rôle "débutant" ne peut pas armer (erreur serveur
// remontée en toast avec l'indication d'aller passer Expert dans les Réglages).
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import useStore from "../../store/useStore";
import { API_BASE } from "../../lib/config";

type Hazard = "laser" | "pyro";

interface ArmRow {
  hazard: Hazard;
  label: string;
  hint: string;
}

// Le gate "pyro" couvre aussi fumigènes/hazer/CO2 (cf. fixtureCategories +
// buildSafetyContext : isArmingRequired non-laser → gate pyro conservateur).
const ROWS: ArmRow[] = [
  { hazard: "laser", label: "Laser", hint: "Faisceaux laser" },
  { hazard: "pyro", label: "Pyro / Fumigène", hint: "Pyro, flamme, fumigène, CO₂" },
];

export default function EffectsArmingControl() {
  const laserArmed = useStore((s) => s.laserArmed);
  const pyroArmed = useStore((s) => s.pyroArmed);
  const setLaserArmed = useStore((s) => s.setLaserArmed);
  const setPyroArmed = useStore((s) => s.setPyroArmed);
  const addToast = useStore((s) => (s as unknown as { addToast?: (t: unknown) => void }).addToast);

  const [pending, setPending] = useState<Hazard | null>(null);
  const [busy, setBusy] = useState<Hazard | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
  }, []);

  const isArmed = (h: Hazard) => (h === "laser" ? laserArmed : pyroArmed);

  const clearPending = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    setPending(null);
  };

  const callArm = async (hazard: Hazard, armed: boolean) => {
    setBusy(hazard);
    try {
      const res = await fetch(`${API_BASE}/api/safety/arm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hazard,
          armed,
          confirmation: armed ? `ARM ${hazard.toUpperCase()}` : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Armement refusé");

      // Synchro optimiste (le broadcast socket confirmera de toute façon).
      const next = Boolean((data as { armed?: Record<string, boolean> })?.armed?.[hazard]);
      if (hazard === "laser") setLaserArmed(next);
      else setPyroArmed(next);

      addToast?.({
        type: armed ? "warning" : "info",
        message: armed ? "Effet armé" : "Effet désarmé",
        detail: hazard === "laser" ? "Laser" : "Pyro / fumigène",
        duration: 3000,
      });
    } catch (err) {
      addToast?.({
        type: "error",
        message: "Sécurité",
        detail: `${(err as Error).message} — passe en rôle Expert (Réglages › Sécurité) pour armer.`,
        duration: 5500,
      });
    } finally {
      setBusy(null);
    }
  };

  const onArmClick = (hazard: Hazard) => {
    if (pending === hazard) {
      clearPending();
      void callArm(hazard, true);
      return;
    }
    // 1er clic : demande de confirmation, expire au bout de 4 s.
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    setPending(hazard);
    pendingTimer.current = setTimeout(() => setPending(null), 4000);
  };

  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-bold tracking-wider text-slate-500">
        <ShieldAlert className="w-3 h-3" />
        ARMEMENT EFFETS
      </div>
      <div className="flex flex-col gap-1.5">
        {ROWS.map((row) => {
          const armed = isArmed(row.hazard);
          const confirming = pending === row.hazard;
          const isBusy = busy === row.hazard;
          return (
            <div
              key={row.hazard}
              className={`rounded-lg border px-2 py-1.5 transition-colors ${
                armed
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-white/5 bg-black/30"
              }`}
              title={row.hint}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    armed ? "bg-red-400 shadow-[0_0_6px_#f87171]" : "bg-green-400"
                  }`}
                />
                <span className={`text-[11px] font-semibold ${armed ? "text-red-300" : "text-slate-300"}`}>
                  {row.label}
                </span>
                <span className="ml-auto text-[9px] font-bold tracking-wide text-slate-500">
                  {armed ? "ARMÉ" : "OFF"}
                </span>
              </div>
              {armed ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => callArm(row.hazard, false)}
                  className="mt-1.5 w-full rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold tracking-wide text-slate-300 py-1 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <ShieldCheck className="w-3 h-3" /> Désarmer
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onArmClick(row.hazard)}
                  className={`mt-1.5 w-full rounded-md text-[10px] font-bold tracking-wide py-1 transition-colors disabled:opacity-50 ${
                    confirming
                      ? "bg-red-500/25 hover:bg-red-500/35 text-red-200 border border-red-500/40"
                      : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                  }`}
                >
                  {confirming ? "Confirmer l'armement ?" : "Armer"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

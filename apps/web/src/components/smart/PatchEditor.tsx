"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Cable, RotateCcw, Save, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { API_BASE, apiFetch } from "../../lib/config";
import useStore from "../../store/useStore";

const ACCENT = "#22d3ee"; // cyan-400

// Une ligne de spec valide : "F:C", "S/E:C", "F:C1,C2" (ou vide / commentaire #).
const LINE_RE = /^\s*\d+(\/\d+)?\s*:\s*\d+(\s*,\s*\d+)*\s*$/;

/** Accès tolérant à addToast (ajouté par toastSlice) afin que le composant compile seul. */
type ToastActions = {
  addToast?: (t: {
    type: "success" | "error" | "warning" | "info";
    message: string;
    detail?: string;
    duration?: number;
  }) => void;
};

type LineStatus = {
  index: number;
  text: string;
  blank: boolean;
  comment: boolean;
  valid: boolean;
};

/** Analyse chaque ligne : vide / commentaire / valide / invalide. */
function analyzeLines(spec: string): LineStatus[] {
  return spec.split("\n").map((raw, index) => {
    const trimmed = raw.trim();
    const blank = trimmed.length === 0;
    const comment = trimmed.startsWith("#");
    const valid = blank || comment || LINE_RE.test(raw);
    return { index, text: raw, blank, comment, valid };
  });
}

export default function PatchEditor(): React.JSX.Element {
  const addToast = useStore((s) => (s as unknown as ToastActions).addToast);

  const [spec, setSpec] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const notify = useCallback(
    (
      type: "success" | "error" | "warning" | "info",
      message: string,
      detail?: string
    ) => {
      addToast?.({ type, message, detail });
    },
    [addToast]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/patch`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { spec?: unknown };
      setSpec(typeof data?.spec === "string" ? data.spec : "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setError(msg);
      notify("error", "Chargement du patch échoué", msg);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (nextSpec: string, label: string) => {
      setSaving(true);
      setError(null);
      try {
        const response = await apiFetch(`${API_BASE}/api/patch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spec: nextSpec }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { spec?: unknown };
        const saved = typeof data?.spec === "string" ? data.spec : nextSpec;
        setSpec(saved);
        const ruleCount = analyzeLines(saved).filter((l) => l.valid && !l.blank && !l.comment).length;
        notify(
          "success",
          label,
          ruleCount > 0 ? `${ruleCount} règle(s) appliquée(s)` : "Patch 1:1 (aucune règle)"
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur réseau";
        setError(msg);
        notify("error", "Sauvegarde échouée", msg);
      } finally {
        setSaving(false);
      }
    },
    [notify]
  );

  const lines = useMemo(() => analyzeLines(spec), [spec]);
  const invalidLines = useMemo(() => lines.filter((l) => !l.valid), [lines]);
  const ruleCount = useMemo(
    () => lines.filter((l) => l.valid && !l.blank && !l.comment).length,
    [lines]
  );
  const isEmpty = ruleCount === 0;

  const busy = loading || saving;

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[#090b0e] p-3 text-slate-300">
      {/* ----- Header ----- */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cable className="h-4 w-4 shrink-0 text-cyan-400" />
          <h2 className="truncate text-xs font-black uppercase tracking-widest text-white">
            Éditeur de patch
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={
              isEmpty
                ? { background: "rgba(255,255,255,0.06)", color: "#94a3b8" }
                : { background: "rgba(34,211,238,0.12)", color: ACCENT }
            }
          >
            {isEmpty ? "1:1" : `${ruleCount} règle(s)`}
          </span>
          <button
            onClick={() => void load()}
            disabled={busy}
            title="Recharger depuis le serveur"
            className="flex items-center justify-center rounded-md border border-white/5 bg-black/25 p-1.5 text-slate-400 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ----- Aide syntaxe ----- */}
      <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] leading-relaxed text-slate-500">
        Syntaxe Show Buddy (une règle par ligne) :{" "}
        <code className="font-mono text-slate-300">F:C</code> (fixture → canal),{" "}
        <code className="font-mono text-slate-300">S/E:C</code> (start/end → canal),{" "}
        <code className="font-mono text-slate-300">F:C1,C2</code> (multi-canaux). Vide = patch 1:1.
        Une ligne débutant par <code className="font-mono text-slate-300">#</code> est un commentaire.
      </div>

      {/* ----- Erreur réseau ----- */}
      {error && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ----- Zone d'édition ----- */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-white/5 bg-[#12141A]">
        {loading ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            <p className="text-[11px] text-slate-500">Chargement du patch…</p>
          </div>
        ) : (
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            disabled={saving}
            spellCheck={false}
            placeholder={"# Aucune règle — patch 1:1\n# Exemple :\n# 1:5\n# 2/4:10\n# 3:11,12,13"}
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-60"
          />
        )}
      </div>

      {/* ----- Lignes invalides ----- */}
      {!loading && invalidLines.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">
          <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" />
            {invalidLines.length} ligne(s) invalide(s) — sauvegarde autorisée
          </div>
          <ul className="space-y-0.5">
            {invalidLines.slice(0, 6).map((l) => (
              <li key={l.index} className="font-mono">
                L{l.index + 1}:{" "}
                <span className="text-amber-100">{l.text.trim() || "(vide)"}</span>
              </li>
            ))}
            {invalidLines.length > 6 && (
              <li className="text-amber-300/70">… +{invalidLines.length - 6} autre(s)</li>
            )}
          </ul>
        </div>
      )}

      {/* ----- Empty-state (info, pas bloquant) ----- */}
      {!loading && isEmpty && invalidLines.length === 0 && (
        <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] text-slate-500">
          Aucune règle définie : le patch est en correspondance directe 1:1.
        </div>
      )}

      {/* ----- Actions ----- */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => void save(spec, "Patch enregistré")}
          disabled={busy}
          title="Enregistrer la spec courante"
          className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.1)", color: "#a5f3fc" }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
        <button
          onClick={() => {
            setSpec("");
            void save("", "Patch réinitialisé (1:1)");
          }}
          disabled={busy}
          title="Vider la spec et appliquer un patch 1:1"
          className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          Réinitialiser (1:1)
        </button>
      </div>
    </div>
  );
}

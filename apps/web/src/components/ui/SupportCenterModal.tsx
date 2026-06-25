"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Download, FileText, LifeBuoy, RefreshCw, Trash2, X } from "lucide-react";
import { API_BASE } from "../../lib/config";

interface SupportLog {
  timestamp: string;
  source: string;
  message: string;
  severity: "info" | "warning" | "error";
}

interface SupportLogsResponse {
  path?: string;
  logs?: SupportLog[];
}

interface DiagnosticResponse {
  diagnosis?: string;
  status?: {
    pythonDmx?: { active?: boolean };
    usbDmx?: { connected?: boolean };
    qlcWs?: { connected?: boolean };
    cached?: boolean;
  };
}

interface SupportCenterModalProps {
  onClose: () => void;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = (await response.json()) as T;
    if (!response.ok) {
      const maybeError = data as { error?: string; details?: string };
      throw new Error(maybeError.details || maybeError.error || "Requete support impossible");
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function SupportCenterModal({ onClose }: SupportCenterModalProps) {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<SupportLog[]>([]);
  const [logPath, setLogPath] = useState("");
  const [diagnosis, setDiagnosis] = useState<DiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = async () => {
    setLoading(true);
    setStatus("");
    try {
      const [logsResult, diagnosisResult] = await Promise.allSettled([
        fetchJsonWithTimeout<SupportLogsResponse>(`${API_BASE}/api/support/logs?limit=80`, 8_000),
        fetchJsonWithTimeout<DiagnosticResponse>(`${API_BASE}/api/diagnose`, 15_000),
      ]);

      if (logsResult.status === "fulfilled") {
        setLogs(Array.isArray(logsResult.value.logs) ? logsResult.value.logs : []);
        setLogPath(logsResult.value.path || "");
      } else {
        setStatus(getErrorMessage(logsResult.reason));
      }

      if (diagnosisResult.status === "fulfilled") {
        setDiagnosis(diagnosisResult.value);
      } else {
        setStatus(getErrorMessage(diagnosisResult.reason));
      }
    } catch (error: unknown) {
      setStatus(getErrorMessage(error) || "Support indisponible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const exportSupport = async () => {
    try {
      const report = await fetchJsonWithTimeout<unknown>(`${API_BASE}/api/support/report`, 15_000);
      downloadJson(`glow-logic-support-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, report);
      setStatus("Rapport support exporte");
    } catch (error: unknown) {
      setStatus(getErrorMessage(error) || "Export impossible");
    }
  };

  const clearLogs = async () => {
    if (!confirm("Vider les logs support locaux ?")) return;
    await fetch(`${API_BASE}/api/support/logs/clear`, { method: "POST" });
    await refresh();
    setStatus("Logs support vides");
  };

  if (!mounted) return null;

  const errorCount = logs.filter((log) => log.severity === "error").length;
  const warningCount = logs.filter((log) => log.severity === "warning").length;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[84vh] bg-[#12141A] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 overflow-hidden flex flex-col">
        <header className="h-16 border-b border-white/5 px-5 flex items-center justify-between bg-black/25 shrink-0">
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-cyan-400" />
              Centre support
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">Diagnostic, logs et export support client.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-black/30 hover:bg-white/5 border border-white/10 text-slate-300 text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
            <button
              onClick={exportSupport}
              className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-black flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              Export support
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[320px_1fr] min-h-0 flex-1">
          <aside className="border-r border-white/5 bg-black/20 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Warnings</p>
                <p className="text-amber-400 text-2xl font-black">{warningCount}</p>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Errors</p>
                <p className="text-red-400 text-2xl font-black">{errorCount}</p>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-xl p-4">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">DMX</p>
              <div className="space-y-2 text-[11px]">
                {[
                  ["Python DMX", diagnosis?.status?.pythonDmx?.active],
                  ["USB DMX", diagnosis?.status?.usbDmx?.connected],
                  ["QLC+ WS", diagnosis?.status?.qlcWs?.connected],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className={ok ? "text-green-400 font-black" : "text-slate-500 font-black"}>{ok ? "OK" : "OFF"}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={clearLogs}
              className="w-full px-3 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-black flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Vider les logs
            </button>

            {logPath && (
              <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Fichier log</p>
                <p className="text-[10px] text-slate-400 font-mono break-all">{logPath}</p>
              </div>
            )}
          </aside>

          <main className="p-5 min-h-0 flex flex-col">
            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-4 mb-4">
              <h3 className="text-xs text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Diagnostic rapide
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-28 overflow-y-auto custom-scrollbar">
                {diagnosis?.diagnosis || "Diagnostic en attente..."}
              </p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Logs recents
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">{logs.length} entree(s)</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">Aucun log support.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} className="grid grid-cols-[92px_80px_1fr] gap-3 bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-[11px]">
                    <span className="text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString("fr-FR")}</span>
                    <span className={log.severity === "error" ? "text-red-400 font-black" : log.severity === "warning" ? "text-amber-400 font-black" : "text-cyan-400 font-black"}>
                      {log.source}
                    </span>
                    <span className="text-slate-300 truncate">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>

        {status && (
          <div className="h-10 border-t border-white/5 bg-black/30 px-5 flex items-center text-xs text-slate-400 font-semibold">
            {status}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

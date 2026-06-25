"use client";

import React from "react";
import { Activity, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import useStore from "../../store/useStore";

type SupportLog = {
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

type DiagnosisResult = {
  diagnosis: string;
  hasAnomalies: boolean;
  status: {
    pythonDmx: { active: boolean };
    usbDmx: { connected: boolean };
    qlcWs: { connected: boolean };
    serialPorts: Array<{ path: string; friendlyName?: string; manufacturer?: string }>;
    supportLogs?: SupportLog[];
    supportLogPath?: string;
  };
};

type ChecklistItem = {
  label: string;
  ok: boolean;
  optional?: boolean;
  detail: string;
};

type Snapshot = {
  id: string | number;
  label: string;
  createdAt: number;
};

type CrashSnapshotMeta = {
  clean?: boolean;
  fresh?: boolean;
  updatedAt?: number;
};

type OfflineProjectBackupMeta = {
  updatedAt: number;
  projectName: string | null;
  pads: number;
  clips: number;
};

type SmartToolsModalsProps = {
  diagnosisResult: DiagnosisResult | null;
  isDiagnosing: boolean;
  e2eSteps: ChecklistItem[];
  e2eRequiredOk: boolean;
  recoverySteps: ChecklistItem[];
  recoveryRequiredOk: boolean;
  crashSnapshotMeta: CrashSnapshotMeta | null;
  latestShowSnapshot: Snapshot | null;
  offlineProjectBackup: OfflineProjectBackupMeta | null;
  runDiagnostics: () => void;
  downloadSupportReport: () => void;
  handlePreflightSnapshot: () => void;
  exportPreflightReport: () => void;
  handleRecoverySnapshot: () => void;
  handleRecoverySave: () => void;
  handleRestoreLatestSnapshot: () => void;
  handleRestoreOfflineBackup: () => void;
  formatRecoveryAge: (timestamp?: number) => string;
};

export default function SmartToolsModals({
  diagnosisResult,
  isDiagnosing,
  e2eSteps,
  e2eRequiredOk,
  recoverySteps,
  recoveryRequiredOk,
  crashSnapshotMeta,
  latestShowSnapshot,
  offlineProjectBackup,
  runDiagnostics,
  downloadSupportReport,
  handlePreflightSnapshot,
  exportPreflightReport,
  handleRecoverySnapshot,
  handleRecoverySave,
  handleRestoreLatestSnapshot,
  handleRestoreOfflineBackup,
  formatRecoveryAge,
}: SmartToolsModalsProps) {
  const { openTool, setOpenTool } = useStore();

  if (!openTool) return null;

  const close = () => setOpenTool(null);

  if (openTool === "diagnostic") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-[#12141A] p-6 shadow-2xl shadow-cyan-500/5">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
              <Sparkles className="h-5 w-5 animate-pulse text-cyan-400" />
              Diagnostic IA du DMX
            </h2>
            <button onClick={close} className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-white" title="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!diagnosisResult ? (
            <div className="rounded-xl border border-white/5 bg-black/30 p-5 text-sm text-slate-300">
              <p className="font-semibold">Aucun rapport charge pour cette session.</p>
              <button
                onClick={runDiagnostics}
                disabled={isDiagnosing}
                className="mt-4 min-h-[44px] rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 text-xs font-black text-cyan-100 disabled:opacity-50"
              >
                {isDiagnosing ? "Diagnostic..." : "Lancer le diagnostic"}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Connexions</h4>
                  <div className="space-y-2 text-xs">
                    <StatusRow label="Pont DMX Python" ok={diagnosisResult.status.pythonDmx.active} />
                    <StatusRow label="USB-DMX" ok={diagnosisResult.status.usbDmx.connected} />
                    <StatusRow label="QLC+ WebSocket" ok={diagnosisResult.status.qlcWs.connected} />
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 p-4">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Ports COM detectes</h4>
                  <div className="max-h-[80px] space-y-1.5 overflow-y-auto text-xs custom-scrollbar">
                    {diagnosisResult.status.serialPorts.length === 0 ? (
                      <span className="font-bold text-red-400">Aucun port COM trouve</span>
                    ) : (
                      diagnosisResult.status.serialPorts.map((port) => (
                        <div key={port.path} className="flex justify-between gap-2 font-mono text-[11px] text-slate-300">
                          <span>{port.path}</span>
                          <span className="truncate text-slate-500">{port.friendlyName || port.manufacturer}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <Sparkles className="h-4 w-4 animate-pulse text-purple-400" />
                  Analyse & solutions recommandees
                </h4>
                <div className="max-h-[220px] overflow-y-auto whitespace-pre-line rounded-xl border border-purple-500/10 bg-[#0a0c10] p-4 text-sm font-medium leading-relaxed text-slate-300 custom-scrollbar">
                  {diagnosisResult.diagnosis}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Journal support</h4>
                <div className="max-h-[120px] space-y-1.5 overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] custom-scrollbar">
                  {(diagnosisResult.status.supportLogs || []).length === 0 ? (
                    <div className="text-slate-500">Aucun log support recent.</div>
                  ) : (
                    (diagnosisResult.status.supportLogs || []).slice(0, 8).map((log, index) => (
                      <div key={`${log.timestamp}-${index}`} className="grid grid-cols-[72px_70px_1fr] gap-2 text-slate-300">
                        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString("fr-FR")}</span>
                        <span className={log.severity === "error" ? "text-red-400" : log.severity === "warning" ? "text-amber-400" : "text-cyan-400"}>
                          {log.source}
                        </span>
                        <span className="truncate">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={downloadSupportReport} className="flex-1 rounded-xl border border-white/10 bg-black/40 py-3 text-sm font-black text-white hover:bg-white/5">
                  Export support
                </button>
                <button onClick={close} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 py-3 text-sm font-black text-black hover:from-cyan-400 hover:to-cyan-500">
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (openTool === "preflight") {
    return (
      <ToolFrame
        accent="cyan"
        icon={<Activity className="h-5 w-5 text-cyan-400" />}
        title="Verification avant show"
        subtitle="Validez le chemin complet avant evenement: DMX, offline, safety, bibliotheque, backup et controle."
        onClose={close}
      >
        <Checklist items={e2eSteps} />
        <Verdict ready={e2eRequiredOk} readyText="Pret pour test reel" warningText="Points a verifier" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToolButton onClick={runDiagnostics} disabled={isDiagnosing}>
            {isDiagnosing ? "Diagnostic..." : "Diagnostic DMX"}
          </ToolButton>
          <ToolButton onClick={handlePreflightSnapshot}>Snapshot</ToolButton>
          <ToolButton onClick={exportPreflightReport}>Export rapport</ToolButton>
          <ToolButton onClick={close} primary>Fermer</ToolButton>
        </div>
      </ToolFrame>
    );
  }

  return (
    <ToolFrame
      accent="amber"
      icon={<ShieldCheck className="h-5 w-5 text-amber-400" />}
      title="Recuperation de show"
      subtitle="Reprendre vite apres crash, coupure backend ou mauvaise manipulation."
      onClose={close}
    >
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="Verdict" value={recoveryRequiredOk ? "Reprise prete" : "A securiser"} ok={recoveryRequiredOk} />
        <Metric label="Dernier autosnapshot" value={crashSnapshotMeta ? formatRecoveryAge(crashSnapshotMeta.updatedAt) : "Aucun"} />
        <Metric label="Snapshot offline" value={offlineProjectBackup ? `${offlineProjectBackup.pads} pads - ${formatRecoveryAge(offlineProjectBackup.updatedAt)}` : "Aucun"} />
      </div>
      <Checklist items={recoverySteps} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ToolButton onClick={handleRecoverySnapshot}>Snapshot maintenant</ToolButton>
        <ToolButton onClick={handleRecoverySave}>Sauvegarder projet</ToolButton>
        <ToolButton onClick={handleRestoreLatestSnapshot} disabled={!latestShowSnapshot}>
          <RotateCcw className="h-4 w-4 text-amber-400" />
          Restaurer dernier
        </ToolButton>
        <ToolButton onClick={handleRestoreOfflineBackup} disabled={!offlineProjectBackup}>
          <RotateCcw className="h-4 w-4 text-amber-400" />
          Restaurer offline
        </ToolButton>
        <ToolButton onClick={runDiagnostics} disabled={isDiagnosing} primary>
          {isDiagnosing ? "Diagnostic..." : "Diagnostic"}
        </ToolButton>
      </div>
    </ToolFrame>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono font-bold ${ok ? "text-green-400" : "text-red-400"}`}>{ok ? "OK" : "OFF"}</span>
    </div>
  );
}

function ToolFrame({
  accent,
  icon,
  title,
  subtitle,
  onClose,
  children,
}: {
  accent: "cyan" | "amber";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const border = accent === "cyan" ? "border-cyan-500/20 shadow-cyan-500/5" : "border-amber-500/20 shadow-amber-500/5";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className={`max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-[#12141A] p-6 shadow-2xl custom-scrollbar ${border}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
              {icon}
              {title}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border bg-black/30 p-4 ${item.ok ? "border-green-500/20" : item.optional ? "border-amber-500/20" : "border-red-500/20"}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-white">{item.label}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${item.ok ? "text-green-400" : item.optional ? "text-amber-400" : "text-red-400"}`}>
              {item.ok ? "OK" : item.optional ? "Optionnel" : "A faire"}
            </span>
          </div>
          <p className="text-[11px] font-semibold leading-relaxed text-slate-400">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Verdict({ ready, readyText, warningText }: { ready: boolean; readyText: string; warningText: string }) {
  return (
    <div className="mb-5 rounded-xl border border-white/5 bg-[#0a0c10] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">Verdict</h3>
        <span className={`text-[10px] font-black uppercase tracking-widest ${ready ? "text-green-400" : "text-amber-400"}`}>
          {ready ? readyText : warningText}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`truncate text-sm font-black ${ok === undefined ? "text-white" : ok ? "text-green-400" : "text-amber-400"}`}>{value}</p>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition-all disabled:opacity-50 ${
        primary
          ? "bg-gradient-to-r from-cyan-500 to-amber-500 text-black hover:from-cyan-400 hover:to-amber-400"
          : "border border-white/10 bg-black/40 text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

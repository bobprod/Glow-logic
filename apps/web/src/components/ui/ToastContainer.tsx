"use client";

import React from "react";
import useStore from "../../store/useStore";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import type { ToastType } from "../../store/slices/toastSlice";

const STYLES: Record<
  ToastType,
  { border: string; icon: React.ReactNode; bar: string; label: string }
> = {
  success: {
    border: "border-green-500/30 bg-green-500/10",
    icon: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
    bar: "bg-green-500",
    label: "text-green-300",
  },
  error: {
    border: "border-red-500/30 bg-red-500/10",
    icon: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
    bar: "bg-red-500",
    label: "text-red-300",
  },
  warning: {
    border: "border-amber-500/30 bg-amber-500/10",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
    bar: "bg-amber-500",
    label: "text-amber-300",
  },
  info: {
    border: "border-cyan-500/30 bg-cyan-500/10",
    icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
    bar: "bg-cyan-500",
    label: "text-cyan-300",
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type];
        const dur = t.duration ?? 3000;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-[360px] rounded-xl border ${s.border} backdrop-blur-xl shadow-2xl px-4 py-3 animate-in slide-in-from-right-8 fade-in duration-200 relative overflow-hidden`}
          >
            {/* Progress bar */}
            <div
              className={`absolute bottom-0 left-0 h-0.5 ${s.bar} opacity-60`}
              style={{
                animation: `shrink ${dur}ms linear forwards`,
              }}
            />
            {s.icon}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${s.label} leading-snug`}>
                {t.message}
              </p>
              {t.detail && (
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                  {t.detail}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-500 hover:text-white transition-colors shrink-0 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

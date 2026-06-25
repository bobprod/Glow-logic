"use client";

import React, { useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import useStore from "../../store/useStore";
import type { AiInspectorLogType } from "../../store/slices/uiSlice";

const LOG_COLOR: Record<AiInspectorLogType, string> = {
  sys: "text-green-400",
  ai: "text-cyan-400",
  warn: "text-yellow-400",
  osc: "text-slate-400",
  info: "text-blue-400",
};

export default function AiInspectorPanel() {
  const { aiInspectorLogs, clearAiInspectorLogs } = useStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiInspectorLogs]);

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-cyan-500/15 bg-black/25 p-3">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
          <Terminal className="h-4 w-4 text-cyan-400" />
          AI Inspector
          <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">
            Diagnostics IA
          </span>
        </h2>
        <button
          type="button"
          onClick={clearAiInspectorLogs}
          className="rounded-lg border border-white/10 bg-black/30 p-1.5 text-slate-500 transition-colors hover:border-red-500/30 hover:text-red-300"
          title="Vider l'inspecteur"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/5 bg-[#05070a] p-2 font-mono text-[9px] custom-scrollbar">
        {aiInspectorLogs.length === 0 && (
          <p className="text-slate-600 italic">Aucun evenement.</p>
        )}
        {aiInspectorLogs.map((log) => (
          <p key={log.id} className={`${LOG_COLOR[log.type]} break-words leading-relaxed`}>
            {log.text}
          </p>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

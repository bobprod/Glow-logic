"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  Music,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Play,
  Square,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "error" | "stopped";
  capabilities: string[];
}

interface DiagnosticReport {
  timestamp: string;
  overallStatus: "healthy" | "warning" | "critical";
  fixtures: any[];
  alerts: any[];
  recommendations: string[];
}

// ─── Agent Icons ────────────────────────────────────────────────────────────
const AGENT_ICONS: Record<string, React.ReactNode> = {
  "agent-audio-lighting": <Music className="w-5 h-5" />,
  "agent-scenographer": <Lightbulb className="w-5 h-5" />,
  "agent-diagnostics": <AlertTriangle className="w-5 h-5" />,
  "agent-learning": <BookOpen className="w-5 h-5" />,
};

const AGENT_COLORS: Record<string, string> = {
  "agent-audio-lighting": "#ef4444",
  "agent-scenographer": "#f59e0b",
  "agent-diagnostics": "#10b981",
  "agent-learning": "#8b5cf6",
};

const API = "http://localhost:3005";

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

  // Fetch agents
  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
        setBackendConnected(true);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      setBackendConnected(false);
    }
  };

  // Fetch diagnostics
  const fetchDiagnostics = async () => {
    try {
      const res = await fetch(`${API}/api/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (error) {
      console.error("Failed to fetch diagnostics:", error);
    }
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchDiagnostics()]);
      setLoading(false);
    };
    load();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAgents();
      fetchDiagnostics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Agent action
  const handleAgentAction = async (agentId: string, action: string) => {
    try {
      const res = await fetch(`${API}/api/agents/${agentId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: {} }),
      });

      if (res.ok) {
        // Refresh agents
        await fetchAgents();
      }
    } catch (error) {
      console.error("Agent action failed:", error);
    }
  };

  // Orchestrate
  const handleOrchestrate = async () => {
    try {
      const res = await fetch(`${API}/api/orchestrator/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            audio: null,
            sceneRequest: { type: "contextual" },
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Orchestration result:", data);
      }
    } catch (error) {
      console.error("Orchestration failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20">
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-black tracking-widest text-sm uppercase text-white">
                Agents ACP
              </h1>
              <p className="text-[10px] text-slate-500">
                Orchestration d&apos;agents IA pour l&apos;éclairage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backend status */}
            <div className="flex items-center gap-2 text-xs">
              {backendConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Backend OK</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400">Hors ligne</span>
                </>
              )}
            </div>

            {/* Orchestrate button */}
            <button
              onClick={handleOrchestrate}
              disabled={!backendConnected}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Orchestrer
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Agents Grid */}
        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
            Agents Disponibles
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-white/5 bg-[#0d1117] p-5 hover:border-white/10 transition-all"
                >
                  {/* Agent header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="p-2 rounded-xl"
                      style={{
                        backgroundColor: `${AGENT_COLORS[agent.id]}20`,
                      }}
                    >
                      <div style={{ color: AGENT_COLORS[agent.id] }}>
                        {AGENT_ICONS[agent.id]}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-white">{agent.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            agent.status === "running"
                              ? "bg-emerald-400 shadow-[0_0_6px_#4ade80]"
                              : agent.status === "error"
                              ? "bg-red-400"
                              : "bg-slate-600"
                          }`}
                        />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                    {agent.description}
                  </p>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.capabilities.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-500"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAgentAction(agent.id, "start")}
                      disabled={agent.status === "running"}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      Démarrer
                    </button>
                    <button
                      onClick={() => handleAgentAction(agent.id, "stop")}
                      disabled={agent.status !== "running"}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all disabled:opacity-50"
                    >
                      <Square className="w-3 h-3" />
                      Arrêter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diagnostics */}
        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
            Diagnostics
          </h2>

          {diagnostics ? (
            <div className="rounded-2xl border border-white/5 bg-[#0d1117] p-5">
              {/* Status */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    diagnostics.overallStatus === "healthy"
                      ? "bg-emerald-400 shadow-[0_0_8px_#4ade80]"
                      : diagnostics.overallStatus === "warning"
                      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                      : "bg-red-400 shadow-[0_0_8px_#f87171]"
                  }`}
                />
                <span className="font-bold text-sm">
                  {diagnostics.overallStatus === "healthy"
                    ? "Tout est normal"
                    : diagnostics.overallStatus === "warning"
                    ? "Attention requise"
                    : "Problème détecté"}
                </span>
                <span className="text-[10px] text-slate-500 ml-auto">
                  {new Date(diagnostics.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Recommendations */}
              {diagnostics.recommendations.length > 0 && (
                <div className="space-y-2">
                  {diagnostics.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-slate-400 bg-white/[0.02] rounded-lg p-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={fetchDiagnostics}
                className="mt-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualiser
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-[#0d1117] p-5 text-center text-slate-500 text-sm">
              Chargement des diagnostics...
            </div>
          )}
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400/70 mb-3">
            À propos des Agents ACP
          </h3>
          <div className="text-xs text-slate-400 space-y-2">
            <p>
              <strong className="text-white">Agent Audio/Lumière :</strong> Analyse le spectre audio en temps réel
              et convertit les fréquences en couleurs RGB pour l&apos;éclairage.
            </p>
            <p>
              <strong className="text-white">Agent Scénographe :</strong> Génère des suggestions de scènes
              basées sur le contexte (heure, mood, événement).
            </p>
            <p>
              <strong className="text-white">Agent Diagnostique :</strong> Surveille les connexions DMX et
              détecte les problèmes potentiels.
            </p>
            <p>
              <strong className="text-white">Agent Apprentissage :</strong> Apprend vos préférences et
              suggère des améliorations personnalisées.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

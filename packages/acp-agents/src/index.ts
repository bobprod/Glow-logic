// ============================================================
// ACP Agents - Main Entry Point
// ============================================================

export { Orchestrator, getOrchestrator } from "./orchestrator/orchestrator.js";
export { AudioLightingAgent } from "./agents/audio-lighting.js";
export { ScenographerAgent } from "./agents/scenographer.js";
export { DiagnosticsAgent } from "./agents/diagnostics.js";
export { LearningAgent } from "./agents/learning.js";
export { BaseAgent } from "./agents/base-agent.js";
export { GlowLogicClient, getGlowLogicClient } from "./shared/api-client.js";

// Types
export type {
  AgentId,
  AgentManifest,
  AgentState,
  AgentStatus,
  AcpMessage,
  AcpRun,
  AudioAnalysis,
  LightingSuggestion,
  SceneSuggestion,
  DiagnosticAlert,
  LearningData,
  UserPreferences,
  OrchestratorState,
} from "./shared/types.js";

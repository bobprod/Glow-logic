// ============================================================
// ACP Orchestrator
// Coordinates all agents and manages communication
// ============================================================

import { randomUUID } from "crypto";
import {
  AgentId,
  AgentState,
  AcpMessage,
  AcpRun,
  OrchestratorState,
  LightingSuggestion,
} from "../shared/types.js";
import { AudioLightingAgent } from "../agents/audio-lighting.js";
import { ScenographerAgent } from "../agents/scenographer.js";
import { DiagnosticsAgent } from "../agents/diagnostics.js";
import { LearningAgent } from "../agents/learning.js";
import { GlowLogicClient, getGlowLogicClient } from "../shared/api-client.js";

export class Orchestrator {
  private agents: Map<AgentId, any> = new Map();
  private api: GlowLogicClient;
  private state: OrchestratorState;
  private messageHistory: AcpMessage[] = [];

  constructor() {
    this.api = getGlowLogicClient();
    this.state = {
      agents: {} as Record<AgentId, AgentState>,
      activeRuns: [],
      messageQueue: [],
      lastOrchestration: null,
    };

    // Initialize agents
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Create agent instances
    const audioLighting = new AudioLightingAgent();
    const scenographer = new ScenographerAgent();
    const diagnostics = new DiagnosticsAgent();
    const learning = new LearningAgent();

    // Register agents
    this.agents.set("agent-audio-lighting", audioLighting);
    this.agents.set("agent-scenographer", scenographer);
    this.agents.set("agent-diagnostics", diagnostics);
    this.agents.set("agent-learning", learning);

    // Initialize state
    for (const [id, agent] of this.agents) {
      this.state.agents[id] = agent.getState();
    }
  }

  // Agent management
  getAgent(id: AgentId): any {
    return this.agents.get(id);
  }

  getAgentState(id: AgentId): AgentState | undefined {
    return this.state.agents[id];
  }

  getAllAgentStates(): Record<AgentId, AgentState> {
    return { ...this.state.agents };
  }

  // Message handling
  async sendMessage(message: AcpMessage): Promise<any> {
    // Store message
    this.messageHistory.push(message);
    if (this.messageHistory.length > 1000) {
      this.messageHistory.shift();
    }

    // Route message
    if (message.to === "orchestrator") {
      return this.handleOrchestratorMessage(message);
    }

    const agent = this.agents.get(message.to as AgentId);
    if (!agent) {
      throw new Error(`Agent not found: ${message.to}`);
    }

    return agent.handleMessage(message);
  }

  private async handleOrchestratorMessage(message: AcpMessage): Promise<any> {
    switch (message.action) {
      case "get_all_states":
        return this.getAllAgentStates();
      
      case "start_agent":
        return this.startAgent(message.payload.agentId);
      
      case "stop_agent":
        return this.stopAgent(message.payload.agentId);
      
      case "orchestrate":
        return this.orchestrate(message.payload);
      
      default:
        throw new Error(`Unknown orchestrator action: ${message.action}`);
    }
  }

  // Agent lifecycle
  async startAgent(agentId: AgentId): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.state.agents[agentId].status = "running";
    console.log(`Started agent: ${agentId}`);
  }

  async stopAgent(agentId: AgentId): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    await this.sendMessage({
      id: randomUUID(),
      timestamp: new Date(),
      from: "orchestrator",
      to: agentId,
      type: "request",
      action: "stop",
      payload: {},
    });

    this.state.agents[agentId].status = "stopped";
    console.log(`Stopped agent: ${agentId}`);
  }

  // Orchestration
  async orchestrate(context: any): Promise<LightingSuggestion> {
    console.log("Starting orchestration with context:", context);

    const suggestions: LightingSuggestion[] = [];

    // Get suggestion from Audio/Lighting agent if audio is active
    if (context.audio) {
      try {
        const audioAgent = this.agents.get("agent-audio-lighting");
        const audioRun = await audioAgent.startRun({ audio: context.audio });
        if (audioRun.output) {
          suggestions.push(audioRun.output);
        }
      } catch (error) {
        console.error("Audio agent error:", error);
      }
    }

    // Get suggestion from Scenographer agent
    if (context.sceneRequest) {
      try {
        const scenographerAgent = this.agents.get("agent-scenographer");
        const sceneRun = await scenographerAgent.startRun({ request: context.sceneRequest });
        if (sceneRun.output) {
          const lightingSuggestion = scenographerAgent.sceneToLightingSuggestion(sceneRun.output);
          suggestions.push(lightingSuggestion);
        }
      } catch (error) {
        console.error("Scenographer agent error:", error);
      }
    }

    // Get suggestions from Learning agent
    try {
      const learningAgent = this.agents.get("agent-learning");
      const learningRun = await learningAgent.startRun({ action: "suggest" });
      if (learningRun.output?.suggestions) {
        // Learning suggestions are informational
        console.log("Learning suggestions:", learningRun.output.suggestions);
      }
    } catch (error) {
      console.error("Learning agent error:", error);
    }

    // Merge suggestions (simple merge - take highest confidence)
    const mergedSuggestion = this.mergeSuggestions(suggestions);

    // Apply to Glow Logic
    await this.applyLightingSuggestion(mergedSuggestion);

    // Record action in learning agent
    try {
      const learningAgent = this.agents.get("agent-learning");
      await learningAgent.startRun({
        action: "record",
        payload: {
          type: "orchestration",
          context: {
            audioActive: !!context.audio,
            sceneRequest: context.sceneRequest,
          },
        },
      });
    } catch (error) {
      console.error("Learning agent record error:", error);
    }

    this.state.lastOrchestration = new Date();
    return mergedSuggestion;
  }

  private mergeSuggestions(suggestions: LightingSuggestion[]): LightingSuggestion {
    if (suggestions.length === 0) {
      return {
        agentId: "orchestrator",
        confidence: 0,
        groups: {},
        reasoning: "No suggestions to merge",
        timestamp: new Date(),
      };
    }

    if (suggestions.length === 1) {
      return suggestions[0];
    }

    // Sort by confidence
    const sorted = suggestions.sort((a, b) => b.confidence - a.confidence);
    const best = sorted[0];

    // Merge groups from all suggestions
    const mergedGroups: Record<string, { intensity: number; color: string; effect?: string }> = {};
    
    for (const suggestion of sorted) {
      for (const [group, settings] of Object.entries(suggestion.groups)) {
        if (!mergedGroups[group] || suggestion.confidence > 0.5) {
          mergedGroups[group] = settings;
        }
      }
    }

    return {
      agentId: "orchestrator",
      confidence: best.confidence,
      groups: mergedGroups,
      reasoning: `Merged ${suggestions.length} suggestions`,
      timestamp: new Date(),
    };
  }

  private async applyLightingSuggestion(suggestion: LightingSuggestion): Promise<void> {
    for (const [group, settings] of Object.entries(suggestion.groups)) {
      try {
        // Parse hex color
        const hex = settings.color.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        await this.api.setColor(group, r, g, b, settings.intensity);
      } catch (error) {
        console.error(`Failed to set group ${group}:`, error);
      }
    }
  }

  // Diagnostics
  async runDiagnostics(): Promise<any> {
    const diagnosticsAgent = this.agents.get("agent-diagnostics");
    if (!diagnosticsAgent) {
      throw new Error("Diagnostics agent not available");
    }

    const run = await diagnosticsAgent.startRun({ action: "full_check" });
    return run.output;
  }

  // Get recent messages
  getRecentMessages(limit: number = 50): AcpMessage[] {
    return this.messageHistory.slice(-limit);
  }

  // Get orchestrator state
  getState(): OrchestratorState {
    return { ...this.state };
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

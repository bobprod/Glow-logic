// ============================================================
// ACP Agent Types for Glow Logic
// ============================================================

// Agent identification
export type AgentId = 
  | "agent-audio-lighting"
  | "agent-scenographer"
  | "agent-diagnostics"
  | "agent-learning";

// Agent status
export type AgentStatus = "idle" | "running" | "error" | "stopped";

// Agent manifest (for ACP discovery)
export interface AgentManifest {
  id: AgentId;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
}

// Agent state
export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  lastRun: Date | null;
  runCount: number;
  errorCount: number;
  lastError?: string;
  metrics: AgentMetrics;
}

// Agent metrics
export interface AgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunTime: number;
}

// ACP Message
export interface AcpMessage {
  id: string;
  timestamp: Date;
  from: AgentId | "orchestrator" | "user";
  to: AgentId | "orchestrator" | "user";
  type: "request" | "response" | "event" | "error";
  action: string;
  payload: any;
  metadata?: Record<string, any>;
}

// ACP Run (task execution)
export interface AcpRun {
  id: string;
  agentId: AgentId;
  status: "pending" | "running" | "completed" | "failed";
  input: any;
  output?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

// Audio analysis data
export interface AudioAnalysis {
  bass: number;      // 0-1
  mid: number;       // 0-1
  treble: number;    // 0-1
  energy: number;    // 0-1 global RMS
  bpm: number;
  isOnset: boolean;
  timestamp: Date;
}

// Lighting suggestion
export interface LightingSuggestion {
  agentId: AgentId;
  confidence: number;  // 0-1
  groups: Record<string, {
    intensity: number;
    color: string;     // hex
    effect?: string;
  }>;
  reasoning: string;
  timestamp: Date;
}

// Scene suggestion
export interface SceneSuggestion {
  name: string;
  description: string;
  mood: string;
  groups: Record<string, {
    intensity: number;
    color: string;
  }>;
  duration: number;  // seconds
  transition: number; // fade time in seconds
}

// Diagnostic alert
export interface DiagnosticAlert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  type: string;
  message: string;
  fixtureId?: number;
  address?: number;
  universe?: number;
  suggestion?: string;
  timestamp: Date;
}

// Learning data
export interface LearningData {
  userId?: string;
  preferences: UserPreferences;
  history: PreferenceHistory[];
  patterns: UsagePattern[];
}

// User preferences
export interface UserPreferences {
  favoriteScenes: string[];
  favoriteGroups: string[];
  preferredMoods: string[];
  timeOfDayPatterns: Record<string, string>;  // "morning" -> "calm"
  lastUsed: Record<string, Date>;
}

// Preference history
export interface PreferenceHistory {
  action: string;
  context: Record<string, any>;
  timestamp: Date;
  satisfaction?: number;  // 1-5 rating
}

// Usage patterns
export interface UsagePattern {
  type: string;
  frequency: number;
  timeRange: string;
  description: string;
}

// Agent configuration
export interface AgentConfig {
  enabled: boolean;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  updateInterval: number;  // ms
  maxHistory: number;
  customSettings?: Record<string, any>;
}

// Orchestrator state
export interface OrchestratorState {
  agents: Record<AgentId, AgentState>;
  activeRuns: AcpRun[];
  messageQueue: AcpMessage[];
  lastOrchestration: Date | null;
}

// Glow Logic backend API interface
export interface GlowLogicAPI {
  baseUrl: string;
  
  // DMX control
  setChannel(universe: number, channel: number, value: number): Promise<void>;
  setGroup(group: string, intensity: number): Promise<void>;
  setColor(group: string, r: number, g: number, b: number, intensity: number): Promise<void>;
  blackout(active: boolean): Promise<void>;
  setBpm(bpm: number): Promise<void>;
  
  // Patch
  getPatch(): Promise<any[]>;
  addPatchFixture(fixture: any): Promise<number>;
  
  // Scenes
  getScenes(): Promise<any[]>;
  saveScene(scene: any): Promise<void>;
  loadScene(name: string): Promise<void>;
  
  // Settings
  getSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;
}

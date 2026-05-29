// ============================================================
// Agent Audio/Lumière
// Analyzes audio input and generates lighting responses
// ============================================================

import { AgentId, AudioAnalysis, LightingSuggestion } from "../shared/types.js";
import { BaseAgent } from "./base-agent.js";

const AGENT_MANIFEST = {
  id: "agent-audio-lighting" as AgentId,
  name: "Agent Audio/Lumière",
  description: "Analyse le spectre audio et génère des réponses d'éclairage en temps réel",
  version: "1.0.0",
  capabilities: [
    "audio-analysis",
    "frequency-to-color",
    "bpm-detection",
    "real-time-lighting",
    "drop-effects",
  ],
  inputTypes: ["audio-stream", "audio-config"],
  outputTypes: ["lighting-commands", "color-values"],
};

// Color mapping from frequency bands
const FREQUENCY_COLORS = {
  bass: { r: 255, g: 60, b: 60 },      // Red
  mid: { r: 60, g: 255, b: 120 },      // Green
  treble: { r: 60, g: 120, b: 255 },   // Blue
};

// Group phase offsets for wave effects
const GROUP_PHASES: Record<string, number> = {
  A: 0,
  B: Math.PI / 3,
  C: (2 * Math.PI) / 3,
  D: Math.PI,
  E: (4 * Math.PI) / 3,
  F: (5 * Math.PI) / 3,
};

interface AudioLightingConfig {
  sensitivity: number;      // 0-100
  colorMode: "frequency" | "energy" | "custom";
  smoothing: number;        // 0-100
  waveEnabled: boolean;
  dropEffect: "none" | "flash-white" | "flash-color" | "strobe";
  activeGroups: string[];
  maxIntensity: number;     // 0-100
}

const DEFAULT_CONFIG: AudioLightingConfig = {
  sensitivity: 70,
  colorMode: "frequency",
  smoothing: 50,
  waveEnabled: true,
  dropEffect: "flash-color",
  activeGroups: ["A", "B", "C", "D"],
  maxIntensity: 100,
};

export class AudioLightingAgent extends BaseAgent {
  private config: AudioLightingConfig = DEFAULT_CONFIG;
  private smoothedValues: Record<string, [number, number, number]> = {};
  private lastOnsetTime: number = 0;
  private bpmHistory: number[] = [];
  private currentBpm: number = 0;

  constructor() {
    super("agent-audio-lighting", AGENT_MANIFEST);
    this.registerHandler("update_config", this.handleUpdateConfig.bind(this));
    this.registerHandler("process_audio", this.handleProcessAudio.bind(this));
  }

  protected async execute(input: any): Promise<LightingSuggestion> {
    const { audio, config } = input;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    return this.processAudioFrame(audio);
  }

  private async handleUpdateConfig(message: any): Promise<any> {
    this.config = { ...this.config, ...message.payload };
    return { success: true, config: this.config };
  }

  private async handleProcessAudio(message: any): Promise<any> {
    return this.processAudioFrame(message.payload);
  }

  private processAudioFrame(audio: AudioAnalysis): LightingSuggestion {
    // Apply sensitivity
    const sensitivity = this.config.sensitivity / 100;
    const bass = audio.bass * sensitivity;
    const mid = audio.mid * sensitivity;
    const treble = audio.treble * sensitivity;
    const energy = audio.energy * sensitivity;

    // Calculate BPM
    if (audio.bpm > 0) {
      this.bpmHistory.push(audio.bpm);
      if (this.bpmHistory.length > 10) this.bpmHistory.shift();
      this.currentBpm = Math.round(
        this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length
      );
    }

    // Generate base color from frequencies
    const baseColor = this.frequencyToColor(bass, mid, treble, energy);

    // Calculate group colors with wave effect
    const groups: Record<string, { intensity: number; color: string; effect?: string }> = {};
    const now = Date.now();

    for (const group of this.config.activeGroups) {
      const phase = this.config.waveEnabled ? GROUP_PHASES[group] || 0 : 0;
      const waveMod = this.config.waveEnabled
        ? (Math.sin(now / 1000 + phase) + 1) / 2
        : 1;

      // Apply smoothing
      const target: [number, number, number] = [
        Math.round(baseColor.r * waveMod),
        Math.round(baseColor.g * waveMod),
        Math.round(baseColor.b * waveMod),
      ];

      const smoothed = this.smoothValues(group, target);
      const hex = this.rgbToHex(smoothed[0], smoothed[1], smoothed[2]);

      // Calculate intensity based on energy
      const intensity = Math.round(energy * this.config.maxIntensity);

      groups[group] = {
        intensity,
        color: hex,
      };

      // Handle drop effects
      if (audio.isOnset && bass > 0.6 && now - this.lastOnsetTime > 500) {
        this.lastOnsetTime = now;
        groups[group].effect = this.config.dropEffect;
      }
    }

    return {
      agentId: this.id,
      confidence: energy,
      groups,
      reasoning: `Bass: ${(bass * 100).toFixed(0)}%, Mid: ${(mid * 100).toFixed(0)}%, Treble: ${(treble * 100).toFixed(0)}%, Energy: ${(energy * 100).toFixed(0)}%, BPM: ${this.currentBpm}`,
      timestamp: new Date(),
    };
  }

  private frequencyToColor(
    bass: number,
    mid: number,
    treble: number,
    energy: number
  ): { r: number; g: number; b: number } {
    // Normalize
    const total = bass + mid + treble + 0.001;
    const b = bass / total;
    const m = mid / total;
    const t = treble / total;

    // Map to RGB
    let r = Math.round((b * FREQUENCY_COLORS.bass.r + m * FREQUENCY_COLORS.mid.r + t * FREQUENCY_COLORS.treble.r) * energy);
    let g = Math.round((b * FREQUENCY_COLORS.bass.g + m * FREQUENCY_COLORS.mid.g + t * FREQUENCY_COLORS.treble.g) * energy);
    let bv = Math.round((b * FREQUENCY_COLORS.bass.b + m * FREQUENCY_COLORS.mid.b + t * FREQUENCY_COLORS.treble.b) * energy);

    // Clamp
    r = this.clamp(r, 0, 255);
    g = this.clamp(g, 0, 255);
    bv = this.clamp(bv, 0, 255);

    return { r, g, g: bv };
  }

  private smoothValues(
    group: string,
    target: [number, number, number]
  ): [number, number, number] {
    const smoothFactor = this.config.smoothing / 1000;
    const prev = this.smoothedValues[group] || target;

    const smoothed: [number, number, number] = [
      Math.round(this.lerp(prev[0], target[0], smoothFactor)),
      Math.round(this.lerp(prev[1], target[1], smoothFactor)),
      Math.round(this.lerp(prev[2], target[2], smoothFactor)),
    ];

    this.smoothedValues[group] = smoothed;
    return smoothed;
  }
}

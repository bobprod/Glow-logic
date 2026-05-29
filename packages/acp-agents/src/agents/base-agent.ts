// ============================================================
// Base Agent Class for ACP
// ============================================================

import { randomUUID } from "crypto";
import {
  AgentId,
  AgentManifest,
  AgentState,
  AgentStatus,
  AgentMetrics,
  AcpMessage,
  AcpRun,
} from "../shared/types.js";
import { GlowLogicClient, getGlowLogicClient } from "../shared/api-client.js";

export abstract class BaseAgent {
  protected id: AgentId;
  protected manifest: AgentManifest;
  protected state: AgentState;
  protected api: GlowLogicClient;
  protected messageHandlers: Map<string, (message: AcpMessage) => Promise<any>> = new Map();

  constructor(id: AgentId, manifest: AgentManifest) {
    this.id = id;
    this.manifest = manifest;
    this.api = getGlowLogicClient();
    this.state = {
      id,
      status: "idle",
      lastRun: null,
      runCount: 0,
      errorCount: 0,
      metrics: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageRunTime: 0,
        lastRunTime: 0,
      },
    };

    // Register default message handlers
    this.registerHandler("ping", this.handlePing.bind(this));
    this.registerHandler("get_status", this.handleGetStatus.bind(this));
    this.registerHandler("stop", this.handleStop.bind(this));
  }

  // Getters
  getId(): AgentId {
    return this.id;
  }

  getManifest(): AgentManifest {
    return this.manifest;
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getStatus(): AgentStatus {
    return this.state.status;
  }

  // Message handling
  registerHandler(action: string, handler: (message: AcpMessage) => Promise<any>): void {
    this.messageHandlers.set(action, handler);
  }

  async handleMessage(message: AcpMessage): Promise<any> {
    const handler = this.messageHandlers.get(message.action);
    if (!handler) {
      throw new Error(`No handler for action: ${message.action}`);
    }
    return handler(message);
  }

  // Run management
  async startRun(input: any): Promise<AcpRun> {
    const run: AcpRun = {
      id: randomUUID(),
      agentId: this.id,
      status: "running",
      input,
      startTime: new Date(),
    };

    this.state.status = "running";
    this.state.lastRun = new Date();
    this.state.runCount++;
    this.state.metrics.totalRuns++;

    try {
      const output = await this.execute(input);
      run.output = output;
      run.status = "completed";
      run.endTime = new Date();
      run.duration = run.endTime.getTime() - run.startTime.getTime();
      this.state.metrics.successfulRuns++;
      this.updateAverageRunTime(run.duration);
    } catch (error) {
      run.error = error instanceof Error ? error.message : String(error);
      run.status = "failed";
      run.endTime = new Date();
      run.duration = run.endTime.getTime() - run.startTime.getTime();
      this.state.metrics.failedRuns++;
      this.state.errorCount++;
      this.state.lastError = run.error;
      throw error;
    } finally {
      this.state.status = "idle";
      this.state.metrics.lastRunTime = run.duration || 0;
    }

    return run;
  }

  // Abstract method - must be implemented by each agent
  protected abstract execute(input: any): Promise<any>;

  // Default handlers
  private async handlePing(message: AcpMessage): Promise<any> {
    return { pong: true, agentId: this.id, timestamp: new Date() };
  }

  private async handleGetStatus(message: AcpMessage): Promise<any> {
    return this.getState();
  }

  private async handleStop(message: AcpMessage): Promise<any> {
    this.state.status = "stopped";
    return { stopped: true, agentId: this.id };
  }

  // Metrics
  private updateAverageRunTime(newTime: number): void {
    const { successfulRuns, averageRunTime } = this.state.metrics;
    this.state.metrics.averageRunTime =
      (averageRunTime * (successfulRuns - 1) + newTime) / successfulRuns;
  }

  // Utility methods
  protected hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  protected rgbToHex(r: number, g: number, b: number): string {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  protected clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

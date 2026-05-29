// ============================================================
// Agent Diagnostique
// Monitors and diagnoses DMX lighting issues
// ============================================================

import { AgentId, DiagnosticAlert } from "../shared/types.js";
import { BaseAgent } from "./base-agent.js";
import { randomUUID } from "crypto";

const AGENT_MANIFEST = {
  id: "agent-diagnostics" as AgentId,
  name: "Agent Diagnostique",
  description: "Surveille et diagnostique les problèmes d'éclairage DMX",
  version: "1.0.0",
  capabilities: [
    "dmx-monitoring",
    "fixture-detection",
    "connection-check",
    "issue-alerting",
  ],
  inputTypes: ["diagnostic-request", "monitor-config"],
  outputTypes: ["diagnostic-report", "alert"],
};

interface FixtureStatus {
  id: number;
  name: string;
  universe: number;
  startAddress: number;
  channelCount: number;
  lastResponse: Date | null;
  responseTime: number;
  isOnline: boolean;
  issues: string[];
}

interface DiagnosticReport {
  timestamp: Date;
  overallStatus: "healthy" | "warning" | "critical";
  fixtures: FixtureStatus[];
  alerts: DiagnosticAlert[];
  recommendations: string[];
}

interface MonitorConfig {
  checkInterval: number;     // ms
  timeoutThreshold: number;  // ms
  enableAutoFix: boolean;
  alertThreshold: "warning" | "error" | "critical";
}

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  checkInterval: 5000,
  timeoutThreshold: 1000,
  enableAutoFix: false,
  alertThreshold: "warning",
};

export class DiagnosticsAgent extends BaseAgent {
  private fixtureStatuses: Map<number, FixtureStatus> = new Map();
  private alerts: DiagnosticAlert[] = [];
  private monitorConfig: MonitorConfig = DEFAULT_MONITOR_CONFIG;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    super("agent-diagnostics", AGENT_MANIFEST);
    this.registerHandler("start_monitoring", this.handleStartMonitoring.bind(this));
    this.registerHandler("stop_monitoring", this.handleStopMonitoring.bind(this));
    this.registerHandler("check_fixture", this.handleCheckFixture.bind(this));
    this.registerHandler("get_report", this.handleGetReport.bind(this));
    this.registerHandler("get_alerts", this.handleGetAlerts.bind(this));
    this.registerHandler("clear_alerts", this.handleClearAlerts.bind(this));
  }

  protected async execute(input: any): Promise<DiagnosticReport> {
    const { action, payload } = input;
    
    switch (action) {
      case "full_check":
        return this.performFullCheck();
      case "check_fixture":
        return this.checkFixtureStatus(payload.fixtureId);
      case "get_report":
        return this.generateReport();
      default:
        return this.performFullCheck();
    }
  }

  private async handleStartMonitoring(message: any): Promise<any> {
    this.startMonitoring(message.payload);
    return { success: true, message: "Monitoring started" };
  }

  private async handleStopMonitoring(): Promise<any> {
    this.stopMonitoring();
    return { success: true, message: "Monitoring stopped" };
  }

  private async handleCheckFixture(message: any): Promise<any> {
    return this.checkFixtureStatus(message.payload.fixtureId);
  }

  private async handleGetReport(): Promise<any> {
    return this.generateReport();
  }

  private async handleGetAlerts(): Promise<any> {
    return this.getRecentAlerts();
  }

  private async handleClearAlerts(): Promise<any> {
    this.alerts = [];
    return { success: true };
  }

  // Monitoring
  startMonitoring(config?: Partial<MonitorConfig>): void {
    if (config) {
      this.monitorConfig = { ...this.monitorConfig, ...config };
    }

    this.stopMonitoring();
    
    this.monitorInterval = setInterval(async () => {
      try {
        await this.performFullCheck();
      } catch (error) {
        console.error("Monitoring error:", error);
      }
    }, this.monitorConfig.checkInterval);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  // Diagnostics
  private async performFullCheck(): Promise<DiagnosticReport> {
    const patch = await this.api.getPatch();
    const alerts: DiagnosticAlert[] = [];

    // Update fixture statuses
    for (const fixture of patch) {
      const status = await this.checkFixtureStatus(fixture.id);
      if (status.issues.length > 0) {
        alerts.push(...this.generateAlerts(fixture, status));
      }
    }

    // Check for common issues
    const commonIssues = await this.checkCommonIssues(patch);
    alerts.push(...commonIssues);

    // Store alerts
    this.alerts.push(...alerts);

    return this.generateReport();
  }

  private async checkFixtureStatus(fixtureId: number): Promise<FixtureStatus> {
    const patch = await this.api.getPatch();
    const fixture = patch.find((f: any) => f.id === fixtureId);

    if (!fixture) {
      return {
        id: fixtureId,
        name: "Unknown",
        universe: 0,
        startAddress: 0,
        channelCount: 0,
        lastResponse: null,
        responseTime: 0,
        isOnline: false,
        issues: ["Fixture not found in patch"],
      };
    }

    const startTime = Date.now();
    let isOnline = false;
    const issues: string[] = [];

    try {
      // Try to localize the fixture (brief flash)
      await fetch(`http://localhost:3005/api/patch/${fixtureId}/localize`, {
        method: "POST",
      });
      isOnline = true;
    } catch (error) {
      issues.push("Fixture not responding");
    }

    const responseTime = Date.now() - startTime;

    const status: FixtureStatus = {
      id: fixtureId,
      name: fixture.name,
      universe: fixture.universe,
      startAddress: fixture.start_address,
      channelCount: fixture.channel_count,
      lastResponse: isOnline ? new Date() : null,
      responseTime,
      isOnline,
      issues,
    };

    this.fixtureStatuses.set(fixtureId, status);
    return status;
  }

  private async checkCommonIssues(patch: any[]): Promise<DiagnosticAlert[]> {
    const alerts: DiagnosticAlert[] = [];

    // Check for address conflicts
    const addressMap = new Map<string, any>();
    for (const fixture of patch) {
      const key = `${fixture.universe}:${fixture.start_address}`;
      if (addressMap.has(key)) {
        alerts.push({
          id: randomUUID(),
          severity: "error",
          type: "address_conflict",
          message: `Address conflict at universe ${fixture.universe}, address ${fixture.start_address}`,
          fixtureId: fixture.id,
          address: fixture.start_address,
          universe: fixture.universe,
          suggestion: "Reassign fixture address",
          timestamp: new Date(),
        });
      }
      addressMap.set(key, fixture);
    }

    // Check for overlapping channels
    for (let i = 0; i < patch.length; i++) {
      for (let j = i + 1; j < patch.length; j++) {
        const a = patch[i];
        const b = patch[j];
        
        if (a.universe !== b.universe) continue;

        const aEnd = a.start_address + a.channel_count - 1;
        const bEnd = b.start_address + b.channel_count - 1;

        if (a.start_address <= bEnd && b.start_address <= aEnd) {
          alerts.push({
            id: randomUUID(),
            severity: "warning",
            type: "channel_overlap",
            message: `Channel overlap between "${a.name}" and "${b.name}" in universe ${a.universe}`,
            suggestion: "Adjust fixture addresses to prevent overlap",
            timestamp: new Date(),
          });
        }
      }
    }

    // Check for high address usage
    const universeUsage = new Map<number, number>();
    for (const fixture of patch) {
      const usage = universeUsage.get(fixture.universe) || 0;
      universeUsage.set(fixture.universe, usage + fixture.channel_count);
    }

    for (const [universe, usage] of universeUsage) {
      if (usage > 400) { // More than 78% of 512 channels
        alerts.push({
          id: randomUUID(),
          severity: "info",
          type: "high_usage",
          message: `Universe ${universe} is ${Math.round((usage / 512) * 100)}% utilized (${usage}/512 channels)`,
          universe,
          suggestion: "Consider distributing fixtures across multiple universes",
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  private generateAlerts(fixture: any, status: FixtureStatus): DiagnosticAlert[] {
    const alerts: DiagnosticAlert[] = [];

    if (!status.isOnline) {
      alerts.push({
        id: randomUUID(),
        severity: "error",
        type: "fixture_offline",
        message: `Fixture "${status.name}" is not responding`,
        fixtureId: status.id,
        address: status.startAddress,
        universe: status.universe,
        suggestion: "Check DMX cable connections and power supply",
        timestamp: new Date(),
      });
    }

    if (status.responseTime > this.monitorConfig.timeoutThreshold) {
      alerts.push({
        id: randomUUID(),
        severity: "warning",
        type: "slow_response",
        message: `Fixture "${status.name}" response time is slow (${status.responseTime}ms)`,
        fixtureId: status.id,
        suggestion: "Check for network congestion or DMX line issues",
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  private generateReport(): DiagnosticReport {
    const fixtures = Array.from(this.fixtureStatuses.values());
    const recentAlerts = this.getRecentAlerts();

    // Determine overall status
    let overallStatus: "healthy" | "warning" | "critical" = "healthy";
    
    for (const alert of recentAlerts) {
      if (alert.severity === "critical") {
        overallStatus = "critical";
        break;
      }
      if (alert.severity === "error") {
        overallStatus = "warning";
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(fixtures, recentAlerts);

    return {
      timestamp: new Date(),
      overallStatus,
      fixtures,
      alerts: recentAlerts,
      recommendations,
    };
  }

  private generateRecommendations(
    fixtures: FixtureStatus[],
    alerts: DiagnosticAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for offline fixtures
    const offlineFixtures = fixtures.filter((f) => !f.isOnline);
    if (offlineFixtures.length > 0) {
      recommendations.push(
        `${offlineFixtures.length} fixture(s) offline. Check connections.`
      );
    }

    // Check for address conflicts
    const conflicts = alerts.filter((a) => a.type === "address_conflict");
    if (conflicts.length > 0) {
      recommendations.push(
        `${conflicts.length} address conflict(s) detected. Reassign addresses.`
      );
    }

    // Check for high utilization
    const highUsage = alerts.filter((a) => a.type === "high_usage");
    if (highUsage.length > 0) {
      recommendations.push(
        "Consider adding more DMX universes for better distribution."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("All systems operating normally.");
    }

    return recommendations;
  }

  private getRecentAlerts(minutes: number = 5): DiagnosticAlert[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.alerts.filter((a) => a.timestamp > cutoff);
  }
}

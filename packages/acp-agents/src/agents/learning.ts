// ============================================================
// Agent Apprentissage
// Learns user preferences and suggests improvements
// ============================================================

import { AgentId, UserPreferences, PreferenceHistory, UsagePattern } from "../shared/types.js";
import { BaseAgent } from "./base-agent.js";

const AGENT_MANIFEST = {
  id: "agent-learning" as AgentId,
  name: "Agent Apprentissage",
  description: "Apprend les préférences utilisateur et suggère des améliorations",
  version: "1.0.0",
  capabilities: [
    "preference-learning",
    "pattern-detection",
    "personalized-suggestions",
    "usage-analytics",
  ],
  inputTypes: ["user-action", "feedback"],
  outputTypes: ["suggestion", "preference-update"],
};

const STORAGE_KEY = "glow_logic_learning_data";

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteScenes: [],
  favoriteGroups: [],
  preferredMoods: [],
  timeOfDayPatterns: {},
  lastUsed: {},
};

export class LearningAgent extends BaseAgent {
  private preferences: UserPreferences = DEFAULT_PREFERENCES;
  private history: PreferenceHistory[] = [];
  private patterns: UsagePattern[] = [];

  constructor() {
    super("agent-learning", AGENT_MANIFEST);
    this.registerHandler("record_action", this.handleRecordAction.bind(this));
    this.registerHandler("get_suggestions", this.handleGetSuggestions.bind(this));
    this.registerHandler("get_preferences", this.handleGetPreferences.bind(this));
    this.registerHandler("update_preferences", this.handleUpdatePreferences.bind(this));
    this.registerHandler("get_analytics", this.handleGetAnalytics.bind(this));
  }

  protected async execute(input: any): Promise<any> {
    const { action, payload } = input;
    
    switch (action) {
      case "record":
        return this.recordAction(payload);
      case "suggest":
        return this.generateSuggestions();
      case "analyze":
        return this.analyzeUsage();
      default:
        return this.generateSuggestions();
    }
  }

  private async handleRecordAction(message: any): Promise<any> {
    return this.recordAction(message.payload);
  }

  private async handleGetSuggestions(): Promise<any> {
    return this.generateSuggestions();
  }

  private async handleGetPreferences(): Promise<any> {
    return this.preferences;
  }

  private async handleUpdatePreferences(message: any): Promise<any> {
    this.preferences = { ...this.preferences, ...message.payload };
    return this.preferences;
  }

  private async handleGetAnalytics(): Promise<any> {
    return this.analyzeUsage();
  }

  // Recording
  private recordAction(action: {
    type: string;
    context: Record<string, any>;
    satisfaction?: number;
  }): any {
    const record: PreferenceHistory = {
      action: action.type,
      context: action.context,
      timestamp: new Date(),
      satisfaction: action.satisfaction,
    };

    this.history.push(record);

    // Update preferences based on action
    this.updatePreferencesFromAction(action);

    // Detect patterns
    this.detectPatterns();

    return { success: true, recorded: record };
  }

  private updatePreferencesFromAction(action: {
    type: string;
    context: Record<string, any>;
  }): void {
    const { type, context } = action;

    switch (type) {
      case "scene_loaded":
        if (context.sceneName) {
          this.addToFavorites("favoriteScenes", context.sceneName);
        }
        break;

      case "group_used":
        if (context.group) {
          this.addToFavorites("favoriteGroups", context.group);
        }
        break;

      case "mood_selected":
        if (context.mood) {
          this.addToFavorites("preferredMoods", context.mood);
        }
        break;

      case "time_based_usage":
        const hour = new Date().getHours();
        const timeOfDay = this.getTimeOfDay(hour);
        if (context.mood) {
          this.preferences.timeOfDayPatterns[timeOfDay] = context.mood;
        }
        break;
    }

    // Update last used
    if (context.sceneName || context.mood) {
      const key = context.sceneName || context.mood;
      this.preferences.lastUsed[key] = new Date();
    }
  }

  private addToFavorites(key: "favoriteScenes" | "favoriteGroups" | "preferredMoods", value: string): void {
    const favorites = this.preferences[key];
    const index = favorites.indexOf(value);
    
    if (index > -1) {
      // Move to front (more recent)
      favorites.splice(index, 1);
      favorites.unshift(value);
    } else {
      // Add to front
      favorites.unshift(value);
    }

    // Keep only top 10
    if (favorites.length > 10) {
      favorites.pop();
    }
  }

  // Pattern detection
  private detectPatterns(): void {
    this.patterns = [];

    // Detect time-based patterns
    const hourlyUsage: Record<number, number> = {};
    this.history.forEach((record) => {
      const hour = record.timestamp.getHours();
      hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1;
    });

    // Find peak hours
    const peakHours = Object.entries(hourlyUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0) {
      this.patterns.push({
        type: "peak_hours",
        frequency: peakHours.length,
        timeRange: peakHours.map((h) => `${h}:00`).join(", "),
        description: `Most active during: ${peakHours.map((h) => `${h}:00`).join(", ")}`,
      });
    }

    // Detect scene preferences
    const sceneCounts: Record<string, number> = {};
    this.history
      .filter((r) => r.action === "scene_loaded")
      .forEach((record) => {
        const scene = record.context.sceneName;
        sceneCounts[scene] = (sceneCounts[scene] || 0) + 1;
      });

    const favoriteScene = Object.entries(sceneCounts)
      .sort(([, a], [, b]) => b - a)[0];

    if (favoriteScene) {
      this.patterns.push({
        type: "favorite_scene",
        frequency: favoriteScene[1],
        timeRange: "all",
        description: `Most used scene: ${favoriteScene[0]} (${favoriteScene[1]} times)`,
      });
    }

    // Detect mood transitions
    const moodSequence: string[] = [];
    this.history
      .filter((r) => r.action === "mood_selected")
      .forEach((record) => {
        moodSequence.push(record.context.mood);
      });

    if (moodSequence.length >= 2) {
      const transitions: Record<string, number> = {};
      for (let i = 1; i < moodSequence.length; i++) {
        const transition = `${moodSequence[i - 1]} -> ${moodSequence[i]}`;
        transitions[transition] = (transitions[transition] || 0) + 1;
      }

      const commonTransition = Object.entries(transitions)
        .sort(([, a], [, b]) => b - a)[0];

      if (commonTransition) {
        this.patterns.push({
          type: "mood_transition",
          frequency: commonTransition[1],
          timeRange: "all",
          description: `Common mood transition: ${commonTransition[0]}`,
        });
      }
    }
  }

  // Suggestions
  private generateSuggestions(): any {
    const suggestions: any[] = [];

    // Suggest based on time of day
    const hour = new Date().getHours();
    const timeOfDay = this.getTimeOfDay(hour);
    const preferredMood = this.preferences.timeOfDayPatterns[timeOfDay];

    if (preferredMood) {
      suggestions.push({
        type: "time_based",
        confidence: 0.8,
        suggestion: `Based on your habits, you might prefer a ${preferredMood} mood at this time`,
        mood: preferredMood,
      });
    }

    // Suggest favorite scenes
    if (this.preferences.favoriteScenes.length > 0) {
      suggestions.push({
        type: "favorite",
        confidence: 0.9,
        suggestion: `Try your favorite scene: ${this.preferences.favoriteScenes[0]}`,
        scene: this.preferences.favoriteScenes[0],
      });
    }

    // Suggest based on patterns
    if (this.patterns.length > 0) {
      const peakHoursPattern = this.patterns.find((p) => p.type === "peak_hours");
      if (peakHoursPattern) {
        const currentHour = new Date().getHours();
        const peakHours = peakHoursPattern.timeRange
          .split(", ")
          .map((h) => parseInt(h));

        if (peakHours.includes(currentHour)) {
          suggestions.push({
            type: "pattern",
            confidence: 0.7,
            suggestion: "This is typically a busy time for you. Would you like to use a preset?",
          });
        }
      }
    }

    return {
      suggestions,
      preferences: this.preferences,
      patterns: this.patterns,
    };
  }

  // Analytics
  private analyzeUsage(): any {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentHistory = this.history.filter((r) => r.timestamp > last24h);
    const weeklyHistory = this.history.filter((r) => r.timestamp > lastWeek);

    // Calculate satisfaction average
    const satisfactionScores = this.history
      .filter((r) => r.satisfaction !== undefined)
      .map((r) => r.satisfaction as number);

    const averageSatisfaction =
      satisfactionScores.length > 0
        ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
        : 0;

    // Count actions by type
    const actionCounts: Record<string, number> = {};
    this.history.forEach((record) => {
      actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;
    });

    return {
      summary: {
        totalActions: this.history.length,
        last24h: recentHistory.length,
        lastWeek: weeklyHistory.length,
        averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
      },
      actionCounts,
      preferences: this.preferences,
      patterns: this.patterns,
      topScenes: this.preferences.favoriteScenes.slice(0, 5),
      topMoods: this.preferences.preferredMoods.slice(0, 5),
    };
  }

  // Utilities
  private getTimeOfDay(hour: number): string {
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    if (hour >= 21 && hour < 24) return "night";
    return "late_night";
  }

  // Persistence (simplified - in real app, use database)
  async savePreferences(): Promise<void> {
    const data = {
      preferences: this.preferences,
      history: this.history.slice(-100), // Keep last 100
      patterns: this.patterns,
    };
    
    // In production, save to database
    console.log("Saving learning data:", data);
  }

  async loadPreferences(): Promise<void> {
    // In production, load from database
    console.log("Loading learning data...");
  }
}

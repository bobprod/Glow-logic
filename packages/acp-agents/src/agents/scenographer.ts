// ============================================================
// Agent Scénographe
// Generates lighting scene suggestions based on context
// ============================================================

import { AgentId, SceneSuggestion, LightingSuggestion } from "../shared/types.js";
import { BaseAgent } from "./base-agent.js";

const AGENT_MANIFEST = {
  id: "agent-scenographer" as AgentId,
  name: "Agent Scénographe",
  description: "Génère des suggestions de scènes d'éclairage basées sur le contexte",
  version: "1.0.0",
  capabilities: [
    "scene-generation",
    "mood-analysis",
    "context-aware",
    "transition-creation",
  ],
  inputTypes: ["scene-request", "context"],
  outputTypes: ["scene-suggestion", "lighting-commands"],
};

// Predefined moods and their color associations
const MOOD_PROFILES: Record<string, { colors: string[]; intensity: number; speed: number }> = {
  energetic: {
    colors: ["#ff0000", "#ff6600", "#ffff00", "#ff00ff"],
    intensity: 90,
    speed: 1.5,
  },
  calm: {
    colors: ["#0066ff", "#00ccff", "#66ffcc", "#ffffff"],
    intensity: 40,
    speed: 0.3,
  },
  dramatic: {
    colors: ["#ff0000", "#000000", "#ffffff", "#660000"],
    intensity: 80,
    speed: 0.8,
  },
  romantic: {
    colors: ["#ff66b2", "#ff99cc", "#ffb3d9", "#ffffff"],
    intensity: 50,
    speed: 0.4,
  },
  party: {
    colors: ["#ff00ff", "#00ffff", "#ffff00", "#ff0000"],
    intensity: 85,
    speed: 2.0,
  },
  concert: {
    colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
    intensity: 95,
    speed: 1.8,
  },
  theater: {
    colors: ["#ffcc00", "#ff9900", "#ffffff", "#000000"],
    intensity: 70,
    speed: 0.5,
  },
  lounge: {
    colors: ["#6633cc", "#9966ff", "#cc99ff", "#330066"],
    intensity: 35,
    speed: 0.2,
  },
};

// Time-based presets
const TIME_PRESETS: Record<string, { mood: string; intensity: number }> = {
  morning: { mood: "calm", intensity: 30 },
  afternoon: { mood: "energetic", intensity: 60 },
  evening: { mood: "romantic", intensity: 50 },
  night: { mood: "party", intensity: 80 },
  late_night: { mood: "lounge", intensity: 25 },
};

interface SceneRequest {
  type: "preset" | "custom" | "contextual";
  mood?: string;
  eventName?: string;
  duration?: number;
  customColors?: string[];
  timeOfDay?: string;
}

export class ScenographerAgent extends BaseAgent {
  private savedScenes: Map<string, SceneSuggestion> = new Map();
  private currentScene: SceneSuggestion | null = null;

  constructor() {
    super("agent-scenographer", AGENT_MANIFEST);
    this.registerHandler("generate_scene", this.handleGenerateScene.bind(this));
    this.registerHandler("save_scene", this.handleSaveScene.bind(this));
    this.registerHandler("load_scene", this.handleLoadScene.bind(this));
    this.registerHandler("list_scenes", this.handleListScenes.bind(this));
  }

  protected async execute(input: any): Promise<SceneSuggestion> {
    const { request } = input;
    return this.generateScene(request);
  }

  private async handleGenerateScene(message: any): Promise<any> {
    return this.generateScene(message.payload);
  }

  private async handleSaveScene(message: any): Promise<any> {
    const { name, scene } = message.payload;
    this.savedScenes.set(name, scene);
    return { success: true, name };
  }

  private async handleLoadScene(message: any): Promise<any> {
    const { name } = message.payload;
    const scene = this.savedScenes.get(name);
    if (!scene) {
      throw new Error(`Scene not found: ${name}`);
    }
    this.currentScene = scene;
    return scene;
  }

  private async handleListScenes(): Promise<any> {
    return Array.from(this.savedScenes.entries()).map(([name, scene]) => ({
      name,
      ...scene,
    }));
  }

  private generateScene(request: SceneRequest): SceneSuggestion {
    let scene: SceneSuggestion;

    switch (request.type) {
      case "preset":
        scene = this.generatePresetScene(request.mood || "calm");
        break;
      case "custom":
        scene = this.generateCustomScene(request.customColors || []);
        break;
      case "contextual":
        scene = this.generateContextualScene(request);
        break;
      default:
        scene = this.generatePresetScene("calm");
    }

    this.currentScene = scene;
    return scene;
  }

  private generatePresetScene(mood: string): SceneSuggestion {
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.calm;
    const groups = ["A", "B", "C", "D", "E", "F"];

    const groupSettings: Record<string, { intensity: number; color: string }> = {};
    groups.forEach((group, index) => {
      const colorIndex = index % profile.colors.length;
      groupSettings[group] = {
        intensity: profile.intensity,
        color: profile.colors[colorIndex],
      };
    });

    return {
      name: `Scene ${mood}`,
      description: `Scène ${mood} générée automatiquement`,
      mood,
      groups: groupSettings,
      duration: 300, // 5 minutes
      transition: 2,
    };
  }

  private generateCustomScene(colors: string[]): SceneSuggestion {
    const groups = ["A", "B", "C", "D", "E", "F"];
    const groupSettings: Record<string, { intensity: number; color: string }> = {};

    groups.forEach((group, index) => {
      const colorIndex = index % colors.length;
      groupSettings[group] = {
        intensity: 70,
        color: colors[colorIndex] || "#ffffff",
      };
    });

    return {
      name: "Custom Scene",
      description: "Scène personnalisée",
      mood: "custom",
      groups: groupSettings,
      duration: 300,
      transition: 2,
    };
  }

  private generateContextualScene(request: SceneRequest): SceneSuggestion {
    // Determine mood based on time of day
    const hour = new Date().getHours();
    let timeOfDay = request.timeOfDay;

    if (!timeOfDay) {
      if (hour >= 6 && hour < 12) timeOfDay = "morning";
      else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
      else if (hour >= 17 && hour < 21) timeOfDay = "evening";
      else if (hour >= 21 && hour < 24) timeOfDay = "night";
      else timeOfDay = "late_night";
    }

    const preset = TIME_PRESETS[timeOfDay] || TIME_PRESETS.evening;
    const scene = this.generatePresetScene(preset.mood);

    // Adjust intensity based on time
    Object.values(scene.groups).forEach((group) => {
      group.intensity = Math.round((group.intensity * preset.intensity) / 100);
    });

    scene.name = `Scene ${timeOfDay}`;
    scene.description = `Scène adaptée au moment de la journée: ${timeOfDay}`;

    return scene;
  }

  // Generate lighting suggestion from scene
  sceneToLightingSuggestion(scene: SceneSuggestion): LightingSuggestion {
    const groups: Record<string, { intensity: number; color: string; effect?: string }> = {};

    Object.entries(scene.groups).forEach(([group, settings]) => {
      groups[group] = {
        intensity: settings.intensity,
        color: settings.color,
      };
    });

    return {
      agentId: this.id,
      confidence: 0.9,
      groups,
      reasoning: `Scene: ${scene.name} (${scene.mood})`,
      timestamp: new Date(),
    };
  }
}

// ============================================================
// Glow Logic Backend API Client
// ============================================================

import { GlowLogicAPI } from "./types.js";

export class GlowLogicClient implements GlowLogicAPI {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3005") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // DMX Control
  async setChannel(universe: number, channel: number, value: number): Promise<void> {
    await this.request("/api/dmx/channel", {
      method: "POST",
      body: JSON.stringify({ universe, channel, value }),
    });
  }

  async setGroup(group: string, intensity: number): Promise<void> {
    await this.request("/api/dmx/group", {
      method: "POST",
      body: JSON.stringify({ group, intensity }),
    });
  }

  async setColor(group: string, r: number, g: number, b: number, intensity: number): Promise<void> {
    await this.request("/api/dmx/color", {
      method: "POST",
      body: JSON.stringify({ group, r, g, b, intensity }),
    });
  }

  async blackout(active: boolean): Promise<void> {
    await this.request("/api/dmx/blackout", {
      method: "POST",
      body: JSON.stringify({ active }),
    });
  }

  async setBpm(bpm: number): Promise<void> {
    await this.request("/api/dmx/bpm", {
      method: "POST",
      body: JSON.stringify({ bpm }),
    });
  }

  // Patch
  async getPatch(): Promise<any[]> {
    return this.request("/api/patch");
  }

  async addPatchFixture(fixture: any): Promise<number> {
    const result = await this.request<{ id: number }>("/api/patch", {
      method: "POST",
      body: JSON.stringify(fixture),
    });
    return result.id;
  }

  // Scenes
  async getScenes(): Promise<any[]> {
    return this.request("/api/scenes");
  }

  async saveScene(scene: any): Promise<void> {
    await this.request("/api/scenes", {
      method: "POST",
      body: JSON.stringify(scene),
    });
  }

  async loadScene(name: string): Promise<void> {
    await this.request("/api/scenes/load", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    return this.request("/api/settings");
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.request("/api/settings", {
      method: "POST",
      body: JSON.stringify({ [key]: value }),
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/api/settings");
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let clientInstance: GlowLogicClient | null = null;

export function getGlowLogicClient(baseUrl?: string): GlowLogicClient {
  if (!clientInstance) {
    clientInstance = new GlowLogicClient(baseUrl);
  }
  return clientInstance;
}

import type { Page } from "@playwright/test";

type JsonObject = Record<string, unknown>;

export type MockProject = {
  id: number;
  name: string;
  data: JsonObject;
  updated_at: string;
};

export type StubBackendOptions = {
  fixtures?: JsonObject[];
  fixtureGroups?: JsonObject[];
  library?: JsonObject[];
  scenes?: JsonObject[];
  projects?: MockProject[];
};

export type StubBackendState = {
  projects: MockProject[];
  fixtures: JsonObject[];
  fixtureGroups: JsonObject[];
  library: JsonObject[];
  scenes: JsonObject[];
};

const TEST_TOKEN = "test-token-local-playwright";

function jsonPayload(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function nowIso() {
  return new Date().toISOString();
}

export async function stubBackend(page: Page, options: StubBackendOptions = {}): Promise<StubBackendState> {
  const state: StubBackendState = {
    projects: options.projects ?? [],
    fixtures: options.fixtures ?? [],
    fixtureGroups: options.fixtureGroups ?? [],
    library: options.library ?? [],
    scenes: options.scenes ?? [],
  };

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.route("http://localhost:3005/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === "/api/auth/bootstrap" && method === "POST") {
      await route.fulfill({ json: { token: TEST_TOKEN } });
      return;
    }

    if (path === "/api/auth/token") {
      await route.fulfill({ json: { token: TEST_TOKEN } });
      return;
    }

    if (path === "/api/safety/status") {
      await route.fulfill({
        json: {
          laserArmed: false,
          pyroArmed: false,
          operatorRole: "beginner",
          dangerousPhysicalOutputsEnabled: false,
        },
      });
      return;
    }

    if (path === "/api/safety") {
      await route.fulfill({
        json: {
          operatorRole: "beginner",
          dangerousPhysicalOutputsEnabled: false,
          armed: { laser: false, pyro: false, drone: false, external_api: false },
          rules: [],
        },
      });
      return;
    }

    if (path === "/api/dmx/router") {
      await route.fulfill({ json: { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false, python: false } });
      return;
    }

    if (path === "/api/dmx/output-status") {
      const outputState = (state: string, enabled: boolean) => ({
        enabled,
        state,
        lastOkAt: enabled ? Date.now() : null,
        lastErrorAt: null,
        lastErrorMessage: null,
        errorCount: 0,
      });
      await route.fulfill({
        json: {
          at: Date.now(),
          outputs: {
            python: outputState("off", false),
            qlcOsc: outputState("ok", true),
            qlcWs: outputState("off", false),
            artNet: outputState("ok", true),
            usbDmx: outputState("off", false),
          },
        },
      });
      return;
    }

    if (path === "/api/sync/status") {
      await route.fulfill({
        json: {
          enabled: false,
          trustExternalBpm: true,
          source: "manual",
          bpm: 128,
          phase: 0,
          beat: 0,
          lastSeenAt: null,
          confidence: 0,
          online: false,
        },
      });
      return;
    }

    if (path === "/api/fixtures") {
      if (method === "POST") {
        const body = jsonPayload(route.request().postDataJSON());
        const next = {
          id: state.fixtures.length + 1,
          name: String(body.name || `Fixture ${state.fixtures.length + 1}`),
          manufacturer: String(body.manufacturer || "Glow Logic Test"),
          total_channels: Array.isArray(body.channels) ? body.channels.length : 4,
          start_address: Number(body.startAddress || 1),
          channels: Array.isArray(body.channels) ? body.channels : [],
        };
        state.fixtures.push(next);
        await route.fulfill({ json: next });
        return;
      }
      await route.fulfill({ json: state.fixtures });
      return;
    }

    if (path === "/api/fixture-groups") {
      if (method === "POST") {
        const body = jsonPayload(route.request().postDataJSON());
        const next = { id: state.fixtureGroups.length + 1, ...body };
        state.fixtureGroups.push(next);
        await route.fulfill({ json: next });
        return;
      }
      await route.fulfill({ json: state.fixtureGroups });
      return;
    }

    if (path === "/api/library/import" && method === "POST") {
      const body = jsonPayload(route.request().postDataJSON());
      const items = Array.isArray(body.items) ? body.items.filter((item): item is JsonObject => Boolean(item && typeof item === "object")) : [];
      state.library.push(...items);
      await route.fulfill({ json: { imported: items.length } });
      return;
    }

    if (path === "/api/library") {
      if (method === "POST") {
        const body = jsonPayload(route.request().postDataJSON());
        const next = { id: `user-${state.library.length + 1}`, ...body };
        state.library.push(next);
        await route.fulfill({ json: next });
        return;
      }
      await route.fulfill({ json: state.library });
      return;
    }

    if (path === "/api/venue-profiles") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path === "/api/scenes") {
      if (method === "POST") {
        const body = jsonPayload(route.request().postDataJSON());
        const next = {
          id: state.scenes.length + 1,
          name: String(body.name || `Scene ${state.scenes.length + 1}`),
          color: String(body.color || "#06b6d4"),
          values: Array.isArray(body.values) ? body.values : [],
          created_at: nowIso(),
        };
        state.scenes.push(next);
        await route.fulfill({ json: next });
        return;
      }
      await route.fulfill({ json: state.scenes });
      return;
    }

    if (/^\/api\/scenes\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      state.scenes = state.scenes.filter((scene) => Number(scene.id) !== id);
      await route.fulfill({ json: { success: true } });
      return;
    }

    if (path === "/api/projects") {
      if (method === "POST") {
        const body = jsonPayload(route.request().postDataJSON());
        const name = String(body.name || `Projet ${state.projects.length + 1}`);
        const existing = state.projects.find((project) => project.name === name);
        const project: MockProject = {
          id: existing?.id ?? state.projects.length + 1,
          name,
          data: jsonPayload(body.data),
          updated_at: nowIso(),
        };
        state.projects = existing
          ? state.projects.map((candidate) => candidate.id === existing.id ? project : candidate)
          : [...state.projects, project];
        await route.fulfill({ json: project });
        return;
      }
      await route.fulfill({ json: state.projects.map(({ id, name, updated_at }) => ({ id, name, updated_at })) });
      return;
    }

    if (/^\/api\/projects\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      if (method === "DELETE") {
        state.projects = state.projects.filter((project) => project.id !== id);
        await route.fulfill({ json: { success: true } });
        return;
      }
      const project = state.projects.find((candidate) => candidate.id === id);
      await route.fulfill({ status: project ? 200 : 404, json: project ?? { error: "not_found" } });
      return;
    }

    if (path === "/api/projects/health") {
      await route.fulfill({
        json: {
          ok: true,
          schemaVersion: 3,
          databaseExists: true,
          projectCount: state.projects.length,
          invalidJsonCount: 0,
          duplicateNameCount: 0,
          latestUpdatedAt: state.projects[0]?.updated_at ?? null,
          issues: [],
        },
      });
      return;
    }

    if (path === "/api/license") {
      await route.fulfill({ json: { valid: true, offlineReady: true } });
      return;
    }

    if (path === "/api/dmx/ports") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path === "/api/dmx/usb-status") {
      await route.fulfill({ json: { connected: false, error: null } });
      return;
    }

    if (path === "/api/video/resolume") {
      await route.fulfill({
        json: {
          enabled: false,
          host: "127.0.0.1",
          port: 7000,
          localPort: 7001,
          ready: false,
          lastActionAt: null,
          protocol: "osc",
          notes: "",
        },
      });
      return;
    }

    await route.fulfill({ json: method === "POST" ? { success: true } : {} });
  });

  return state;
}

import { dmxRouter } from "./dmxRouter";
import { fixtureResolver, type DmxUpdate } from "./fixtureResolver";
import { triggerResolumeAction, type ResolumeAction } from "./resolume";
import { validateSafetyAction, type HazardType, type OutputMode } from "./safetyGate";
import { addSupportLog } from "./supportLog";

export type ShowActionSource = "manual" | "midi" | "ai" | "api" | "timeline";

export interface ShowActionInput {
  type: string;
  source?: ShowActionSource;
  outputMode?: OutputMode;
  hazard?: HazardType;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface ShowActionResult {
  type: string;
  success: boolean;
  blocked: boolean;
  reason?: string;
  dmxUpdates: DmxUpdate[];
  data?: unknown;
}

export interface ShowActionBatchResult {
  ok: boolean;
  executedAt: string;
  results: ShowActionResult[];
}

const HAZARDS: HazardType[] = ["laser", "pyro", "drone", "external_api"];
const RESOLUME_ACTIONS: ResolumeAction[] = ["play", "pause", "clip", "column", "layer_opacity", "bpm"];

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function detectHazard(action: ShowActionInput): HazardType | undefined {
  if (action.hazard && HAZARDS.includes(action.hazard)) return action.hazard;
  const type = action.type.toLowerCase();
  if (type.includes("laser")) return "laser";
  if (type.includes("pyro")) return "pyro";
  if (type.includes("drone") || type.includes("mavlink")) return "drone";
  if (type.includes("external")) return "external_api";
  return undefined;
}

function sendUpdates(updates: DmxUpdate[]) {
  for (const update of updates) {
    dmxRouter.setChannel(update.universe, update.channel, update.value);
  }
}

function dmxSet(payload: Record<string, unknown>): DmxUpdate[] {
  const update: DmxUpdate = {
    universe: clampInt(payload.universe, 1, 8, 1),
    channel: clampInt(payload.channel, 1, 512, 1),
    value: clampInt(payload.value, 0, 255, 0),
  };
  sendUpdates([update]);
  return [update];
}

function dmxBatch(payload: Record<string, unknown>): DmxUpdate[] {
  const rawUpdates = Array.isArray(payload.updates) ? payload.updates : [];
  const updates = rawUpdates.map((item) => {
    const record = typeof item === "object" && item ? item as Record<string, unknown> : {};
    return {
      universe: clampInt(record.universe, 1, 8, 1),
      channel: clampInt(record.channel, 1, 512, 1),
      value: clampInt(record.value, 0, 255, 0),
    };
  });
  sendUpdates(updates);
  return updates;
}

function dmxBlackout(payload: Record<string, unknown>): DmxUpdate[] {
  const universe = clampInt(payload.universe, 1, 8, 1);
  const startChannel = clampInt(payload.startChannel ?? payload.start, 1, 512, 1);
  const channelCount = clampInt(payload.channelCount ?? payload.channels, 1, 512, 512);
  const endChannel = Math.min(512, startChannel + channelCount - 1);
  const updates: DmxUpdate[] = [];

  for (let channel = startChannel; channel <= endChannel; channel += 1) {
    updates.push({ universe, channel, value: 0 });
  }
  sendUpdates(updates);
  return updates;
}

function fixtureAction(type: string, payload: Record<string, unknown>): DmxUpdate[] {
  const target = typeof payload.groupName === "string" && payload.groupName.trim()
    ? { groupName: payload.groupName.trim() }
    : {};

  if (type === "fixture.intensity") {
    return fixtureResolver.setAllIntensity(clampInt(payload.value, 0, 255, 0), target);
  }
  if (type === "fixture.center") {
    return fixtureResolver.centerMovingHeads(target);
  }
  if (type === "fixture.color") {
    return fixtureResolver.setAllColorByName(String(payload.color || payload.name || "blanc"), target);
  }
  if (type === "fixture.strobe") {
    return fixtureResolver.setAllStrobe(clampInt(payload.value, 0, 255, 0), target);
  }
  if (type === "fixture.gobo") {
    return fixtureResolver.setAllGobo(clampInt(payload.index ?? payload.value, 0, 32, 0), target);
  }
  if (type === "fixture.prism") {
    return fixtureResolver.setAllPrism(clampInt(payload.value, 0, 255, 0), target);
  }
  return [];
}

export async function executeShowActions(actions: ShowActionInput[]): Promise<ShowActionBatchResult> {
  const results: ShowActionResult[] = [];

  for (const action of actions) {
    const type = String(action.type || "").trim();
    const payload = action.payload || {};
    const source = action.source || "api";
    const hazard = detectHazard(action);
    const safety = validateSafetyAction({
      hazard,
      outputMode: action.outputMode || "simulation",
      source,
      description: action.description || type,
      payload,
    });

    if (!safety.allowed && type !== "safety.validate") {
      results.push({
        type,
        success: false,
        blocked: true,
        reason: safety.reason,
        dmxUpdates: [],
      });
      break;
    }

    try {
      let dmxUpdates: DmxUpdate[] = [];
      let data: unknown;

      if (type === "dmx.set") {
        dmxUpdates = dmxSet(payload);
      } else if (type === "dmx.batch") {
        dmxUpdates = dmxBatch(payload);
      } else if (type === "dmx.blackout") {
        dmxUpdates = dmxBlackout(payload);
      } else if (type.startsWith("fixture.")) {
        dmxUpdates = fixtureAction(type, payload);
        sendUpdates(dmxUpdates);
      } else if (type === "resolume.action") {
        const resolumeAction = payload.action;
        if (!RESOLUME_ACTIONS.includes(resolumeAction as ResolumeAction)) {
          throw new Error("Action Resolume invalide");
        }
        data = triggerResolumeAction(resolumeAction as ResolumeAction, payload);
      } else if (type === "safety.validate") {
        data = safety;
      } else if (hazard) {
        data = {
          simulated: true,
          hazard,
          message: "Action dangereuse conservee en simulation dans le MVP.",
        };
      } else {
        throw new Error(`Action inconnue: ${type}`);
      }

      results.push({
        type,
        success: true,
        blocked: false,
        reason: dmxUpdates.length > 0 ? `${dmxUpdates.length} canal(aux) DMX envoyes` : "Action executee",
        dmxUpdates,
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addSupportLog("SHOW_ACTIONS", `Action failed: ${type}`, "error", { type, source, message });
      results.push({
        type,
        success: false,
        blocked: false,
        reason: message,
        dmxUpdates: [],
      });
    }
  }

  const ok = results.every((result) => result.success);
  addSupportLog("SHOW_ACTIONS", `Batch ${ok ? "ok" : "partial"} (${results.length} actions)`, ok ? "info" : "warning", {
    actions: results.map((result) => ({ type: result.type, success: result.success, blocked: result.blocked })),
  });

  return {
    ok,
    executedAt: new Date().toISOString(),
    results,
  };
}

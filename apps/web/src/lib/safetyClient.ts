import { API_BASE } from "./config";

export type HazardType = "laser" | "pyro" | "drone" | "external_api";
export type SafetySource = "manual" | "midi" | "ai" | "api" | "timeline";

export interface SafetyValidation {
  allowed: boolean;
  reason: string;
  requiresManualArm: boolean;
}

type ToastFn = (toast: {
  type: "success" | "error" | "warning" | "info";
  message: string;
  detail?: string;
  duration?: number;
}) => void;

const HAZARD_PATTERNS: Array<{ hazard: HazardType; pattern: RegExp }> = [
  { hazard: "laser", pattern: /\blaser\b|\bilda\b/i },
  { hazard: "pyro", pattern: /\bpyro\b|\bfeu(x)?\b|\bflamme(s)?\b|\bfirework(s)?\b/i },
  { hazard: "drone", pattern: /\bdrone(s)?\b|\bmavlink\b/i },
  { hazard: "external_api", pattern: /\bexternal_api\b|\bwebhook\b|\bhttp\b|\bosc externe\b|\bresolume\b/i },
];

function stringifyAction(action: unknown) {
  try {
    return JSON.stringify(action);
  } catch {
    return String(action);
  }
}

export function detectHazardFromText(text: string): HazardType | null {
  const match = HAZARD_PATTERNS.find((entry) => entry.pattern.test(text));
  return match?.hazard || null;
}

export function detectHazardFromAction(action: { type?: string; payload?: unknown }): HazardType | null {
  const text = `${action.type || ""} ${stringifyAction(action.payload)}`;
  return detectHazardFromText(text);
}

export async function validateSafetyAction(input: {
  hazard?: HazardType | null;
  outputMode?: "simulation" | "physical";
  source: SafetySource;
  description?: string;
}): Promise<SafetyValidation> {
  if (!input.hazard) {
    return { allowed: true, reason: "Action standard autorisee", requiresManualArm: false };
  }

  const response = await fetch(`${API_BASE}/api/safety/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    return {
      allowed: false,
      reason: data.details || data.error || "Safety Gate indisponible",
      requiresManualArm: true,
    };
  }
  return data;
}

export async function filterUnsafeAiActions<T extends { type?: string; payload?: unknown }>(
  actions: T[],
  source: SafetySource,
  addToast?: ToastFn,
) {
  const accepted: T[] = [];
  const blocked: Array<{ action: T; reason: string; hazard: HazardType }> = [];

  for (const action of actions) {
    const hazard = detectHazardFromAction(action);
    const validation = await validateSafetyAction({
      hazard,
      outputMode: "simulation",
      source,
      description: `${action.type || "ACTION"} ${stringifyAction(action.payload)}`,
    });

    if (validation.allowed) {
      accepted.push(action);
    } else if (hazard) {
      blocked.push({ action, reason: validation.reason, hazard });
      addToast?.({
        type: "warning",
        message: "Safety Gate",
        detail: `${hazard}: ${validation.reason}`,
        duration: 4500,
      });
    }
  }

  return { accepted, blocked };
}

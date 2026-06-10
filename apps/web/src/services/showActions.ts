import { API_BASE } from "../lib/config";

export type ShowActionSource = "manual" | "midi" | "ai" | "api" | "timeline";

export type ShowAction = {
  type: string;
  source?: ShowActionSource;
  outputMode?: "simulation" | "physical";
  hazard?: "laser" | "pyro" | "drone" | "external_api";
  description?: string;
  payload?: Record<string, unknown>;
};

export async function executeShowActions(actions: ShowAction[] | ShowAction) {
  const response = await fetch(`${API_BASE}/api/show-actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Array.isArray(actions) ? { actions } : actions),
  });
  const data = await response.json();
  if (!response.ok && response.status !== 207) {
    throw new Error(data?.details || data?.error || "Execution action impossible");
  }
  return data;
}

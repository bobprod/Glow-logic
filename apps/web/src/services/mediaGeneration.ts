import { API_BASE } from "../lib/config";

export type MediaProvider = {
  id: string;
  label: string;
  configured: boolean;
  mode: "offline" | "cloud_optional";
};

export type MediaJob = {
  id: string;
  provider: string;
  kind: "image" | "video" | "vj_loop";
  status: "draft" | "queued";
  mode: "offline_plan" | "cloud_ready";
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  storyboard: Array<{
    timeSec: number;
    visual: string;
    lightingHint: string;
  }>;
  nextStep: string;
};

export async function getMediaGenerationStatus() {
  const response = await fetch(`${API_BASE}/api/llm/media-providers`);
  if (!response.ok) throw new Error("Statut media indisponible");
  return response.json() as Promise<{ providers?: MediaProvider[]; jobs?: MediaJob[] }>;
}

export async function generateMediaJob(input: {
  provider: string;
  kind: MediaJob["kind"];
  prompt: string;
  durationSec: number;
  aspectRatio?: string;
  source?: "manual" | "ai" | "api" | "timeline";
}): Promise<{ job: MediaJob; providers?: MediaProvider[] }> {
  const response = await fetch(`${API_BASE}/api/llm/generate-media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json() as {
    job?: MediaJob;
    providers?: MediaProvider[];
    error?: string;
    details?: string;
  };
  if (!response.ok || !data.job) {
    throw new Error(data.details || data.error || "Generation media impossible");
  }
  return { job: data.job, providers: data.providers };
}

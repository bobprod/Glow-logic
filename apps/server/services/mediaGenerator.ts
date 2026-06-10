import { getSetting } from "./database";
import { addSupportLog } from "./supportLog";

export type MediaProvider = "offline" | "replicate" | "veo" | "higgsfield" | "hyperframes";
export type MediaKind = "image" | "video" | "vj_loop";

export interface MediaProviderStatus {
  id: MediaProvider;
  label: string;
  configured: boolean;
  mode: "offline" | "cloud_optional";
  keySetting: string | null;
}

export interface GenerateMediaInput {
  prompt?: string;
  provider?: MediaProvider;
  kind?: MediaKind;
  durationSec?: number;
  style?: string;
  aspectRatio?: string;
  seed?: number;
  source?: "manual" | "ai" | "api" | "timeline";
}

export interface MediaGenerationJob {
  id: string;
  createdAt: string;
  provider: MediaProvider;
  kind: MediaKind;
  status: "draft" | "queued";
  mode: "offline_plan" | "cloud_ready";
  prompt: string;
  style: string;
  durationSec: number;
  aspectRatio: string;
  seed: number;
  storyboard: Array<{
    timeSec: number;
    visual: string;
    lightingHint: string;
  }>;
  nextStep: string;
}

const PROVIDERS: MediaProviderStatus[] = [
  { id: "offline", label: "Offline storyboard", configured: true, mode: "offline", keySetting: null },
  { id: "replicate", label: "Replicate", configured: false, mode: "cloud_optional", keySetting: "replicate_key" },
  { id: "veo", label: "Google Veo", configured: false, mode: "cloud_optional", keySetting: "veo_key" },
  { id: "higgsfield", label: "Higgsfield", configured: false, mode: "cloud_optional", keySetting: "higgsfield_key" },
  { id: "hyperframes", label: "HyperFrames", configured: false, mode: "cloud_optional", keySetting: "hyperframes_key" },
];

const jobs: MediaGenerationJob[] = [];

function normalizeProvider(provider?: string): MediaProvider {
  if (provider === "replicate" || provider === "veo" || provider === "higgsfield" || provider === "hyperframes") {
    return provider;
  }
  return "offline";
}

function normalizeKind(kind?: string): MediaKind {
  if (kind === "image" || kind === "video" || kind === "vj_loop") return kind;
  return "vj_loop";
}

function getProviderKey(provider: MediaProvider): string | null {
  const primary = PROVIDERS.find((item) => item.id === provider)?.keySetting;
  if (!primary) return null;

  const aliases: Record<MediaProvider, string[]> = {
    offline: [],
    replicate: ["replicate_key", "replicate_token"],
    veo: ["veo_key", "google_ai_key", "gemini_key"],
    higgsfield: ["higgsfield_key"],
    hyperframes: ["hyperframes_key"],
  };

  for (const key of aliases[provider]) {
    const value = getSetting(key);
    if (value && value.trim().length > 0) return value;
  }
  return null;
}

export function getMediaProviderStatus(): MediaProviderStatus[] {
  return PROVIDERS.map((provider) => ({
    ...provider,
    configured: provider.id === "offline" || Boolean(getProviderKey(provider.id)),
  }));
}

function clampDuration(value: unknown, kind: MediaKind) {
  const fallback = kind === "image" ? 1 : 8;
  const duration = Number(value);
  if (!Number.isFinite(duration)) return fallback;
  return Math.max(1, Math.min(60, Math.round(duration)));
}

function normalizeAspectRatio(input?: string) {
  const allowed = new Set(["1:1", "4:5", "9:16", "16:9", "21:9"]);
  return input && allowed.has(input) ? input : "16:9";
}

function buildStoryboard(prompt: string, durationSec: number, style: string) {
  const beats = Math.max(3, Math.min(6, Math.ceil(durationSec / 3)));
  const moods = [
    "intro sombre, formes lentes",
    "montee rythmique, contrastes nets",
    "impact lumineux, mouvement camera",
    "variation de couleur, textures plus denses",
    "pic visuel, accents sur les basses",
    "sortie propre, boucle raccordable",
  ];

  return Array.from({ length: beats }, (_, index) => {
    const timeSec = Math.round((durationSec / beats) * index);
    return {
      timeSec,
      visual: `${moods[index] || moods[moods.length - 1]} autour de: ${prompt}`,
      lightingHint: `${style || "club"} / dimmer ${index === 0 ? "30%" : "70%"} / mouvement ${index % 2 === 0 ? "pan" : "tilt"}`,
    };
  });
}

export function createMediaGenerationJob(input: GenerateMediaInput): MediaGenerationJob {
  const prompt = String(input.prompt || "").trim();
  if (!prompt) {
    throw new Error("Prompt media obligatoire");
  }

  const provider = normalizeProvider(input.provider);
  const kind = normalizeKind(input.kind);
  const hasProviderKey = provider !== "offline" && Boolean(getProviderKey(provider));
  const createdAt = new Date().toISOString();
  const durationSec = clampDuration(input.durationSec, kind);
  const style = String(input.style || "club cinematic").trim() || "club cinematic";
  const aspectRatio = normalizeAspectRatio(input.aspectRatio);
  const seed = Number.isFinite(Number(input.seed)) ? Math.round(Number(input.seed)) : Math.floor(Math.random() * 1_000_000);

  const job: MediaGenerationJob = {
    id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    provider,
    kind,
    status: hasProviderKey ? "queued" : "draft",
    mode: hasProviderKey ? "cloud_ready" : "offline_plan",
    prompt,
    style,
    durationSec,
    aspectRatio,
    seed,
    storyboard: buildStoryboard(prompt, durationSec, style),
    nextStep: hasProviderKey
      ? "Cle cloud detectee: pret pour connecter le provider reel sans bloquer le show offline."
      : "Aucune cle cloud requise: storyboard local utilisable pour preparer VJ, timeline et looks DMX.",
  };

  jobs.unshift(job);
  if (jobs.length > 50) jobs.pop();

  addSupportLog("MEDIA_AI", `Media job ${job.status}`, job.mode === "cloud_ready" ? "info" : "warning", {
    id: job.id,
    provider: job.provider,
    kind: job.kind,
    source: input.source || "manual",
    mode: job.mode,
  });

  return job;
}

export function getMediaGenerationJobs(limit = 20): MediaGenerationJob[] {
  return jobs.slice(0, Math.max(1, Math.min(50, limit)));
}

import type { DmxChannel, DmxChannelType } from "./ocr";

export interface AiFixtureMode {
  name: string;
  channels: DmxChannel[];
}

export interface AiFixtureResult {
  manufacturer: string;
  model: string;
  modes: AiFixtureMode[];
  provider: string;
  usedVision: boolean;
}

export type AiFailureReason =
  | "no_key"
  | "rate_limit"
  | "timeout"
  | "network"
  | "parse_error"
  | "model_error";

export interface AiEnhanceResult {
  result: AiFixtureResult | null;
  reason?: AiFailureReason;
}

const VALID_TYPES = new Set<DmxChannelType>([
  "dimmer","red","green","blue","white","amber","uv",
  "pan","tilt","pan_fine","tilt_fine","gobo","color_wheel",
  "strobe","shutter","zoom","focus","iris","prism",
  "speed","macro","sound","reset","other",
]);

const SYSTEM_PROMPT = `Tu es un parseur de fixtures DMX. Tu reponds EXCLUSIVEMENT en JSON brut.
REGLES ABSOLUES:
- NE JAMAIS ecrire de raisonnement, d'explication, de phrase ou de markdown.
- Ta reponse DOIT commencer par { et finir par } — RIEN d'autre avant ou apres.
- Sois concis: pas de notes sauf si vraiment necessaire.

Analyse l'image et/ou le texte OCR. Extrait le patch DMX complet (tous les modes: "5CH", "7CH", "Basic", "Extended"...).
Format EXACT:
{"manufacturer":"","model":"","modes":[{"name":"","channels":[{"channel":1,"function":"Pan","type":"pan","minValue":0,"maxValue":255}]}]}
Types valides (un seul): dimmer, red, green, blue, white, amber, uv, pan, tilt, pan_fine, tilt_fine, gobo, color_wheel, strobe, shutter, zoom, focus, iris, prism, speed, macro, sound, reset, other`;

const VISION_TIMEOUT_MS = 120_000; // 120s pour vision (image large + génération JSON)
const TEXT_TIMEOUT_MS   = 90_000;  // 90s pour texte seul (qwen ~50s pour gros JSON)

// Modèles qui supportent la vision (image en entrée)
// Tous les autres → texte seul directement (pas de timeout inutile)
const VISION_CAPABLE = new Set([
  // OpenAI
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-vision-preview",
  // Anthropic Claude 3+
  "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307",
  "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022",
  "claude-opus-4-20250514", "claude-sonnet-4-20250514",
  // Google Gemini
  "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro-vision",
  // Kimi (Moonshot) — vision natif
  "kimi-k1.5", "kimi-k2.5", "kimi-k2.6",
  // GLM (Zhipu) — certaines versions
  "glm-5", "glm-5.1",
]);

function isVisionCapable(model: string): boolean {
  // Vérification exacte puis par préfixe
  if (VISION_CAPABLE.has(model)) return true;
  const lower = model.toLowerCase();
  return lower.startsWith("gpt-4") || lower.includes("vision") || lower.startsWith("claude-3") ||
         lower.startsWith("gemini") || lower.startsWith("kimi") || lower.startsWith("glm-5");
}

// ── Fetch avec timeout AbortController ───────────────────────
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = VISION_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Classifier l'erreur ───────────────────────────────────────
function classifyError(err: any, statusCode?: number): AiFailureReason {
  const msg = (err?.message || "").toLowerCase();
  if (err?.name === "AbortError")       return "timeout";
  if (statusCode === 429)               return "rate_limit";
  if (statusCode && statusCode >= 400)  return "model_error";
  // TypeError: fetch failed = network (connexion refused, DNS, SSL...)
  if (err instanceof TypeError || msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("enotfound")) return "network";
  return "model_error"; // Erreur inconnue mais pas réseau
}

// ── Helpers sanitize ──────────────────────────────────────────
function sanitizeType(raw: string): DmxChannelType {
  const n = (raw || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (VALID_TYPES.has(n as DmxChannelType)) return n as DmxChannelType;
  if (n.includes("dim"))   return "dimmer";
  if (n.includes("pan"))   return n.includes("fine") ? "pan_fine" : "pan";
  if (n.includes("tilt"))  return n.includes("fine") ? "tilt_fine" : "tilt";
  if (n.includes("strob")) return "strobe";
  if (n.includes("color") || n.includes("colour")) return "color_wheel";
  return "other";
}

function toNum(v: any): number | undefined {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v.replace(/[^\d-]/g, ""), 10);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function mapChannel(c: any) {
  const ch = toNum(c.channel ?? c.ch ?? c.number);
  if (ch === undefined || ch < 1 || ch > 512) return null;
  return {
    channel: ch,
    function: String(c.function ?? c.fonction ?? c.name ?? "Unknown"),
    type: sanitizeType(c.type ?? c.category ?? ""),
    minValue: toNum(c.minValue ?? c.min),
    maxValue: toNum(c.maxValue ?? c.max),
    notes: c.notes ? String(c.notes) : undefined,
  };
}

function parseAiJson(text: string): { manufacturer: string; model: string; modes: AiFixtureMode[] } | null {
  if (!text) return null;

  // 1. Nettoyer markdown fences et texte autour
  let clean = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 2. Extraire du premier { au dernier } (greedy)
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1) return null;
  let jsonStr = end > start ? clean.slice(start, end + 1) : clean.slice(start);

  // 3. Tenter le parse ; si échec, réparer un JSON tronqué (fermer crochets/accolades)
  let parsed: any = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (attempt === 0) {
        // Réparation : retirer la dernière entrée incomplète et fermer les structures
        jsonStr = jsonStr.replace(/,\s*$/, "");
        const openBraces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
        // Couper après le dernier objet complet
        const lastComplete = Math.max(jsonStr.lastIndexOf("}"), jsonStr.lastIndexOf("]"));
        if (lastComplete > 0) jsonStr = jsonStr.slice(0, lastComplete + 1);
        jsonStr += "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
      }
    }
  }
  if (!parsed) return null;

  // 4. Extraire les modes (plusieurs formats possibles)
  let rawModes: any[] = [];
  if (Array.isArray(parsed.modes)) {
    rawModes = parsed.modes;
  } else if (Array.isArray(parsed.channels)) {
    // Pas de modes → un seul mode avec channels au top level
    rawModes = [{ name: parsed.mode || "Default", channels: parsed.channels }];
  } else if (parsed.modes && typeof parsed.modes === "object") {
    // modes en objet { "5CH": [...], "7CH": [...] }
    rawModes = Object.entries(parsed.modes).map(([name, channels]) => ({ name, channels }));
  }

  const modes: AiFixtureMode[] = rawModes
    .map((mo: any) => ({
      name: String(mo.name || mo.mode || "Mode"),
      channels: (Array.isArray(mo.channels) ? mo.channels : [])
        .map(mapChannel)
        .filter((c: any): c is NonNullable<typeof c> => c !== null),
    }))
    .filter((mo: AiFixtureMode) => mo.channels.length > 0);

  if (!modes.length) return null;
  return {
    manufacturer: String(parsed.manufacturer || parsed.brand || ""),
    model: String(parsed.model || parsed.name || ""),
    modes,
  };
}

// Une image à analyser
export interface ImageInput {
  base64: string;
  mimeType: string;
}

const MULTI_HINT = `Plusieurs pages/photos du meme manuel peuvent etre fournies. Combine TOUTES les infos pour reconstituer le patch complet et tous les modes.`;

// ── Appels LLM ───────────────────────────────────────────────
async function callOpenAIVision(ocrText: string, images: ImageInput[], apiKey: string, url: string, model: string): Promise<string> {
  const imageBlocks = images.map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" },
  }));
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 8192, temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [
          ...imageBlocks,
          { type: "text", text: `${images.length > 1 ? MULTI_HINT + "\n\n" : ""}Texte OCR combine:\n---\n${ocrText}\n---\nRetourne le JSON.` },
        ]},
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status, body });
  }
  const d: any = await res.json();
  return d?.choices?.[0]?.message?.content || "";
}

async function callOpenAIText(ocrText: string, apiKey: string, url: string, model: string): Promise<string> {
  const userMsg = `Voici le texte brut extrait par OCR d'une page de manuel de fixture d'eclairage DMX.
L'OCR peut contenir des erreurs (chiffres mal lus, mots coupes). Reconstitue intelligemment le patch DMX complet.
Le texte contient souvent un tableau avec: numero de canal, fonction, et parfois des plages de valeurs.

Texte OCR:
---
${ocrText}
---

Retourne UNIQUEMENT le JSON, sans aucun texte avant ou apres.`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 8192, temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    }),
  }, TEXT_TIMEOUT_MS);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status, body });
  }
  const d: any = await res.json();
  return d?.choices?.[0]?.message?.content || "";
}

async function callAnthropicVision(ocrText: string, images: ImageInput[], apiKey: string, url: string, model: string): Promise<string> {
  const imageBlocks = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.base64 },
  }));
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 8192, temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [
        ...imageBlocks,
        { type: "text", text: `${images.length > 1 ? MULTI_HINT + "\n\n" : ""}Texte OCR combine:\n---\n${ocrText}\n---\nRetourne le JSON.` },
      ]}],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status, body });
  }
  const d: any = await res.json();
  return d?.content?.find((c: any) => c.type === "text")?.text || "";
}

async function callAnthropicText(ocrText: string, apiKey: string, url: string, model: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 8192, temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Voici le texte OCR brut d'un manuel de fixture DMX.\nReconstitue le patch DMX complet malgre les erreurs OCR.\n---\n${ocrText}\n---\nRetourne UNIQUEMENT le JSON.` }],
    }),
  }, TEXT_TIMEOUT_MS);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status, body });
  }
  const d: any = await res.json();
  return d?.content?.find((c: any) => c.type === "text")?.text || "";
}

// ── Point d'entrée ────────────────────────────────────────────
export async function enhanceFixtureWithLLM(
  ocrText: string,
  images: ImageInput[],
  provider: string,
  apiKey: string,
  baseURL: string,
  apiFormat: string,
  configuredModel: string,
): Promise<AiEnhanceResult> {

  const isAnthropic = apiFormat === "anthropic";
  const url   = baseURL || (isAnthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions");
  const model = configuredModel || (isAnthropic ? "claude-3-5-sonnet-20241022" : "gpt-4o");

  const canVision = isVisionCapable(model) && images.length > 0;
  console.log(`[Fixture-AI] Provider=${provider} Model=${model} Vision=${canVision} Images=${images.length} URL=${url} KeyLen=${apiKey.length}`);

  let rawContent = "";
  let usedVision = false;
  let lastError: any = null;

  // ── Tentative 1 : Vision (images + OCR) — seulement si le modèle le supporte ──
  if (!canVision) {
    console.log(`[Fixture-AI] ${model} sans vision (ou 0 image) → texte seul directement`);
  }
  try { if (!canVision) throw Object.assign(new Error("vision_not_supported"), { skipVision: true });
    rawContent = isAnthropic
      ? await callAnthropicVision(ocrText, images, apiKey, url, model)
      : await callOpenAIVision(ocrText, images, apiKey, url, model);
    usedVision = true;
    console.log("[Fixture-AI] Vision OK");
  } catch (err: any) {
    lastError = err;
    // Timeout ou network → pas la peine de retenter
    // Log complet de l'erreur pour debug
    if (!err?.skipVision) {
      console.error(`[Fixture-AI] Vision erreur: name=${err?.name} status=${err?.statusCode} msg=${err?.message?.slice(0,200)}`);
    }
    // Seul le rate limit et le réseau font arrêter immédiatement
    if (err instanceof TypeError)    { return { result: null, reason: "network" }; }
    if (err?.statusCode === 429)     { return { result: null, reason: "rate_limit" }; }
    // Tout le reste (timeout, modèle sans vision, erreur 4xx) → fallback texte seul
    if (!err?.skipVision) console.warn(`[Fixture-AI] Fallback texte seul...`);
  }

  // ── Tentative 2 : Texte seul (si vision a echoue) ──
  if (!usedVision) {
    try {
      rawContent = isAnthropic
        ? await callAnthropicText(ocrText, apiKey, url, model)
        : await callOpenAIText(ocrText, apiKey, url, model);
      console.log("[Fixture-AI] Text-only OK");
    } catch (err: any) {
      lastError = err;
      const reason = classifyError(err, err?.statusCode);
      console.error(`[Fixture-AI] Text echoue: ${reason} — ${err?.message?.slice(0,100)}`);
      return { result: null, reason };
    }
  }

  if (!rawContent) {
    console.warn("[Fixture-AI] Reponse vide");
    return { result: null, reason: "model_error" };
  }

  console.log(`[Fixture-AI] Reponse ${rawContent.length} chars, usedVision=${usedVision}`);

  const parsed = parseAiJson(rawContent);
  if (!parsed) {
    console.warn("[Fixture-AI] JSON non parseable. DEBUT:", rawContent.slice(0, 250));
    console.warn("[Fixture-AI] FIN:", rawContent.slice(-250));
    return { result: null, reason: "parse_error" };
  }
  console.log(`[Fixture-AI] Parse OK: ${parsed.modes.length} mode(s), ${parsed.modes.reduce((s, m) => s + m.channels.length, 0)} channels total`);

  return { result: { ...parsed, provider, usedVision } };
}

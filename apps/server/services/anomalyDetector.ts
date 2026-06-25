import { SerialPort } from "serialport";
import { getSetting } from "./database";
import { pythonDmx } from "./pythonDmx";
import { usbDmx } from "./usbDmx";
import { qlcWs } from "./qlcWsService";
import { addSupportLog, getSupportLogPath, getSupportLogs } from "./supportLog";

export interface Anomaly {
  timestamp: string;
  source: string;
  message: string;
  severity: "info" | "warning" | "error";
}

const anomalies: Anomaly[] = [];
const MAX_ANOMALIES = 50;
const DIAGNOSE_CACHE_TTL_MS = 60_000;
const SERIAL_LIST_TIMEOUT_MS = 4_000;
const LLM_DIAGNOSIS_TIMEOUT_MS = 10_000;

type SerialPortInfo = Awaited<ReturnType<typeof SerialPort.list>>[number];

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface DiagnosticStatus {
  serialPorts: Array<{
    path: string;
    manufacturer: string;
    friendlyName: string;
  }>;
  pythonDmx: {
    active: boolean;
    port: string;
    pid: number | null;
  };
  usbDmx: {
    connected: boolean;
    portPath: string;
    error: string | null;
  };
  qlcWs: {
    connected: boolean;
    wsUrl: string;
  };
  recentAnomalies: Anomaly[];
  supportLogs: ReturnType<typeof getSupportLogs>;
  supportLogPath: string;
  generatedAt: string;
  cached: boolean;
}

export interface SystemDiagnosis {
  hasAnomalies: boolean;
  status: DiagnosticStatus;
  diagnosis: string;
}

let cachedDiagnosis: { timestamp: number; result: SystemDiagnosis } | null = null;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function firstAnthropicText(data: AnthropicResponse, fallback: string) {
  return data.content?.find((content) => content.type === "text")?.text || fallback;
}

function firstChatCompletionText(data: ChatCompletionResponse, fallback: string) {
  return data.choices?.[0]?.message?.content || fallback;
}

function getPortFriendlyName(port: SerialPortInfo) {
  const maybeNamedPort = port as SerialPortInfo & { friendlyName?: string };
  return maybeNamedPort.friendlyName || port.path;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout ${timeoutMs}ms`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

function cacheResult(result: SystemDiagnosis) {
  cachedDiagnosis = { timestamp: Date.now(), result };
  return result;
}

export function addAnomaly(source: string, message: string, severity: "info" | "warning" | "error" = "error") {
  const anomaly = {
    timestamp: new Date().toISOString(),
    source,
    message,
    severity,
  };
  anomalies.unshift(anomaly);
  addSupportLog(source, message, severity);
  if (anomalies.length > MAX_ANOMALIES) {
    anomalies.pop();
  }
}

export function getAnomalies(): Anomaly[] {
  return [...anomalies];
}

export function clearAnomalies() {
  anomalies.length = 0;
}

// Helper to call the LLM configured in settings
export async function callConfiguredLLM(prompt: string, customSystemPrompt?: string): Promise<string> {
  const provider = getSetting("default_llm_provider") || "opencode";
  const apiKey = getSetting(`${provider}_key`);
  const baseURL = getSetting(`${provider}_baseURL`);
  const model = getSetting(`${provider}_model`);
  const apiFormat = getSetting(`${provider}_apiFormat`) || "openai-compatible";

  if (!apiKey) {
    throw new Error(`Clé API pour le fournisseur '${provider}' non configurée dans les paramètres.`);
  }

  const systemPrompt = "Tu es l'assistant IA de diagnostic matériel de Glow Logic. Analyse le rapport technique DMX et explique les anomalies et propose des solutions concrètes et ordonnées en français, avec un ton professionnel et rassurant. Sois concis.";

  if (customSystemPrompt) {
    return callConfiguredLLMWithSystem(prompt, customSystemPrompt);
  }

  try {
    if (apiFormat === "anthropic") {
      const targetUrl = baseURL || "https://api.anthropic.com/v1/messages";
      const targetModel = model || "claude-3-5-sonnet-20241022";
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: targetModel,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1024,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${errText}`);
      }

      const data = (await response.json()) as AnthropicResponse;
      return firstAnthropicText(data, "Aucune explication générée.");
    } else {
      // OpenAI-compatible format
      const targetUrl = baseURL || "https://api.openai.com/v1/chat/completions";
      const targetModel = model || "gpt-4o-mini";
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI-compatible API error: ${errText}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return firstChatCompletionText(data, "Aucune explication générée.");
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[AnomalyDetector] LLM Call failed:", err);
    throw new Error(`Échec de l'appel au LLM (${provider}) : ${message}`);
  }
}

async function callConfiguredLLMWithSystem(prompt: string, systemPrompt: string): Promise<string> {
  const provider = getSetting("default_llm_provider") || "opencode";
  const apiKey = getSetting(`${provider}_key`);
  const baseURL = getSetting(`${provider}_baseURL`);
  const model = getSetting(`${provider}_model`);
  const apiFormat = getSetting(`${provider}_apiFormat`) || "openai-compatible";

  if (!apiKey) {
    throw new Error(`Cle API pour le fournisseur '${provider}' non configuree dans les parametres.`);
  }

  if (apiFormat === "anthropic") {
    const targetUrl = baseURL || "https://api.anthropic.com/v1/messages";
    const targetModel = model || "claude-3-5-sonnet-20241022";
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: targetModel,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 900,
        temperature: 0.2,
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error: ${await response.text()}`);
    const data = (await response.json()) as AnthropicResponse;
    return firstAnthropicText(data, "Aucune analyse generee.");
  }

  const targetUrl = baseURL || "https://api.openai.com/v1/chat/completions";
  const targetModel = model || "gpt-4o-mini";
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI-compatible API error: ${await response.text()}`);
  const data = (await response.json()) as ChatCompletionResponse;
  return firstChatCompletionText(data, "Aucune analyse generee.");
}

export async function diagnoseSystem(): Promise<SystemDiagnosis> {
  const cached = cachedDiagnosis && Date.now() - cachedDiagnosis.timestamp < DIAGNOSE_CACHE_TTL_MS
    ? cachedDiagnosis.result
    : null;
  if (cached) {
    return {
      ...cached,
      status: {
        ...cached.status,
        cached: true,
      },
    };
  }

  // 1. Gather current hardware status
  let ports: SerialPortInfo[] = [];
  try {
    ports = await withTimeout(SerialPort.list(), SERIAL_LIST_TIMEOUT_MS, "SerialPort.list");
  } catch (error: unknown) {
    addAnomaly("System", `Impossible de lister les ports COM : ${getErrorMessage(error)}`, "error");
  }

  const pythonStatus = pythonDmx.getStatus();
  const usbDmxStatus = usbDmx.getStatus();
  const qlcWsStatus = qlcWs.getStatus();

  const status = {
    serialPorts: ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || "Inconnu",
      friendlyName: getPortFriendlyName(p),
    })),
    pythonDmx: {
      active: pythonStatus.ready,
      port: pythonStatus.port,
      pid: pythonStatus.pid,
    },
    usbDmx: {
      connected: usbDmxStatus.connected,
      portPath: usbDmxStatus.portPath,
      error: usbDmxStatus.error,
    },
    qlcWs: {
      connected: qlcWsStatus.running,
      wsUrl: qlcWsStatus.wsUrl,
    },
    recentAnomalies: getAnomalies().slice(0, 10),
    supportLogs: getSupportLogs(25),
    supportLogPath: getSupportLogPath(),
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  // 2. Determine if anomalies exist
  const hasAnomalies =
    status.recentAnomalies.some(a => a.severity === "error") ||
    (status.usbDmx.portPath !== "" && !status.usbDmx.connected) ||
    (!status.pythonDmx.active && status.pythonDmx.port !== "");

  if (!hasAnomalies && getAnomalies().length === 0) {
    return cacheResult({
      hasAnomalies: false,
      status,
      diagnosis: `Tous les systèmes sont au vert. L'interface DMX est connectée et fonctionne correctement sur le port ${status.pythonDmx.port}.`,
    });
  }

  // 3. Construct prompt for LLM diagnosis
  const prompt = `
Voici le rapport d'état technique de l'application DMX Glow Logic :

--- RAPPORTS DE CONNEXION ---
- Pont DMX Python : ${status.pythonDmx.active ? 'ACTIF' : 'INACTIF'} (Port cible : ${status.pythonDmx.port}, PID : ${status.pythonDmx.pid})
- Connexion native USB-DMX : ${status.usbDmx.connected ? 'CONNECTÉ' : 'DÉCONNECTÉ'} (Port configuré : ${status.usbDmx.portPath}, Erreur : ${status.usbDmx.error || 'Aucune'})
- WebSocket QLC+ : ${status.qlcWs.connected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}

--- PORTS COM VISIBLES SUR LE SYSTÈME ---
${status.serialPorts.map(p => `  * ${p.path} (${p.manufacturer} - ${p.friendlyName})`).join("\n") || "  Aucun port COM détecté."}

--- DERNIÈRES ANOMALIES ENREGISTRÉES ---
${status.recentAnomalies.map(a => `  * [${a.timestamp}] [${a.source}] (${a.severity.toUpperCase()}) : ${a.message}`).join("\n") || "  Aucune anomalie récente dans les logs."}

Analyse ce rapport. Explique clairement en français le problème sous-jacent (par exemple, si le câble est débranché, si un autre programme utilise le port, ou s'il y a un plantage de processus) et propose une suite d'étapes ordonnées et très simples pour le résoudre.
`;

  try {
    const diagnosis = await withTimeout(callConfiguredLLM(prompt), LLM_DIAGNOSIS_TIMEOUT_MS, "Diagnostic LLM");
    return cacheResult({
      hasAnomalies: true,
      status,
      diagnosis,
    });
  } catch (err: unknown) {
    return cacheResult({
      hasAnomalies: true,
      status,
      diagnosis: `Une anomalie a été détectée, mais le diagnostic automatique par IA a échoué.\nErreur IA : ${getErrorMessage(err)}\n\nSolutions manuelles recommandées :\n1. Assurez-vous que le câble USB-DMX est bien connecté au PC sur le port ${status.pythonDmx.port}.\n2. Si le port est bloqué, fermez l'application et relancez "Glow Logic - Stop" puis relancez le serveur.`,
    });
  }
}

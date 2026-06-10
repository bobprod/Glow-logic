import express from "express";
import multer from "multer";
import { createServer } from "http";
import { Server } from "socket.io";
import { initArtNetHost, updateArtNetTarget } from "./services/artnet";
import { dmxRouter } from "./services/dmxRouter";
import { usbDmx } from "./services/usbDmx";
import { qlcWs } from "./services/qlcWsService";
import { qlcEngine } from "./services/qlcEngine";
import { DEFAULT_PYTHON_DMX_PORT, pythonDmx } from "./services/pythonDmx";
import { registerLiveControlHandlers } from "./services/liveControl";
import { SerialPort } from "serialport";
import {
  saveProject,
  getProjects,
  getProjectById,
  getProjectStorageHealth,
  repairProjectStorage,
  deleteProject,
  saveFixture,
  getFixtures,
  getFixtureById,
  deleteFixture,
  saveFixtureGroup,
  getFixtureGroups,
  getFixtureGroupById,
  deleteFixtureGroup,
  saveVenueProfile,
  getVenueProfiles,
  getVenueProfileById,
  deleteVenueProfile,
  saveLibraryItem,
  getLibraryItems,
  getLibraryItemById,
  deleteLibraryItem,
  type LibraryItemKind,
  type LibraryItemScope,
  getAllSettings,
  getSetting,
  setSetting,
  saveScene,
  getScenes,
  getSceneById,
  deleteScene as deleteSceneDb,
  saveCueList,
  getCueLists,
  getCueListById,
  updateCueList,
  deleteCueList as deleteCueListDb,
} from "./services/database";
import { scanDmxManual } from "./services/ocr";
import { enhanceFixtureWithLLM } from "./services/fixture-ai";
import { parseFixtureProfileFile } from "./services/fixtureProfileParser";
import {
  getNetworkAdapters,
  configureStaticIp,
  pollArtNetNodes,
  diagnoseUsbPort,
} from "./services/network";
import { addSupportLog, clearSupportLogs, getSupportLogPath, getSupportLogs } from "./services/supportLog";
import { activateLicense, createLocalLicenseKey, getLicenseStatus } from "./services/license";
import {
  getSafetyState,
  setHazardArmed,
  setOperatorRole,
  validateSafetyAction,
  type HazardType,
  type OperatorRole,
} from "./services/safetyGate";
import {
  getResolumeStatus,
  setResolumeConfig,
  sendResolumeOsc,
  triggerResolumeAction,
  type ResolumeAction,
} from "./services/resolume";
import {
  getSyncClockState,
  ingestSyncClock,
  setSyncClockConfig,
  type SyncSource,
} from "./services/syncClock";
import {
  createMediaGenerationJob,
  getMediaGenerationJobs,
  getMediaProviderStatus,
} from "./services/mediaGenerator";
import { executeShowActions, type ShowActionInput } from "./services/showActions";
import { diagnoseSystem } from "./services/anomalyDetector";

const app = express();
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
addSupportLog("SERVER", "Glow Logic server starting", "info", {
  node: process.version,
  platform: process.platform,
});

// ── Global error guards — prevent native module crashes from killing the server ──
process.on("uncaughtException", (err) => {
  console.error("⚠️  [UNCAUGHT EXCEPTION — server kept alive]:", err.message);
  addSupportLog("SERVER", `Exception non gérée : ${err.message}`, "error", { stack: err.stack });
  try {
    const { addAnomaly } = require("./services/anomalyDetector");
    addAnomaly("SERVER", `Exception non gérée : ${err.message}`, "error");
  } catch {}
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("⚠️  [UNHANDLED REJECTION — server kept alive]:", msg);
  addSupportLog("SERVER", `Rejet non géré : ${msg}`, "error");
  try {
    const { addAnomaly } = require("./services/anomalyDetector");
    addAnomaly("SERVER", `Rejet non géré : ${msg}`, "error");
  } catch {}
});

app.use(express.json({ limit: "10mb" })); // Essential for parsing project JSON data
// CORS permissif pour le client Next.js (localhost:3000)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Multer : upload d'image en memoire (max 10 Mo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Seules les images sont acceptees"));
    }
    cb(null, true);
  },
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// ── REST API — Settings (LLM keys, config) ───────────────────
app.get("/api/settings", (_req, res) => {
  try {
    const settings = getAllSettings();
    // Mask API key values — never expose full keys over the network
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings)) {
      masked[k] =
        k.endsWith("_key") && v.length > 8
          ? v.slice(0, 4) + "*".repeat(v.length - 8) + v.slice(-4)
          : v;
    }
    res.json(masked);
  } catch {
    res.status(500).json({ error: "Erreur lecture settings" });
  }
});

app.get("/api/diagnose", async (_req, res) => {
  try {
    const result = await diagnoseSystem();
    addSupportLog("DIAGNOSE", "Diagnostic requested", result.hasAnomalies ? "warning" : "info");
    res.json(result);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    addSupportLog("DIAGNOSE", `Diagnostic failed: ${message}`, "error");
    res.status(500).json({ error: "Erreur lors du diagnostic", details: message });
  }
});
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.get("/api/support/logs", (req, res) => {
  const limit = Number(req.query.limit || 100);
  res.json({
    path: getSupportLogPath(),
    logs: getSupportLogs(Number.isFinite(limit) ? limit : 100),
  });
});

app.post("/api/support/logs/clear", (_req, res) => {
  clearSupportLogs();
  addSupportLog("SUPPORT", "Support logs cleared", "info");
  res.json({ success: true });
});

app.get("/api/support/report", async (_req, res) => {
  try {
    const diagnosis = await diagnoseSystem();
    res.json({
      generatedAt: new Date().toISOString(),
      app: "Glow Logic",
      logPath: getSupportLogPath(),
      diagnosis,
      logs: getSupportLogs(200),
    });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    addSupportLog("SUPPORT", `Support report failed: ${message}`, "error");
    res.status(500).json({ error: "Erreur rapport support", details: message });
  }
});

app.get("/api/license", (_req, res) => {
  try {
    res.json(getLicenseStatus());
  } catch (err: any) {
    addSupportLog("LICENSE", `License status failed: ${err.message}`, "error");
    res.status(500).json({ error: "Erreur statut licence", details: err.message });
  }
});

app.post("/api/license/activate", (req, res) => {
  try {
    const { key } = req.body as { key?: string };
    if (!key) return res.status(400).json({ error: "Clé de licence obligatoire" });
    res.json(activateLicense(key));
  } catch (err: any) {
    addSupportLog("LICENSE", `Activation failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Activation impossible", details: err.message });
  }
});

app.post("/api/license/dev-key", (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Route disponible uniquement en développement" });
    }
    const { licenseName = "Glow Logic Dev", machineId, expiresAt } = req.body || {};
    res.json({ key: createLocalLicenseKey(String(licenseName), machineId, expiresAt) });
  } catch (err: any) {
    res.status(500).json({ error: "Erreur génération licence", details: err.message });
  }
});

app.get("/api/safety", (_req, res) => {
  try {
    res.json(getSafetyState());
  } catch (err: any) {
    addSupportLog("SAFETY", `Safety status failed: ${err.message}`, "error");
    res.status(500).json({ error: "Erreur statut safety", details: err.message });
  }
});

app.post("/api/safety/role", (req, res) => {
  try {
    const { role } = req.body as { role?: OperatorRole };
    if (role !== "beginner" && role !== "expert" && role !== "admin") {
      return res.status(400).json({ error: "Role invalide" });
    }
    res.json(setOperatorRole(role));
  } catch (err: any) {
    addSupportLog("SAFETY", `Role update failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Role safety impossible", details: err.message });
  }
});

app.post("/api/safety/arm", (req, res) => {
  try {
    const { hazard, armed, confirmation } = req.body as {
      hazard?: HazardType;
      armed?: boolean;
      confirmation?: string;
    };
    if (!hazard) return res.status(400).json({ error: "Hazard obligatoire" });
    res.json(setHazardArmed(hazard, Boolean(armed), confirmation));
  } catch (err: any) {
    addSupportLog("SAFETY", `Arm update failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Armement impossible", details: err.message });
  }
});

app.post("/api/safety/validate", (req, res) => {
  try {
    res.json(validateSafetyAction(req.body || {}));
  } catch (err: any) {
    addSupportLog("SAFETY", `Validation failed: ${err.message}`, "error");
    res.status(500).json({ error: "Validation safety impossible", details: err.message });
  }
});

async function handleShowActionsRequest(req: express.Request, res: express.Response) {
  try {
    const actions = Array.isArray(req.body?.actions)
      ? req.body.actions
      : req.body?.type
        ? [req.body]
        : [];

    if (actions.length === 0) {
      return res.status(400).json({ error: "actions obligatoire" });
    }

    const result = await executeShowActions(actions as ShowActionInput[]);
    for (const actionResult of result.results) {
      for (const update of actionResult.dmxUpdates) {
        io.emit("dmx_sync", update);
      }
    }
    return res.status(result.ok ? 200 : 207).json(result);
  } catch (err: any) {
    addSupportLog("SHOW_ACTIONS", `Batch failed: ${err.message}`, "error");
    return res.status(500).json({ error: "Execution Show Actions impossible", details: err.message });
  }
}

app.post("/api/show-actions", handleShowActionsRequest);
app.post("/api/actions/execute", handleShowActionsRequest);

app.post("/api/settings", (req, res) => {
  try {
    const entries = req.body as Record<string, string>;
    if (typeof entries !== "object" || Array.isArray(entries)) {
      return res
        .status(400)
        .json({ error: "Body doit être un objet {key: value}" });
    }
    for (const [key, value] of Object.entries(entries)) {
      if (typeof key === "string" && typeof value === "string") {
        setSetting(key, value);
      }
    }
    // Propagate host change to Art-Net service immediately
    if (entries.qlc_host) updateArtNetTarget(entries.qlc_host);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur sauvegarde settings" });
  }
});

app.get("/api/video/resolume", (_req, res) => {
  try {
    res.json(getResolumeStatus());
  } catch (err: any) {
    res.status(500).json({ error: "Erreur statut Resolume", details: err.message });
  }
});

app.post("/api/video/resolume/config", (req, res) => {
  try {
    const body = req.body || {};
    res.json(setResolumeConfig({
      enabled: Boolean(body.enabled),
      host: body.host,
      port: body.port,
      localPort: body.localPort,
    }));
  } catch (err: any) {
    res.status(500).json({ error: "Erreur configuration Resolume", details: err.message });
  }
});

app.post("/api/video/resolume/osc", (req, res) => {
  try {
    const { address, args = [] } = req.body || {};
    if (typeof address !== "string" || !address.startsWith("/")) {
      return res.status(400).json({ error: "Adresse OSC obligatoire" });
    }
    res.json(sendResolumeOsc(address, Array.isArray(args) ? args : []));
  } catch (err: any) {
    res.status(500).json({ error: "Erreur envoi OSC Resolume", details: err.message });
  }
});

app.post("/api/video/resolume/action", (req, res) => {
  try {
    const { action, payload = {} } = req.body || {};
    const allowed: ResolumeAction[] = ["play", "pause", "clip", "column", "layer_opacity", "bpm"];
    if (!allowed.includes(action)) {
      return res.status(400).json({ error: "Action Resolume invalide" });
    }
    res.json(triggerResolumeAction(action, payload));
  } catch (err: any) {
    res.status(500).json({ error: "Erreur action Resolume", details: err.message });
  }
});

app.get("/api/sync/status", (_req, res) => {
  try {
    res.json(getSyncClockState());
  } catch (err: any) {
    res.status(500).json({ error: "Erreur statut sync", details: err.message });
  }
});

app.post("/api/sync/config", (req, res) => {
  try {
    const { enabled, trustExternalBpm, source } = req.body || {};
    const state = setSyncClockConfig({
      enabled: enabled === undefined ? undefined : Boolean(enabled),
      trustExternalBpm: trustExternalBpm === undefined ? undefined : Boolean(trustExternalBpm),
      source,
    });
    io.emit("sync:status", state);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: "Erreur configuration sync", details: err.message });
  }
});

app.post("/api/sync/bpm", (req, res) => {
  try {
    const { bpm, phase, source = "manual", confidence = 1 } = req.body || {};
    const state = ingestSyncClock({
      bpm,
      phase,
      source: source as SyncSource,
      confidence,
    });
    io.emit("sync:bpm", state);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: "Erreur ingestion sync", details: err.message });
  }
});

// ── LLM Proxy ─────────────────────────────────────────────────
app.post("/api/llm/chat", async (req, res) => {
  try {
    let { provider, messages, model, temperature = 0.7, max_tokens = 2048 } =
      req.body as {
        provider?: string;
        messages?: Array<{ role: string; content: string }>;
        model?: string;
        temperature?: number;
        max_tokens?: number;
        prompt?: string;
        systemPrompt?: string;
      };

    // Support legacy format: prompt + systemPrompt → messages
    if (!messages && req.body.prompt) {
      messages = [];
      if (req.body.systemPrompt) {
        messages.push({ role: "system", content: req.body.systemPrompt });
      }
      messages.push({ role: "user", content: req.body.prompt });
    }

    // Auto-detect provider from settings if not provided
    if (!provider) {
      provider = getSetting("default_llm_provider") || "opencode";
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages ou prompt obligatoires" });
    }

    const apiKey = getSetting(`${provider}_key`);
    const baseURL = getSetting(`${provider}_baseURL`);
    const savedModel = getSetting(`${provider}_model`);
    const apiFormat = getSetting(`${provider}_apiFormat`) || "openai-compatible";

    if (!apiKey) {
      return res.status(400).json({ error: `Clé API ${provider} non configurée` });
    }

    const targetUrl = baseURL || "https://api.openai.com/v1/chat/completions";
    const targetModel = model || savedModel || "gpt-4o";

    let response: Response;

    if (apiFormat === "anthropic") {
      // Format Anthropic (Claude)
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature,
          max_tokens,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const anthropicData = await response.json() as {
        content: Array<{ type: string; text: string }>;
        role: string;
        model: string;
        usage?: { input_tokens: number; output_tokens: number };
      };

      // Normaliser en format OpenAI-compatible
      const normalized = {
        choices: [
          {
            message: {
              role: anthropicData.role || "assistant",
              content:
                anthropicData.content.find((c) => c.type === "text")?.text ||
                "",
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
        model: anthropicData.model,
        usage: anthropicData.usage
          ? {
              prompt_tokens: anthropicData.usage.input_tokens,
              completion_tokens: anthropicData.usage.output_tokens,
              total_tokens:
                anthropicData.usage.input_tokens +
                anthropicData.usage.output_tokens,
            }
          : undefined,
      };
      return res.json(normalized);
    }

    // Format OpenAI-compatible (défaut)
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur proxy LLM" });
  }
});

// ── REST API — Projet Management ──────────────────────────────
app.get("/api/llm/media-providers", (_req, res) => {
  try {
    res.json({
      providers: getMediaProviderStatus(),
      jobs: getMediaGenerationJobs(10),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Statut generateurs media indisponible", details: err.message });
  }
});

app.post("/api/llm/generate-media", (req, res) => {
  try {
    const job = createMediaGenerationJob(req.body || {});
    res.status(job.status === "queued" ? 202 : 200).json({
      success: true,
      job,
      providers: getMediaProviderStatus(),
    });
  } catch (err: any) {
    addSupportLog("MEDIA_AI", `Media generation failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Generation media impossible", details: err.message });
  }
});

app.get("/api/projects", (req, res) => {
  try {
    const projects = getProjects();
    res.json(projects);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des projets" });
  }
});

app.get("/api/projects/health", (_req, res) => {
  try {
    res.json(getProjectStorageHealth());
  } catch (error: any) {
    res.status(500).json({ error: "Erreur diagnostic stockage projets", details: error.message });
  }
});

app.post("/api/projects/health/ai", async (_req, res) => {
  try {
    const health = getProjectStorageHealth();
    const { callConfiguredLLM } = require("./services/anomalyDetector");
    const systemPrompt = [
      "Tu es l'assistant IA de maintenance de Glow Logic.",
      "Analyse uniquement le diagnostic de stockage projets fourni.",
      "Ne propose jamais de suppression automatique.",
      "Si une reparation est utile, propose des actions non destructives et verifiables.",
      "Reponds en francais, avec 3 sections courtes: Verdict, Risques, Actions recommandees.",
    ].join(" ");
    const prompt = `Diagnostic stockage projets Glow Logic:\n${JSON.stringify(health, null, 2)}\n\nContexte: ces projets servent a des shows lumiere/DJ. Il faut proteger les shows fonctionnels et eviter toute action destructive automatique.`;
    const analysis = await callConfiguredLLM(prompt, systemPrompt);
    res.json({
      ok: true,
      health,
      analysis,
      mode: "advisory_only",
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: "Analyse IA indisponible",
      details: error.message,
      mode: "advisory_only",
    });
  }
});

app.post("/api/projects/repair", (req, res) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    const report = repairProjectStorage(dryRun);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Reparation stockage projets impossible", details: error.message });
  }
});

app.get("/api/projects/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID projet invalide" });
    }
    const project = getProjectById(id);
    if (project) res.json(project);
    else res.status(404).json({ error: "Projet non trouvé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement du projet" });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const { name, data } = req.body;
    const cleanName = String(name || "").trim();
    if (!cleanName || !data || typeof data !== "object") {
      return res.status(400).json({ error: "Nom et données obligatoires" });
    }
    const id = saveProject(cleanName, data);
    res.json({ id, success: true, schemaVersion: Number(data.version || data.schemaVersion || 1) });
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de la sauvegarde du projet", details: error.message });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID projet invalide" });
    }
    const result = deleteProject(id);
    res.json({ success: true, deleted: result.changes > 0 });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ── REST API — Fixtures (patchs DMX) ─────────────────────────
app.get("/api/fixtures", (_req, res) => {
  try {
    res.json(getFixtures());
  } catch {
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des fixtures" });
  }
});

app.get("/api/fixtures/:id", (req, res) => {
  try {
    const fixture = getFixtureById(parseInt(req.params.id));
    if (fixture) res.json(fixture);
    else res.status(404).json({ error: "Fixture introuvable" });
  } catch {
    res.status(500).json({ error: "Erreur lors du chargement" });
  }
});

app.post("/api/fixtures", (req, res) => {
  try {
    const { id, name, manufacturer, channels, notes, startAddress, modes } = req.body;
    if (!name || !Array.isArray(channels)) {
      return res.status(400).json({ error: "Nom et channels obligatoires" });
    }
    const savedId = saveFixture(
      name, channels, manufacturer, notes,
      id ? Number(id) : undefined,
      startAddress ? Number(startAddress) : 1,
      Array.isArray(modes) ? modes : undefined,
    );
    res.json({ id: savedId, success: true });
  } catch (error) {
    console.error("[Fixtures] save error:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde de la fixture" });
  }
});

app.post("/api/fixtures/import-profile", profileUpload.single("profile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fichier profil manquant (champ profile)" });
    }

    const parsed = parseFixtureProfileFile(req.file.originalname, req.file.buffer);
    const firstMode = parsed.modes.find((mode) => mode.channels.length > 0) || parsed.modes[0];
    if (!firstMode || firstMode.channels.length === 0) {
      return res.status(400).json({ error: "Aucun canal DMX detecte dans ce profil" });
    }

    const savedId = saveFixture(
      parsed.model,
      firstMode.channels,
      parsed.manufacturer,
      `${parsed.type} · import ${parsed.sourceFormat.toUpperCase()} · ${parsed.modes.length} mode(s)`,
      undefined,
      1,
      parsed.modes,
    );
    saveLibraryItem(
      "fixture_profile",
      "user",
      `${parsed.manufacturer} ${parsed.model}`.trim(),
      parsed,
      `${parsed.type} · ${parsed.sourceFormat.toUpperCase()} · ${parsed.modes.length} mode(s)`,
      [parsed.sourceFormat, "fixture", "import"],
    );
    addSupportLog("FIXTURES", `Fixture profile imported: ${parsed.manufacturer} ${parsed.model}`, "info", {
      format: parsed.sourceFormat,
      modes: parsed.modes.length,
      channels: firstMode.channels.length,
    });
    res.json({ success: true, id: savedId, fixture: getFixtureById(savedId), profile: parsed });
  } catch (err: any) {
    addSupportLog("FIXTURES", `Fixture profile import failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Import profil impossible", details: err.message });
  }
});

app.delete("/api/fixtures/:id", (req, res) => {
  try {
    deleteFixture(parseInt(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ── Fixture Groups API ────────────────────────────────────────
app.get("/api/fixture-groups", (_req, res) => {
  try {
    res.json(getFixtureGroups());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/fixture-groups/:id", (req, res) => {
  try {
    const group = getFixtureGroupById(parseInt(req.params.id));
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/fixture-groups", (req, res) => {
  try {
    const { id, name, role, color, fixtureIds } = req.body;
    if (!name || !Array.isArray(fixtureIds)) {
      return res.status(400).json({ error: "name et fixtureIds obligatoires" });
    }
    const savedId = saveFixtureGroup(
      String(name),
      fixtureIds.map((fixtureId: unknown) => Number(fixtureId)).filter((fixtureId: number) => Number.isFinite(fixtureId)),
      role ? String(role) : null,
      color ? String(color) : "#06b6d4",
      id ? Number(id) : undefined,
    );
    res.json(getFixtureGroupById(savedId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/fixture-groups/:id", (req, res) => {
  try {
    deleteFixtureGroup(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/venue-profiles", (_req, res) => {
  try {
    res.json(getVenueProfiles());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/venue-profiles/:id", (req, res) => {
  try {
    const profile = getVenueProfileById(parseInt(req.params.id));
    if (!profile) return res.status(404).json({ error: "Venue profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/venue-profiles", (req, res) => {
  try {
    const { id, name, data } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const savedId = saveVenueProfile(String(name), data || {}, id ? Number(id) : undefined);
    res.status(201).json(getVenueProfileById(savedId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/venue-profiles/:id", (req, res) => {
  try {
    deleteVenueProfile(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/library", (req, res) => {
  try {
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    res.json(getLibraryItems(kind, scope));
  } catch (err: any) {
    addSupportLog("LIBRARY", `Library list failed: ${err.message}`, "error");
    res.status(500).json({ error: "Erreur bibliotheque", details: err.message });
  }
});

app.get("/api/library/export", (_req, res) => {
  try {
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "Glow Logic",
      items: getLibraryItems().filter((item) => item.scope !== "system"),
    });
  } catch (err: any) {
    addSupportLog("LIBRARY", `Library export failed: ${err.message}`, "error");
    res.status(500).json({ error: "Export bibliotheque impossible", details: err.message });
  }
});

app.get("/api/library/:id", (req, res) => {
  const item = getLibraryItemById(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Item introuvable" });
  res.json(item);
});

app.post("/api/library", (req, res) => {
  try {
    const { id, kind, scope = "user", name, description, tags = [], data } = req.body as {
      id?: number;
      kind?: LibraryItemKind;
      scope?: LibraryItemScope;
      name?: string;
      description?: string;
      tags?: string[];
      data?: any;
    };
    if (!kind || !name) return res.status(400).json({ error: "kind et name obligatoires" });
    if (!["fixture_profile", "look_preset", "show_template", "venue_template"].includes(kind)) {
      return res.status(400).json({ error: "kind invalide" });
    }
    if (!["user", "community"].includes(scope)) {
      return res.status(400).json({ error: "scope invalide pour ecriture" });
    }
    const savedId = saveLibraryItem(kind, scope, name, data || {}, description, Array.isArray(tags) ? tags : [], id);
    addSupportLog("LIBRARY", `Library item saved: ${name}`, "info", { kind, scope });
    res.json(getLibraryItemById(savedId));
  } catch (err: any) {
    addSupportLog("LIBRARY", `Library save failed: ${err.message}`, "error");
    res.status(500).json({ error: "Sauvegarde bibliotheque impossible", details: err.message });
  }
});

app.post("/api/library/import", (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const saved = items
      .filter((item: any) => item.kind && item.name)
      .map((item: any) => saveLibraryItem(
        item.kind,
        item.scope === "community" ? "community" : "user",
        item.name,
        item.data || {},
        item.description,
        Array.isArray(item.tags) ? item.tags : [],
      ));
    addSupportLog("LIBRARY", `Library import completed: ${saved.length} item(s)`, "info");
    res.json({ success: true, imported: saved.length });
  } catch (err: any) {
    addSupportLog("LIBRARY", `Library import failed: ${err.message}`, "error");
    res.status(500).json({ error: "Import bibliotheque impossible", details: err.message });
  }
});

app.delete("/api/library/:id", (req, res) => {
  try {
    const result = deleteLibraryItem(Number(req.params.id));
    res.json({ success: result.changes > 0 });
  } catch (err: any) {
    addSupportLog("LIBRARY", `Library delete failed: ${err.message}`, "error");
    res.status(500).json({ error: "Suppression bibliotheque impossible", details: err.message });
  }
});

// OCR + LLM Vision scan : upload d'une photo du manuel DMX
// Accepte 1 à 8 images : champ "images" (multi) OU "image" (compat single)
const scanUpload = upload.fields([
  { name: "images", maxCount: 8 },
  { name: "image", maxCount: 1 },
]);

app.post("/api/fixtures/scan", scanUpload, async (req, res) => {
  try {
    const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files: Express.Multer.File[] = [
      ...(filesMap?.images ?? []),
      ...(filesMap?.image ?? []),
    ];

    if (files.length === 0) {
      return res.status(400).json({ error: 'Aucune image fournie (champ "images" ou "image")' });
    }

    console.log(`[OCR] Scan de ${files.length} image(s)...`);

    // Phase 1 : OCR Tesseract sur chaque image, on combine le texte
    const ocrResults = await Promise.all(files.map((f) => scanDmxManual(f.buffer)));
    const combinedText = ocrResults
      .map((r, i) => `=== PAGE ${i + 1} ===\n${r.rawText}`)
      .join("\n\n");
    const avgConfidence = ocrResults.reduce((s, r) => s + r.confidence, 0) / ocrResults.length;
    // Channels OCR : on prend l'union (par numéro de canal) de toutes les pages
    const ocrChannelsMap = new Map<number, any>();
    for (const r of ocrResults) {
      for (const ch of r.channels) {
        if (!ocrChannelsMap.has(ch.channel)) ocrChannelsMap.set(ch.channel, ch);
      }
    }
    const ocrChannels = [...ocrChannelsMap.values()].sort((a, b) => a.channel - b.channel);
    const fixtureName = ocrResults.find((r) => r.fixtureName)?.fixtureName;

    console.log(`[OCR] ${ocrChannels.length} channels uniques (confiance moy ${avgConfidence.toFixed(1)}%)`);

    const ocrPayload = {
      channels: ocrChannels,
      rawText: combinedText,
      confidence: avgConfidence,
      fixtureName,
      totalChannels: ocrChannels.length,
    };

    // Phase 2 : LLM (vision si supportée) — config depuis frontend ou DB
    let ai: any = undefined;
    const reqProvider  = req.body?.llmProvider  as string | undefined;
    const reqKey       = req.body?.llmKey       as string | undefined;
    const reqModel     = req.body?.llmModel     as string | undefined;
    const reqBaseURL   = req.body?.llmBaseURL   as string | undefined;
    const reqApiFormat = req.body?.llmApiFormat as string | undefined;

    const provider = reqProvider || getSetting("default_llm_provider") || "";
    const apiKey   = reqKey      || (provider ? getSetting(`${provider}_key`) : null);

    console.log(`[Scan] provider="${provider}" hasKey=${!!apiKey} model="${reqModel || ""}" images=${files.length}`);

    if (provider && apiKey) {
      const baseURL    = reqBaseURL   || getSetting(`${provider}_baseURL`) || "";
      const apiFormat  = reqApiFormat || getSetting(`${provider}_apiFormat`) || "openai-compatible";
      const savedModel = reqModel     || getSetting(`${provider}_model`) || "";

      const images = files.map((f) => ({
        base64: f.buffer.toString("base64"),
        mimeType: f.mimetype || "image/jpeg",
      }));

      const { result: aiResult, reason: aiReason } = await enhanceFixtureWithLLM(
        combinedText, images, provider, apiKey, baseURL, apiFormat, savedModel,
      );

      if (aiResult) {
        console.log(`[Fixture-AI] OK: ${aiResult.manufacturer} ${aiResult.model} — ${aiResult.modes.length} mode(s)`);
        ai = aiResult;
      } else {
        console.warn(`[Fixture-AI] Fallback OCR — raison: ${aiReason}`);
      }

      res.json({
        ...ocrPayload,
        ...(ai ? { ai } : {}),
        scanInfo: {
          usedAI:         !!ai,
          aiProvider:     provider || null,
          imageCount:     files.length,
          fallbackReason: ai ? null : (aiReason || null),
        },
      });
      return;
    }

    // Pas de clé — OCR seul
    res.json({
      ...ocrPayload,
      scanInfo: { usedAI: false, aiProvider: null, imageCount: files.length, fallbackReason: "no_key" },
    });
  } catch (error) {
    console.error("[OCR] error:", error);
    res.status(500).json({ error: "Erreur lors du scan", detail: String(error) });
  }
});

app.post("/api/fixtures/scan-text", async (req, res) => {
  try {
    const {
      rawText,
      llmProvider,
      llmKey,
      llmModel,
      llmBaseURL,
      llmApiFormat
    } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "Texte brut manquant." });
    }

    const provider = llmProvider || getSetting("default_llm_provider") || "";
    const apiKey   = llmKey      || (provider ? getSetting(`${provider}_key`) : null);

    if (!provider || !apiKey) {
      return res.status(400).json({ error: "Clé API non configurée. Veuillez configurer vos clés dans les réglages." });
    }

    const baseURL    = llmBaseURL   || getSetting(`${provider}_baseURL`) || "";
    const apiFormat  = llmApiFormat || getSetting(`${provider}_apiFormat`) || "openai-compatible";
    const model      = llmModel     || getSetting(`${provider}_model`) || "";

    console.log(`[Scan Text] provider="${provider}" hasKey=${!!apiKey} model="${model}" textLength=${rawText.length}`);

    const { result: aiResult, reason: aiReason } = await enhanceFixtureWithLLM(
      rawText, [], provider, apiKey, baseURL, apiFormat, model
    );

    if (aiResult) {
      res.json({
        success: true,
        ai: aiResult,
        scanInfo: {
          usedAI: true,
          aiProvider: provider,
          imageCount: 0,
          fallbackReason: null
        }
      });
    } else {
      res.status(500).json({
        error: "L'IA n'a pas pu décoder ce footprint.",
        reason: aiReason
      });
    }
  } catch (error) {
    console.error("[Scan Text] error:", error);
    res.status(500).json({ error: "Erreur lors de l'analyse du texte", detail: String(error) });
  }
});

// ── USB DMX Routes ──────────────────────────────────────────
app.get("/api/dmx/ports", async (_req, res) => {
  try {
    const ports = await SerialPort.list();
    const ftdiPorts = ports.filter(
      (p) =>
        p.vendorId === "0403" || // FTDI vendor ID
        p.manufacturer?.toLowerCase().includes("ftdi") ||
        p.manufacturer?.toLowerCase().includes("doremidi")
    );
    res.json(ftdiPorts.length > 0 ? ftdiPorts : ports);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/dmx/usb-status", (_req, res) => {
  res.json(usbDmx.getStatus());
});

app.post("/api/dmx/usb-config", (req, res) => {
  try {
    const { enabled, portPath, universe } = req.body;
    usbDmx.updateConfig(
      enabled === true || enabled === "1",
      String(portPath || ""),
      parseInt(universe || "1", 10)
    );
    // Auto-sync router: enable USB output as soon as dongle is connected
    setTimeout(() => {
      dmxRouter.setOutputs({ usbDmx: usbDmx.getStatus().connected });
    }, 500);
    res.json({ success: true, status: usbDmx.getStatus() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Network & Hardware Wizard Routes ──────────────────────────
app.get("/api/network/adapters", async (_req, res) => {
  try {
    const adapters = await getNetworkAdapters();
    res.json(adapters);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/network/configure", async (req, res) => {
  try {
    const { name, ip, mask } = req.body;
    if (!name || !ip || !mask) {
      return res.status(400).json({ error: "name, ip, and mask are required" });
    }
    const result = await configureStaticIp(name, ip, mask);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/network/poll", async (_req, res) => {
  try {
    const nodes = await pollArtNetNodes();
    res.json(nodes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/network/usb-diagnose", async (req, res) => {
  try {
    const portPath = req.query.port as string;
    const result = await diagnoseUsbPort(portPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QLC+ Engine Status ────────────────────────────────────────
app.get("/api/qlc/engine-status", (_req, res) => {
  res.json(qlcEngine.getStatus());
});

app.post("/api/qlc/engine-restart", async (_req, res) => {
  qlcEngine.stop();
  setTimeout(() => qlcEngine.start(), 500);
  res.json({ success: true });
});

// ── QLC+ WebSocket Bridge ─────────────────────────────────────
app.get("/api/qlc/ws-status", (_req, res) => {
  res.json(qlcWs.getStatus());
});

app.post("/api/qlc/ws-enable", (_req, res) => {
  qlcWs.enable();
  dmxRouter.setOutputs({ qlcWs: true, qlcOsc: false, usbDmx: false });
  res.json({ success: true, status: qlcWs.getStatus() });
});

app.post("/api/qlc/ws-disable", (_req, res) => {
  qlcWs.disable();
  dmxRouter.setOutputs({ qlcWs: false });
  res.json({ success: true });
});

app.post("/api/qlc/launch", (_req, res) => {
  const result = qlcWs.launchQlc();
  res.json(result);
});

app.post("/api/qlc/install", async (_req, res) => {
  const result = await qlcWs.installQlc();
  res.json(result);
});

app.get("/api/qlc/workspace", (_req, res) => {
  const wsPath = qlcWs.generateWorkspace();
  res.download(wsPath, 'glow-logic.qxw');
});

// ── DMX Router Config ─────────────────────────────────────────
app.get("/api/dmx/router", (_req, res) => {
  res.json(dmxRouter.getOutputs());
});

app.post("/api/dmx/router", (req, res) => {
  try {
    dmxRouter.setOutputs(req.body);
    res.json({ success: true, outputs: dmxRouter.getOutputs() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── DMX Force Flush ──────────────────────────────────────────
app.post("/api/dmx/flush", (_req, res) => {
  io.emit("dmx_flush", { timestamp: Date.now() });
  res.json({ success: true, message: "Flush broadcast sent to all clients" });
});

// ── DMX Live State ──────────────────────────────────────────
app.get("/api/dmx/live", (_req, res) => {
  const channels: Record<number, number> = {};
  const universe1 = (dmxRouter as any).channels as Map<number, number> | undefined;
  if (universe1) {
    universe1.forEach((v, k) => { channels[k] = v; });
  }
  res.json({ universe: 1, channels, timestamp: Date.now() });
});

// ── Scenes API ───────────────────────────────────────────────
app.get("/api/scenes", (_req, res) => {
  try {
    const scenes = getScenes();
    res.json(scenes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/scenes/:id", (req, res) => {
  const scene = getSceneById(parseInt(req.params.id));
  if (!scene) return res.status(404).json({ error: "Scene not found" });
  res.json(scene);
});

app.post("/api/scenes", (req, res) => {
  try {
    const { name, color, values } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const id = saveScene(name, color || "#06b6d4", values || []);
    const scene = getSceneById(id);
    res.status(201).json(scene);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/scenes/:id", (req, res) => {
  try {
    deleteSceneDb(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Cue Lists API ────────────────────────────────────────────
app.get("/api/cues", (_req, res) => {
  try {
    const cueLists = getCueLists();
    res.json(cueLists);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/cues/:id", (req, res) => {
  const cueList = getCueListById(parseInt(req.params.id));
  if (!cueList) return res.status(404).json({ error: "Cue list not found" });
  res.json(cueList);
});

app.post("/api/cues", (req, res) => {
  try {
    const { name, cues } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const id = saveCueList(name, cues || []);
    const cueList = getCueListById(id);
    res.status(201).json(cueList);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.put("/api/cues/:id", (req, res) => {
  try {
    const { name, cues } = req.body;
    updateCueList(parseInt(req.params.id), name, cues || []);
    const cueList = getCueListById(parseInt(req.params.id));
    res.json(cueList);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/api/cues/:id", (req, res) => {
  try {
    deleteCueListDb(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ============================================================

io.on("connection", (socket) => {
  console.log("🎨 Client connecté :", socket.id);

  // ── PRO MODE: Nodal Canvas ─────────────────────────────
  // Reçoit les commandes DMX brutes depuis les noeuds React Flow
  socket.on(
    "dmx_update",
    (data: { universe: number; channel: number; value: number }) => {
      const { universe, channel, value } = data;

      // Unified dispatch to all active outputs (QLC+ OSC, Art-Net, USB DMX)
      dmxRouter.setChannel(universe, channel, value);

      // Sync à tous les clients connectés (y compris l'expéditeur pour le visualizer)
      io.emit("dmx_sync", data);
    },
  );

  registerLiveControlHandlers(io, socket);

  socket.on("acp_message", (message: Record<string, unknown>) => {
    const messageType = typeof message?.type === "string" ? message.type : undefined;
    const messageFrom = typeof message?.from === "string" ? message.from : socket.id;
    const payload = {
      ...message,
      relayId: `acp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      receivedAt: new Date().toISOString(),
      from: messageFrom,
    };
    addSupportLog("ACP", "Message relaye", "info", {
      relayId: payload.relayId,
      from: messageFrom,
      type: messageType,
    });
    socket.broadcast.emit("acp_message", payload);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client déconnecté :", socket.id);
  });
});

const PORT = Number(process.env.GLOW_SERVER_PORT || 3005);
let serverStarted = false;

export function startServer(port = PORT) {
  if (serverStarted) return httpServer;
  serverStarted = true;

  httpServer.listen(port, () => {
    if (process.env.NODE_ENV === "test") {
      console.log(`Glow Logic API test server running on http://localhost:${port}`);
      return;
    }

  initArtNetHost();
  usbDmx.loadConfig();
  dmxRouter.loadConfig();

  // Start Python DMX Bridge (primary DMX output — configurable, defaults to the current test rig)
  const pythonDmxPort = getSetting("python_dmx_port") || getSetting("usb_dmx_port") || DEFAULT_PYTHON_DMX_PORT;
  usbDmx.updateConfig(false, "", 1); // Release the FTDI port for the Python bridge.
  pythonDmx.start(pythonDmxPort);
  pythonDmx.on("ready", () => io.emit("dmx_bridge_status", { ready: true }));
  pythonDmx.on("error", (err) => {
    console.error("⚠️ [Python DMX Bridge Error]", err);
    io.emit("dmx_bridge_status", { ready: false, error: String(err) });
  });

  // Auto-start QLC+ engine (non-blocking — fires in background)
  qlcEngine.on("status", (s) => io.emit("qlc_engine_status", s));
  qlcEngine.on("need-install", () => io.emit("qlc_need_install", true));
  // QLC+ claims the FTDI device → release our USB-DMX hold on the configured port.
  qlcEngine.on("claiming-device", () => {
    console.log(`[QLC Engine] Libération de ${pythonDmxPort} pour QLC+...`);
    usbDmx.updateConfig(false, "", 1);
    dmxRouter.setOutputs({ usbDmx: false });
  });
  // setImmediate(() => qlcEngine.start().catch(e => console.warn("[QLC Engine]", String(e))));

  console.log(`🚀 Glow Logic Engine running on http://localhost:${port}`);
  console.log(`🎛️  QLC+ Engine → auto-start headless`);
  console.log(`🔗  DMX Router → QLC+ WS + Art-Net + USB-DMX`);
  });

  return httpServer;
}

if (require.main === module) {
  startServer();
}

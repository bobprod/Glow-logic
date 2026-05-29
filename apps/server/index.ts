import express from "express";
import multer from "multer";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import {
  sendDmxValue,
  triggerScene,
  setSlider,
  setBlackout,
  setBpm,
} from "./services/qlc";
import { sendArtNetValue } from "./services/artnet";

// Ensure data directory exists on startup
const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("📁 Created data directory:", DATA_DIR);
}

import {
  saveProject,
  getProjects,
  getProjectById,
  deleteProject,
  saveFixture,
  getFixtures,
  getFixtureById,
  deleteFixture,
  getAllSettings,
  setSetting,
  getPatch,
  getPatchById,
  addPatchFixture,
  updatePatchFixture,
  deletePatchFixture,
  getNextAddress,
} from "./services/database";
import { scanDmxManual } from "./services/ocr";

const app = express();
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
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur sauvegarde settings" });
  }
});

// ── REST API — Test LLM API Key ─────────────────────────────
app.post("/api/settings/test-key", async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: "provider et apiKey requis" });
    }

    const startTime = Date.now();
    let baseUrl = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    let body: any = {};

    // Configure provider-specific settings
    switch (provider) {
      case "openai":
        baseUrl = "https://api.openai.com/v1/chat/completions";
        body = { model: model || "gpt-4o-mini", messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        break;
      case "anthropic":
        baseUrl = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        delete headers["Authorization"];
        body = { model: model || "claude-sonnet-4-20250514", messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        break;
      case "gemini":
        baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: "Say 'OK'" }] }] };
        break;
      case "deepseek":
        baseUrl = "https://api.deepseek.com/v1/chat/completions";
        body = { model: model || "deepseek-chat", messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        break;
      case "openrouter":
        baseUrl = "https://openrouter.ai/api/v1/chat/completions";
        body = { model: model || "openai/gpt-4o-mini", messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        break;
      case "nvidia_nim":
        baseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
        body = { model: model || "nvidia/llama-3.3-nemotron-super-49b-v1", messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        break;
      case "opencode_go":
        // OpenCode Go - Two endpoints based on model type
        // OpenAI-compatible: kimi, glm, deepseek, mimo
        // Anthropic-compatible: minimax, qwen
        const openaiCompatibleModels = ["kimi-k2.5", "kimi-k2.6", "glm-5", "glm-5.1", "deepseek-v4-pro", "deepseek-v4-flash", "mimo-v2.5", "mimo-v2.5-pro"];
        const selectedModel = model || "kimi-k2.6";
        
        if (openaiCompatibleModels.includes(selectedModel)) {
          // OpenAI-compatible endpoint
          baseUrl = "https://opencode.ai/zen/go/v1/chat/completions";
          body = { model: selectedModel, messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        } else {
          // Anthropic-compatible endpoint (minimax, qwen)
          baseUrl = "https://opencode.ai/zen/go/v1/messages";
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
          delete headers["Authorization"];
          body = { model: selectedModel, messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 };
        }
        break;
      default:
        return res.status(400).json({ error: `Fournisseur inconnu: ${provider}` });
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        latency,
      });
    }

    const data = await response.json();
    res.json({ success: true, latency, model: data.model || model });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ── REST API — Chat Assistant ──────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Get LLM settings from database
    const settings = getAllSettings();
    
    // Find first configured provider
    const providers = ["opencode_go", "openrouter", "nvidia_nim", "openai", "anthropic", "gemini", "deepseek"];
    let selectedProvider = null;
    let apiKey = null;
    let model = null;

    for (const provider of providers) {
      const key = settings[`${provider}_key`];
      if (key) {
        selectedProvider = provider;
        apiKey = key;
        model = settings[`${provider}_model`];
        break;
      }
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: "Aucune clé API configurée. Va dans /settings → IA & LLM pour en ajouter une." 
      });
    }

    // Configure provider
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    let baseUrl = "";
    let body: any = {};

    const defaultModels: Record<string, string> = {
      opencode_go: "kimi-k2.6",
      openrouter: "openai/gpt-4o-mini",
      nvidia_nim: "nvidia/llama-3.3-nemotron-super-49b-v1",
      openai: "gpt-4o-mini",
      anthropic: "claude-sonnet-4-20250514",
      gemini: "gemini-1.5-flash",
      deepseek: "deepseek-chat",
    };

    const selectedModel = model || defaultModels[selectedProvider || ""] || "gpt-4o-mini";

    switch (selectedProvider) {
      case "opencode_go": {
        const openaiModels = ["kimi-k2.6", "kimi-k2.5", "glm-5.1", "glm-5", "deepseek-v4-pro", "deepseek-v4-flash", "mimo-v2.5", "mimo-v2.5-pro"];
        if (openaiModels.includes(selectedModel)) {
          baseUrl = "https://opencode.ai/zen/go/v1/chat/completions";
          body = { model: selectedModel, messages, max_tokens: 1000, temperature: 0.7 };
        } else {
          baseUrl = "https://opencode.ai/zen/go/v1/messages";
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
          delete headers["Authorization"];
          body = { model: selectedModel, messages, max_tokens: 1000 };
        }
        break;
      }
      case "openrouter":
        baseUrl = "https://openrouter.ai/api/v1/chat/completions";
        body = { model: selectedModel, messages, max_tokens: 1000, temperature: 0.7 };
        break;
      case "nvidia_nim":
        baseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
        body = { model: selectedModel, messages, max_tokens: 1000, temperature: 0.7 };
        break;
      case "openai":
        baseUrl = "https://api.openai.com/v1/chat/completions";
        body = { model: selectedModel, messages, max_tokens: 1000, temperature: 0.7 };
        break;
      case "anthropic":
        baseUrl = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        delete headers["Authorization"];
        body = { model: selectedModel, messages, max_tokens: 1000 };
        break;
      case "gemini":
        baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: messages[messages.length - 1]?.content || "" }] }] };
        break;
      case "deepseek":
        baseUrl = "https://api.deepseek.com/v1/chat/completions";
        body = { model: selectedModel, messages, max_tokens: 1000, temperature: 0.7 };
        break;
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `LLM error: ${response.status}` });
    }

    const data = await response.json();
    
    // Extract response based on provider
    let assistantResponse = "";
    if (selectedProvider === "anthropic") {
      assistantResponse = data.content?.[0]?.text || "";
    } else {
      assistantResponse = data.choices?.[0]?.message?.content || "";
    }

    res.json({ response: assistantResponse });
  } catch (error) {
    console.error("[Chat] Error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── REST API — Projet Management ──────────────────────────────
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

app.get("/api/projects/:id", (req, res) => {
  try {
    const project = getProjectById(parseInt(req.params.id));
    if (project) res.json(project);
    else res.status(404).json({ error: "Projet non trouvé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement du projet" });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: "Nom et données obligatoires" });
    }
    const id = saveProject(name, data);
    res.json({ id, success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la sauvegarde du projet" });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  try {
    deleteProject(parseInt(req.params.id));
    res.json({ success: true });
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
    const { id, name, manufacturer, channels, notes } = req.body;
    if (!name || !Array.isArray(channels)) {
      return res.status(400).json({ error: "Nom et channels obligatoires" });
    }
    const savedId = saveFixture(name, channels, manufacturer, notes, id);
    res.json({ id: savedId, success: true });
  } catch (error) {
    console.error("[Fixtures] save error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la sauvegarde de la fixture" });
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

// OCR scan : upload d'une photo du manuel DMX
app.post("/api/fixtures/scan", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Aucune image fournie (champ "image")' });
    }
    console.log(
      `🔍 [OCR] Scan d'une image (${(req.file.size / 1024).toFixed(1)} Ko)...`,
    );
    
    // Step 1: OCR extraction
    const ocrResult = await scanDmxManual(req.file.buffer);
    console.log(
      `📝 [OCR] ${ocrResult.totalChannels} channels extraits (confiance OCR: ${ocrResult.confidence.toFixed(1)}%)`,
    );
    
    // Step 2: LLM analysis to improve results
    let finalResult = ocrResult;
    try {
      const { analyzeFixtureWithLlm } = await import("./services/llm-fixture");
      finalResult = await analyzeFixtureWithLlm(
        ocrResult.rawText,
        ocrResult.channels,
        ocrResult.confidence
      );
      console.log(
        `🤖 [LLM] Analyse terminée - ${finalResult.totalChannels} channels (confiance finale: ${finalResult.confidence.toFixed(1)}%)`,
      );
    } catch (llmError) {
      console.warn("[LLM] Analyse indisponible, utilisation des résultats OCR:", llmError);
    }
    
    res.json(finalResult);
  } catch (error) {
    console.error("[OCR] error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors du scan OCR", detail: String(error) });
  }
});

// ── REST API — AI Fixture Suggestions ─────────────────────────
app.post("/api/ai/suggest-fixture", async (req, res) => {
  try {
    const { name, currentProfile } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name requis" });
    }
    
    const { suggestFixtureFromName } = await import("./services/llm-fixture");
    const result = await suggestFixtureFromName(name, currentProfile);
    res.json(result);
  } catch (error) {
    console.error("[AI] suggest-fixture error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/ai/match-library", async (req, res) => {
  try {
    const { name, channels } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name requis" });
    }
    
    const { matchWithLibrary } = await import("./services/llm-fixture");
    const result = await matchWithLibrary(name, channels || []);
    res.json({ match: result });
  } catch (error) {
    console.error("[AI] match-library error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/ai/suggest-settings", async (req, res) => {
  try {
    const { fixtureType } = req.body;
    if (!fixtureType) {
      return res.status(400).json({ error: "fixtureType requis" });
    }
    
    const patch = getPatch();
    const { suggestFixtureSettings } = await import("./services/llm-fixture");
    const result = await suggestFixtureSettings(fixtureType, patch);
    res.json(result);
  } catch (error) {
    console.error("[AI] suggest-settings error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/ai/learn-correction", async (req, res) => {
  try {
    const { originalName, correctedType, correctedProfile } = req.body;
    if (!originalName || !correctedType) {
      return res.status(400).json({ error: "originalName et correctedType requis" });
    }
    
    const { learnFromCorrection } = await import("./services/llm-fixture");
    await learnFromCorrection(originalName, correctedType, correctedProfile || []);
    res.json({ success: true });
  } catch (error) {
    console.error("[AI] learn-correction error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/fixtures/scan-quality", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "image requise" });
    }
    
    const { checkImageQuality } = await import("./services/ocr.js");
    const result = await checkImageQuality(req.file.buffer);
    res.json(result);
  } catch (error) {
    console.error("[OCR] quality check error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ── REST API — Fixture Library (QLC+ / open source) ──────────
const LIBRARY_PATH = path.resolve(__dirname, "../data/fixtures_library.json");
let _fixtureLibrary: any[] | null = null;

function loadLibrary(): any[] {
  if (!_fixtureLibrary) {
    try {
      // Ensure the file exists
      if (!fs.existsSync(LIBRARY_PATH)) {
        fs.writeFileSync(LIBRARY_PATH, "[]", "utf-8");
        console.log("📁 Created empty fixtures library:", LIBRARY_PATH);
      }
      _fixtureLibrary = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf-8"));
    } catch {
      _fixtureLibrary = [];
    }
  }
  return _fixtureLibrary!;
}

app.get("/api/fixture-library/manufacturers", (_req, res) => {
  const lib = loadLibrary();
  const manufacturers = [...new Set(lib.map((f: any) => f.manufacturer).filter(Boolean))].sort();
  res.json(manufacturers);
});

app.get("/api/fixture-library/search", (req, res) => {
  const { q = "", manufacturer = "" } = req.query as Record<string, string>;
  const lib = loadLibrary();
  let results = lib;
  if (manufacturer) results = results.filter((f: any) => f.manufacturer === manufacturer);
  if (q) {
    const ql = q.toLowerCase();
    results = results.filter((f: any) =>
      (f.model || f.name || "").toLowerCase().includes(ql) ||
      (f.manufacturer || "").toLowerCase().includes(ql)
    );
  }
  res.json(results.slice(0, 200));
});

// ── REST API — Patch DMX ──────────────────────────────────────
app.get("/api/patch", (_req, res) => {
  try { res.json(getPatch()); }
  catch { res.status(500).json({ error: "Erreur lecture patch" }); }
});

app.get("/api/patch/next-address", (req, res) => {
  const universe = parseInt((req.query.universe as string) || "1");
  res.json({ address: getNextAddress(universe) });
});

app.get("/api/patch/:id", (req, res) => {
  const f = getPatchById(parseInt(req.params.id));
  if (f) res.json(f);
  else res.status(404).json({ error: "Fixture introuvable" });
});

app.post("/api/patch", (req, res) => {
  try {
    const id = addPatchFixture(req.body);
    res.json({ id, success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put("/api/patch/:id", (req, res) => {
  try {
    updatePatchFixture(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/patch/:id", (req, res) => {
  try {
    deletePatchFixture(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Localize a fixture — brief strobe so you can spot it physically
app.post("/api/patch/:id/localize", (req, res) => {
  const f = getPatchById(parseInt(req.params.id));
  if (!f) return res.status(404).json({ error: "Fixture introuvable" });
  let count = 0;
  const interval = setInterval(() => {
    const v = count % 2 === 0 ? 255 : 0;
    for (let ch = 0; ch < f.channel_count; ch++) {
      sendDmxValue(f.universe, f.start_address + ch, v);
      sendArtNetValue(f.universe, f.start_address + ch, v);
    }
    if (++count >= 8) clearInterval(interval);
  }, 200);
  res.json({ success: true });
});

// ── REST API — Serial ports (USB DMX) ────────────────────────
app.get("/api/serial-ports", async (_req, res) => {
  try {
    // Dynamic import to avoid crash if serialport not installed
    const { SerialPort } = await import("serialport").catch(() => ({ SerialPort: null }));
    if (!SerialPort) return res.json([]);
    const ports = await (SerialPort as any).list();
    res.json(ports.map((p: any) => ({
      path: p.path,
      manufacturer: p.manufacturer || null,
      vendorId: p.vendorId || null,
      productId: p.productId || null,
      friendlyName: p.friendlyName || p.path,
    })));
  } catch {
    res.json([]);
  }
});

// ── REST API — ACP Agents ────────────────────────────────────
// Agent states
app.get("/api/agents", (_req, res) => {
  try {
    // Return mock agent states for now
    const agents = [
      {
        id: "agent-audio-lighting",
        name: "Agent Audio/Lumière",
        description: "Analyse le spectre audio et génère des réponses d'éclairage",
        status: "idle",
        capabilities: ["audio-analysis", "frequency-to-color", "bpm-detection"],
      },
      {
        id: "agent-scenographer",
        name: "Agent Scénographe",
        description: "Génère des suggestions de scènes d'éclairage",
        status: "idle",
        capabilities: ["scene-generation", "mood-analysis", "context-aware"],
      },
      {
        id: "agent-diagnostics",
        name: "Agent Diagnostique",
        description: "Surveille et diagnostique les problèmes d'éclairage DMX",
        status: "idle",
        capabilities: ["dmx-monitoring", "fixture-detection", "issue-alerting"],
      },
      {
        id: "agent-learning",
        name: "Agent Apprentissage",
        description: "Apprend les préférences utilisateur et suggère des améliorations",
        status: "idle",
        capabilities: ["preference-learning", "pattern-detection", "personalized-suggestions"],
      },
    ];
    res.json(agents);
  } catch {
    res.status(500).json({ error: "Erreur lecture agents" });
  }
});

// Agent actions
app.post("/api/agents/:id/action", async (req, res) => {
  try {
    const { id } = req.params;
    const { action, payload } = req.body;
    
    // Mock agent action
    console.log(`[ACP] Agent ${id} action: ${action}`, payload);
    
    res.json({
      success: true,
      agentId: id,
      action,
      result: { message: `Action ${action} executed on ${id}` },
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Orchestrator
app.post("/api/orchestrator/orchestrate", async (req, res) => {
  try {
    const { context } = req.body;
    console.log("[ACP] Orchestration requested:", context);
    
    // Mock orchestration
    res.json({
      success: true,
      suggestion: {
        agentId: "orchestrator",
        confidence: 0.85,
        groups: {
          A: { intensity: 80, color: "#ff0000" },
          B: { intensity: 60, color: "#00ff00" },
          C: { intensity: 70, color: "#0000ff" },
          D: { intensity: 50, color: "#ffff00" },
        },
        reasoning: "Orchestration based on audio analysis",
      },
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Diagnostics
app.get("/api/diagnostics", async (_req, res) => {
  try {
    // Mock diagnostics report
    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: "healthy",
      fixtures: [],
      alerts: [],
      recommendations: ["All systems operating normally"],
    };
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: String(error) });
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

      // Output 1: QLC+ OSC Bridge
      sendDmxValue(universe, channel, value);

      // Output 2: Art-Net (direct or to bridge software)
      sendArtNetValue(universe, channel, value);

      // Sync aux autres clients connectés (tablettes, etc.)
      socket.broadcast.emit("dmx_sync", data);
    },
  );

  // ── SMART MODE: Dashboard ─────────────────────────────
  // Reçoit les valeurs des sliders de zones (Stage, Bar, etc.)
  socket.on(
    "smart:zone_intensity",
    (data: { zoneId: number; value: number }) => {
      // Convention : chaque zone mappe vers un slider QLC+ (page 1, widget par zoneId)
      setSlider(1, data.zoneId, data.value);
    },
  );

  // Reçoit les déclenchements de scènes via les pads du SmartDashboard
  socket.on(
    "smart:trigger_scene",
    (data: { pageId: number; widgetId: number; active: boolean }) => {
      triggerScene(data.pageId, data.widgetId, data.active);
    },
  );

  // Blackout d'urgence
  socket.on("smart:blackout", (data: { active: boolean }) => {
    setBlackout(data.active);
    // On notifie tous les clients du blackout
    io.emit("smart:blackout", data);
  });

  // Synchronisation BPM
  socket.on("smart:bpm", (data: { bpm: number }) => {
    setBpm(data.bpm);
    // On notifie tous les clients du nouveau BPM
    io.emit("smart:bpm", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client déconnecté :", socket.id);
  });
});

const PORT = 3005;
httpServer.listen(PORT, () => {
  console.log(`🚀 Glow Logic Engine running on http://localhost:${PORT}`);
  console.log(`🎛️  QLC+ OSC Bridge ready (UDP -> 127.0.0.1:7700)`);
});

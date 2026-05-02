import express from "express";
import multer from "multer";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  sendDmxValue,
  triggerScene,
  setSlider,
  setBlackout,
  setBpm,
} from "./services/qlc";
import { sendArtNetValue } from "./services/artnet";
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
import path from "path";
import fs from "fs";
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
    const result = await scanDmxManual(req.file.buffer);
    console.log(
      `✅ [OCR] ${result.totalChannels} channels extraits (confiance ${result.confidence.toFixed(1)}%)`,
    );
    res.json(result);
  } catch (error) {
    console.error("[OCR] error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors du scan OCR", detail: String(error) });
  }
});

// ── REST API — Fixture Library (QLC+ / open source) ──────────
const LIBRARY_PATH = path.resolve(__dirname, "../data/fixtures_library.json");
let _fixtureLibrary: any[] | null = null;

function loadLibrary(): any[] {
  if (!_fixtureLibrary) {
    try {
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

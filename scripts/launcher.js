#!/usr/bin/env node

/**
 * Glow Logic - Cross-Platform Launcher
 *
 * Démarre le serveur API (port 3005) et l'interface web (port 3000)
 * en parallèle. Gère SIGINT/SIGTERM pour un arrêt propre.
 * Fonctionne sur Windows, macOS, Linux.
 *
 * Usage : node scripts/launcher.js
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// ─── Config ───────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const WEB_PORT = 3000;
const API_PORT = 3005;
const HEALTH_TIMEOUT = 60; // secondes max par service
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, `glow-logic-${new Date().toISOString().slice(0, 10)}.log`);

// ANSI couleurs (pur, pas de dépendance externe)
const C = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  clear: "\x1b[2J\x1b[H",
};

// ─── Logger ────────────────────────────────────────────────────
function log(level, msg, color = C.dim) {
  const ts = new Date().toLocaleTimeString("fr-FR", { hour12: false });
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(`${color}${line}${C.reset}`);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch { /* silent */ }
}

function info(msg) { log("INFO", msg, C.cyan); }
function ok(msg) { log("OK", msg, C.green); }
function warn(msg) { log("WARN", msg, C.yellow); }
function err(msg) { log("ERR", msg, C.red); }

// ─── Rotation logs ─────────────────────────────────────────────
function rotateLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const files = fs.readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("glow-logic-") && f.endsWith(".log"))
      .sort()
      .reverse();
    if (files.length > 7) {
      files.slice(7).forEach((f) => {
        fs.rmSync(path.join(LOG_DIR, f), { force: true });
        warn(`Rotation: suppression ${f}`);
      });
    }
  } catch { /* silent */ }
}

// ─── Banner ────────────────────────────────────────────────────
function showBanner() {
  console.log(`${C.clear}`);
  console.log(`${C.cyan}${C.bold}`);
  console.log("     ██████╗ ██╗      ██████╗ ██╗    ██╗");
  console.log("    ██╔════╝ ██║     ██╔═══██╗██║    ██║");
  console.log("    ██║  ███╗██║     ██║   ██║██║ █╗ ██║");
  console.log("    ██║   ██║██║     ██║   ██║██║███╗██║");
  console.log("    ╚██████╔╝███████╗╚██████╔╝╚███╔███╔╝");
  console.log("     ╚═════╝ ╚══════╝ ╚═════╝  ╚══╝╚══╝ ");
  console.log(`${C.reset}`);
  console.log(`  ${C.dim}Show Control System — No-Code${C.reset}`);
  console.log(`  ${C.dim}Logs → ${LOG_FILE}${C.reset}`);
  console.log("");
}

// ─── Health check ──────────────────────────────────────────────
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForPort(port, label) {
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT * 1000) {
    const alive = await checkPort(port);
    if (alive) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      ok(`${label} prêt (port ${port}, ${elapsed}s)`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  warn(`${label} pas démarré en ${HEALTH_TIMEOUT}s`);
  return false;
}

// ─── Spawn helper ──────────────────────────────────────────────
let children = [];

function spawnService(name, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });

  children.push(child);

  child.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line.includes("error") || line.includes("Error") || line.includes("ERR!")) {
        err(`[${name}] ${line.trim()}`);
      } else if (line.includes("ready") || line.includes("started") || line.includes("Listening")) {
        ok(`[${name}] ${line.trim()}`);
      } else {
        log(name.toUpperCase(), line.trim(), C.dim);
      }
    }
  });

  child.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) err(`[${name}] ${text}`);
  });

  child.on("close", (code) => {
    if (code !== 0 && code !== null) {
      warn(`[${name}] terminé (code ${code}) — redémarrage...`);
    }
  });

  return child;
}

// ─── Cleanup ───────────────────────────────────────────────────
function cleanup() {
  console.log(`\n${C.yellow}  Arrêt des services...${C.reset}`);
  let killed = 0;
  for (const child of children) {
    if (child && !child.killed) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
      killed++;
    }
  }
  children = [];
  ok(`${killed} processus arrêtés.`);
  process.exit(0);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  showBanner();
  rotateLogs();

  // 1. Check node
  info("Vérification des prérequis...");
  const nodeVer = process.version;
  info(`Node.js ${nodeVer}`);

  // 2. Check node_modules
  const modDirs = [
    path.join(ROOT, "node_modules"),
    path.join(ROOT, "apps", "server", "node_modules"),
    path.join(ROOT, "apps", "web", "node_modules"),
  ];
  const missing = modDirs.filter((d) => !fs.existsSync(d));
  if (missing.length > 0) {
    warn("node_modules manquants — exécution de npm install...");
    await new Promise((resolve, reject) => {
      const npmInstall = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["install"],
        { cwd: ROOT, stdio: "inherit", shell: true }
      );
      npmInstall.on("close", (code) => {
        if (code === 0) { ok("npm install terminé"); resolve(); }
        else { reject(new Error(`npm install failed (code ${code})`)); }
      });
    });
  } else {
    ok("Dépendances présentes");
  }

  // 3. Lancement
  info("Démarrage des services...");
  console.log("");

  const serverDir = path.join(ROOT, "apps", "server");
  const webDir = path.join(ROOT, "apps", "web");

  const serverProc = spawnService(
    "API",
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["ts-node", "index.ts"],
    serverDir
  );

  const webProc = spawnService(
    "WEB",
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev"],
    webDir
  );

  // 4. Health checks
  console.log(`\n${C.bold}  === Santé des services ===${C.reset}\n`);

  const [apiOk, webOk] = await Promise.all([
    waitForPort(API_PORT, "API Server"),
    waitForPort(WEB_PORT, "Web App"),
  ]);

  // 5. Résumé
  console.log(`\n${C.bold}${C.cyan}  ====================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}       GLOW LOGIC — EN LIGNE${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ====================================${C.reset}`);

  if (apiOk) console.log(`  ${C.green}  API     http://localhost:${API_PORT}${C.reset}`);
  else console.log(`  ${C.yellow}  API     http://localhost:${API_PORT}   [!]${C.reset}`);

  if (webOk) console.log(`  ${C.green}  Web     http://localhost:${WEB_PORT}${C.reset}`);
  else console.log(`  ${C.yellow}  Web     http://localhost:${WEB_PORT}    [!]${C.reset}`);

  console.log(`  ${C.dim}  ------------------------------------${C.reset}`);
  console.log(`  ${C.dim}  Stop    Ctrl+C${C.reset}`);
  console.log(`  ${C.dim}  Logs    ${LOG_FILE}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ====================================${C.reset}\n`);

  // 6. Ouvrir navigateur
  if (webOk) {
    const url = "http://localhost:3000";
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", url], { stdio: "ignore" });
    } else if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore" });
    } else {
      spawn("xdg-open", [url], { stdio: "ignore" });
    }
    ok(`Navigateur ouvert → ${C.bold}${url}${C.reset}`);
  }
}

// ─── Signal handlers ───────────────────────────────────────────
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// Uncaught errors → cleanup
process.on("uncaughtException", (e) => {
  err(`Uncaught: ${e.message}`);
  cleanup();
});

main().catch((e) => {
  err(e.message);
  cleanup();
});

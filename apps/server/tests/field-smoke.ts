import assert from "node:assert/strict";
import type { Server } from "node:http";

const MANAGED_PORT = Number(process.env.GLOW_FIELD_PORT || (3500 + Math.floor(Math.random() * 300)));
const BASE_URL = process.env.GLOW_API_BASE || `http://127.0.0.1:${MANAGED_PORT}`;
const WEB_BASE_URL = process.env.GLOW_WEB_BASE || "";
const USE_EXTERNAL_SERVER = Boolean(process.env.GLOW_API_BASE);
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type ManagedServerProcess = Server;
type JsonRecord = Record<string, unknown>;
type CheckStatus = "pass" | "skip";

interface FieldCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

let AUTH_TOKEN = "";
const checks: FieldCheck[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asList(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function addCheck(name: string, status: CheckStatus, detail: string) {
  checks.push({ name, status, detail });
  const icon = status === "pass" ? "OK" : "SKIP";
  console.log(`[${icon}] ${name} - ${detail}`);
}

async function readBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }
  return response.text();
}

async function request(path: string, options: RequestInit = {}, okStatuses = [200]) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (AUTH_TOKEN && path !== "/api/auth/bootstrap" && path !== "/api/health") {
    headers.set("Authorization", `Bearer ${AUTH_TOKEN}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await readBody(response);
  assert.ok(
    okStatuses.includes(response.status),
    `${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body).slice(0, 300)}`,
  );
  return body;
}

async function binaryRequest(path: string, options: RequestInit = {}, okStatuses = [200]) {
  const headers = new Headers(options.headers);
  if (AUTH_TOKEN) headers.set("Authorization", `Bearer ${AUTH_TOKEN}`);
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = Buffer.from(await response.arrayBuffer());
  assert.ok(
    okStatuses.includes(response.status),
    `${options.method || "GET"} ${path} -> ${response.status}: ${body.toString("utf8").slice(0, 300)}`,
  );
  return { response, body };
}

async function isServerReady() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerReady()) {
    const bootstrap = asRecord(await request("/api/auth/bootstrap", { method: "POST" }));
    AUTH_TOKEN = String(bootstrap.token || "");
    assert.ok(AUTH_TOKEN, "Bootstrap token absent");
    addCheck("API locale", "pass", `${BASE_URL} deja disponible`);
    return null;
  }

  if (USE_EXTERNAL_SERVER) {
    throw new Error(`Serveur externe indisponible: ${BASE_URL}`);
  }

  process.env.NODE_ENV = "test";
  process.env.GLOW_SERVER_PORT = String(MANAGED_PORT);
  const { startServer } = await import("../index");
  const server = startServer(MANAGED_PORT);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerReady()) {
      const bootstrap = asRecord(await request("/api/auth/bootstrap", { method: "POST" }));
      AUTH_TOKEN = String(bootstrap.token || "");
      assert.ok(AUTH_TOKEN, "Bootstrap token absent");
      addCheck("API locale", "pass", `${BASE_URL} demarree pour smoke terrain`);
      return server;
    }
    await sleep(500);
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  throw new Error(`Serveur non pret: ${BASE_URL}`);
}

async function cleanup(child: ManagedServerProcess | null, ids: {
  library: number[];
  projects: number[];
  venues: number[];
}) {
  const headers = new Headers();
  if (AUTH_TOKEN) headers.set("Authorization", `Bearer ${AUTH_TOKEN}`);

  for (const id of ids.library) {
    await fetch(`${BASE_URL}/api/library/${id}`, { method: "DELETE", headers }).catch(() => undefined);
  }
  for (const id of ids.projects) {
    await fetch(`${BASE_URL}/api/projects/${id}`, { method: "DELETE", headers }).catch(() => undefined);
  }
  for (const id of ids.venues) {
    await fetch(`${BASE_URL}/api/venue-profiles/${id}`, { method: "DELETE", headers }).catch(() => undefined);
  }

  if (child) {
    await new Promise<void>((resolve) => child.close(() => resolve()));
  }
}

async function testAuthAndReadiness() {
  const health = asRecord(await request("/api/health"));
  assert.equal(health.ok, true);

  const unauthorized = await fetch(`${BASE_URL}/api/projects`);
  assert.equal(unauthorized.status, 401);

  const auth = asRecord(await request("/api/auth/token"));
  assert.equal(typeof auth.masked, "string");

  const license = asRecord(await request("/api/license"));
  assert.equal(license.offlineReady, true);

  const safety = asRecord(await request("/api/safety/status"));
  assert.equal(typeof safety.laserArmed, "boolean");
  assert.equal(typeof safety.pyroArmed, "boolean");
  assert.equal(typeof safety.operatorRole, "string");

  const sync = asRecord(await request("/api/sync/status"));
  assert.equal(typeof sync.bpm, "number");
  assert.equal(typeof sync.online, "boolean");

  addCheck(
    "Readiness API",
    "pass",
    `auth 401 OK, licence ${String(license.mode)}, safety ${String(safety.operatorRole)}, BPM ${String(sync.bpm)}`,
  );
}

async function testDmxStatus() {
  const router = asRecord(await request("/api/dmx/router"));
  const outputStatus = asRecord(await request("/api/dmx/output-status"));
  const outputs = asRecord(outputStatus.outputs);

  for (const id of ["qlcOsc", "qlcWs", "artNet", "usbDmx"]) {
    assert.equal(typeof router[id], "boolean", `router.${id} absent`);
    assert.equal(typeof asRecord(outputs[id]).state, "string", `outputStatus.${id}.state absent`);
  }

  addCheck("DMX status", "pass", `outputs=${Object.keys(outputs).join(", ")}`);
}

async function testLibraryAndVenue(ids: { library: number[]; venues: number[] }) {
  const libraryName = `Field Smoke Look ${RUN_ID}`;
  const savedLibrary = asRecord(await request("/api/library", {
    method: "POST",
    body: JSON.stringify({
      kind: "look_preset",
      scope: "user",
      name: libraryName,
      description: "Smoke terrain sans Playwright",
      tags: ["field-smoke"],
      data: { masterDimmer: 180, blackout: false },
    }),
  }));
  const libraryId = Number(savedLibrary.id);
  assert.ok(Number.isFinite(libraryId));
  ids.library.push(libraryId);

  const exportedLibrary = asRecord(await request("/api/library/export"));
  assert.ok(asList(exportedLibrary.items).some((item) => item.id === libraryId));

  const venueName = `Field Smoke Venue ${RUN_ID}`;
  const savedVenue = asRecord(await request("/api/venue-profiles", {
    method: "POST",
    body: JSON.stringify({
      name: venueName,
      data: {
        stage: { width: 12, depth: 8 },
        notes: "Smoke terrain",
      },
    }),
  }, [201]));
  const venueId = Number(savedVenue.id);
  assert.ok(Number.isFinite(venueId));
  ids.venues.push(venueId);

  const venues = asList(await request("/api/venue-profiles"));
  assert.ok(venues.some((venue) => venue.id === venueId));

  addCheck("Library + venue", "pass", `look #${libraryId}, venue #${venueId}`);
}

async function testProjectPackage(ids: { projects: number[] }) {
  const projectName = `Field Smoke Project ${RUN_ID}`;
  const saved = asRecord(await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      data: {
        version: 3,
        currentProjectName: projectName,
        masterDimmer: 200,
        blackout: false,
        dmxOutputs: { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false },
        smartPads: [
          { id: 1, name: "Ouverture", qlcPage: 1, qlcWidget: 1, commands: [{ universe: 1, channel: 1, value: 180 }] },
        ],
        clips: [{ id: "clip-field", name: "Ouverture", startMs: 0, durationMs: 8000, padId: 1 }],
        playlist: [{ id: "media-field", name: "Intro", fileType: "video", fileUrl: "C:/shows/intro.mp4" }],
      },
    }),
  }));
  assert.equal(saved.success, true);
  const projectId = Number(saved.id);
  assert.ok(Number.isFinite(projectId));
  ids.projects.push(projectId);

  const exported = await binaryRequest(`/api/projects/${projectId}/export`);
  assert.equal(exported.response.headers.get("content-type"), "application/vnd.glowlogic.project+zip");
  assert.equal(exported.body.subarray(0, 2).toString("utf8"), "PK");
  assert.ok(exported.body.includes(Buffer.from("manifest.json")));
  assert.ok(exported.body.includes(Buffer.from("project.json")));
  assert.ok(exported.body.includes(Buffer.from("database/snapshot.json")));

  const form = new FormData();
  form.append("project", new Blob([exported.body], { type: "application/vnd.glowlogic.project+zip" }), "field-smoke.glowproject");
  form.append("name", `${projectName} Imported`);
  form.append("mergeDatabase", "false");
  const imported = asRecord(await request("/api/projects/import", { method: "POST", body: form }));
  const importedInfo = asRecord(imported.imported);
  const importedProjectId = Number(importedInfo.projectId);
  assert.equal(imported.success, true);
  assert.ok(Number.isFinite(importedProjectId));
  ids.projects.push(importedProjectId);

  addCheck("Projet .glowproject", "pass", `export ${exported.body.length} octets, import #${importedProjectId}`);
}

async function testWebIfConfigured() {
  if (!WEB_BASE_URL) {
    addCheck("Frontend HTTP", "skip", "GLOW_WEB_BASE non defini");
    return;
  }

  const response = await fetch(WEB_BASE_URL);
  const body = await response.text();
  assert.ok(response.status >= 200 && response.status < 500, `Web status ${response.status}`);
  assert.ok(body.includes("<html") || body.includes("__next"), "HTML Next absent");
  addCheck("Frontend HTTP", "pass", `${WEB_BASE_URL} -> ${response.status}`);
}

async function main() {
  const child = await ensureServer();
  const ids = { library: [] as number[], projects: [] as number[], venues: [] as number[] };

  try {
    await testAuthAndReadiness();
    await testDmxStatus();
    await testLibraryAndVenue(ids);
    await testProjectPackage(ids);
    await testWebIfConfigured();

    const passed = checks.filter((check) => check.status === "pass").length;
    const skipped = checks.filter((check) => check.status === "skip").length;
    console.log(`Field smoke passed: ${passed} OK, ${skipped} skipped.`);
  } finally {
    await cleanup(child, ids);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

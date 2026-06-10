import assert from "node:assert/strict";
import type { Server } from "node:http";

const MANAGED_PORT = Number(process.env.GLOW_TEST_PORT || (3100 + Math.floor(Math.random() * 400)));
const BASE_URL = process.env.GLOW_API_BASE || `http://127.0.0.1:${MANAGED_PORT}`;
const USE_EXTERNAL_SERVER = Boolean(process.env.GLOW_API_BASE);
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
type ManagedServerProcess = Server;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path: string, options: RequestInit = {}, okStatuses = [200]) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const body = await readJson(response);
  assert.ok(
    okStatuses.includes(response.status),
    `${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function isServerReady() {
  try {
    const response = await fetch(`${BASE_URL}/api/safety`);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerReady()) return null;
  if (USE_EXTERNAL_SERVER) {
    throw new Error(`External server is not ready at ${BASE_URL}`);
  }

  process.env.NODE_ENV = "test";
  process.env.GLOW_SERVER_PORT = String(MANAGED_PORT);
  const { startServer } = await import("../index");
  const server = startServer(MANAGED_PORT);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerReady()) return server;
    await sleep(500);
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  throw new Error(`Server did not become ready at ${BASE_URL}`);
}

async function cleanup(child: ManagedServerProcess | null, fixtureIds: number[], libraryIds: number[]) {
  for (const id of fixtureIds) {
    await fetch(`${BASE_URL}/api/fixtures/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
  for (const id of libraryIds) {
    await fetch(`${BASE_URL}/api/library/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
  if (child) {
    await new Promise<void>((resolve) => child.close(() => resolve()));
  }
}

async function testFixtures(fixtureIds: number[], libraryIds: number[]) {
  const fixtureName = `API Smoke Fixture ${RUN_ID}`;
  const saved = await request("/api/fixtures", {
    method: "POST",
    body: JSON.stringify({
      name: fixtureName,
      manufacturer: "Glow Logic Test",
      startAddress: 1,
      channels: [{ channel: 1, name: "Dimmer", type: "dimmer", min: 0, max: 255 }],
      modes: [{ name: "1ch", channels: [{ channel: 1, name: "Dimmer", type: "dimmer", min: 0, max: 255 }] }],
    }),
  });
  assert.equal(saved.success, true);
  assert.equal(typeof saved.id, "number");
  fixtureIds.push(saved.id);

  const loaded = await request(`/api/fixtures/${saved.id}`);
  assert.equal(loaded.name, fixtureName);
  assert.equal(loaded.channels[0].type, "dimmer");

  const fixtureList = await request("/api/fixtures");
  assert.ok(Array.isArray(fixtureList));
  assert.ok(fixtureList.some((fixture: any) => fixture.id === saved.id));

  const profileModel = `API Smoke Profile ${RUN_ID}`;
  const qxf = `<?xml version="1.0" encoding="UTF-8"?>
<FixtureDefinition>
  <Manufacturer>Glow Logic Test</Manufacturer>
  <Model>${profileModel}</Model>
  <Type>Moving Head</Type>
  <Channel Name="Pan"><Group Byte="0">Pan</Group><Capability Min="0" Max="255">Pan</Capability></Channel>
  <Channel Name="Dimmer"><Group Byte="0">Intensity</Group><Capability Min="0" Max="255">Dimmer</Capability></Channel>
  <Mode Name="Basic"><Channel Number="0">Pan</Channel><Channel Number="1">Dimmer</Channel></Mode>
</FixtureDefinition>`;
  const form = new FormData();
  form.append("profile", new Blob([qxf], { type: "application/xml" }), "api-smoke.qxf");
  const imported = await request("/api/fixtures/import-profile", { method: "POST", body: form });
  assert.equal(imported.success, true);
  assert.equal(imported.profile.model, profileModel);
  fixtureIds.push(imported.id);

  const libraryProfiles = await request("/api/library?kind=fixture_profile&scope=user");
  const importedProfileItem = libraryProfiles.find((item: any) => item.name === `Glow Logic Test ${profileModel}`);
  if (importedProfileItem?.id) libraryIds.push(importedProfileItem.id);
}

async function testLibrary(libraryIds: number[]) {
  const name = `API Smoke Look ${RUN_ID}`;
  const saved = await request("/api/library", {
    method: "POST",
    body: JSON.stringify({
      kind: "look_preset",
      scope: "user",
      name,
      description: "API smoke test item",
      tags: ["api-smoke"],
      data: { levels: { master: 128 } },
    }),
  });
  assert.equal(saved.name, name);
  assert.equal(saved.kind, "look_preset");
  libraryIds.push(saved.id);

  const list = await request("/api/library?kind=look_preset&scope=user");
  assert.ok(list.some((item: any) => item.id === saved.id));

  const exported = await request("/api/library/export");
  assert.ok(Array.isArray(exported.items));
  assert.ok(exported.items.some((item: any) => item.id === saved.id));
}

async function testSafety() {
  const state = await request("/api/safety");
  assert.ok(Array.isArray(state.rules));

  const standard = await request("/api/safety/validate", {
    method: "POST",
    body: JSON.stringify({ source: "api", description: "standard api smoke" }),
  });
  assert.equal(standard.allowed, true);

  const blockedLaser = await request("/api/safety/validate", {
    method: "POST",
    body: JSON.stringify({
      source: "api",
      hazard: "laser",
      outputMode: "physical",
      payload: { power: 255 },
    }),
  });
  assert.equal(blockedLaser.allowed, false);
  assert.equal(blockedLaser.requiresManualArm, true);
}

async function testShowActions() {
  const validationAction = await request("/api/show-actions", {
    method: "POST",
    body: JSON.stringify({
      type: "safety.validate",
      source: "api",
      outputMode: "simulation",
      payload: { note: "api smoke" },
    }),
  });
  assert.equal(validationAction.ok, true);
  assert.equal(validationAction.results[0].type, "safety.validate");

  const blockedDangerousAction = await request("/api/show-actions", {
    method: "POST",
    body: JSON.stringify({
      type: "laser.fire",
      source: "api",
      hazard: "laser",
      outputMode: "physical",
      payload: { power: 255 },
    }),
  }, [207]);
  assert.equal(blockedDangerousAction.ok, false);
  assert.equal(blockedDangerousAction.results[0].blocked, true);
}

async function main() {
  const child = await ensureServer();
  const fixtureIds: number[] = [];
  const libraryIds: number[] = [];

  try {
    await testFixtures(fixtureIds, libraryIds);
    await testLibrary(libraryIds);
    await testSafety();
    await testShowActions();
    console.log("API smoke tests passed: fixtures, library, safety, show-actions.");
  } finally {
    await cleanup(child, fixtureIds, libraryIds);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

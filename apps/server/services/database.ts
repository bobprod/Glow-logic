import Database from "better-sqlite3";
import path from "path";

// Local database file path
const dbPath = path.resolve(__dirname, "../../glow_logic.db");
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    channels TEXT NOT NULL,
    total_channels INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS patch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fixture_type TEXT NOT NULL DEFAULT 'PAR LED',
    manufacturer TEXT,
    model TEXT,
    universe INTEGER NOT NULL DEFAULT 1,
    start_address INTEGER NOT NULL DEFAULT 1,
    channel_count INTEGER NOT NULL DEFAULT 1,
    profile TEXT NOT NULL DEFAULT '[]',
    mode_name TEXT,
    grp TEXT NOT NULL DEFAULT 'A',
    height_3d REAL NOT NULL DEFAULT 3.0,
    rotation_3d REAL NOT NULL DEFAULT 0.0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface ProjectListing {
  id: number;
  name: string;
  updated_at: string;
}

export const saveProject = (name: string, data: any) => {
  const jsonData = JSON.stringify(data);
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO projects (id, name, data, updated_at) VALUES ((SELECT id FROM projects WHERE name = ?), ?, ?, CURRENT_TIMESTAMP)",
  );
  const result = stmt.run(name, name, jsonData);
  return result.lastInsertRowid;
};

export const getProjects = (): ProjectListing[] => {
  const stmt = db.prepare(
    "SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC",
  );
  return stmt.all() as ProjectListing[];
};

export const getProjectById = (id: number) => {
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
  const project = stmt.get(id) as any;
  if (project) {
    project.data = JSON.parse(project.data);
  }
  return project;
};

export const deleteProject = (id: number) => {
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  return stmt.run(id);
};

// ─── Fixtures ──────────────────────────────────────────────────────────

export interface FixtureRecord {
  id: number;
  name: string;
  manufacturer: string | null;
  channels: any[];
  total_channels: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixtureListing {
  id: number;
  name: string;
  manufacturer: string | null;
  total_channels: number;
  updated_at: string;
}

export const saveFixture = (
  name: string,
  channels: any[],
  manufacturer?: string,
  notes?: string,
  id?: number,
): number => {
  const jsonChannels = JSON.stringify(channels);
  const total = channels.length;
  if (id) {
    const stmt = db.prepare(
      "UPDATE fixtures SET name=?, manufacturer=?, channels=?, total_channels=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    );
    stmt.run(
      name,
      manufacturer ?? null,
      jsonChannels,
      total,
      notes ?? null,
      id,
    );
    return id;
  }
  const stmt = db.prepare(
    "INSERT INTO fixtures (name, manufacturer, channels, total_channels, notes) VALUES (?, ?, ?, ?, ?)",
  );
  const result = stmt.run(
    name,
    manufacturer ?? null,
    jsonChannels,
    total,
    notes ?? null,
  );
  return Number(result.lastInsertRowid);
};

export const getFixtures = (): FixtureListing[] => {
  const stmt = db.prepare(
    "SELECT id, name, manufacturer, total_channels, updated_at FROM fixtures ORDER BY updated_at DESC",
  );
  return stmt.all() as FixtureListing[];
};

export const getFixtureById = (id: number): FixtureRecord | null => {
  const stmt = db.prepare("SELECT * FROM fixtures WHERE id = ?");
  const row = stmt.get(id) as any;
  if (!row) return null;
  row.channels = JSON.parse(row.channels);
  return row as FixtureRecord;
};

export const deleteFixture = (id: number) => {
  const stmt = db.prepare("DELETE FROM fixtures WHERE id = ?");
  return stmt.run(id);
};

// ─── App Settings (LLM keys, preferences) ────────────────────

export const getSetting = (key: string): string | null => {
  const stmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : null;
};

export const setSetting = (key: string, value: string): void => {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
  );
  stmt.run(key, value);
};

export const getAllSettings = (): Record<string, string> => {
  const stmt = db.prepare("SELECT key, value FROM app_settings");
  const rows = stmt.all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};

// ─── Patch DMX ─────────────────────────────────────────────────

export interface PatchedFixture {
  id: number;
  name: string;
  fixture_type: string;
  manufacturer: string | null;
  model: string | null;
  universe: number;
  start_address: number;
  channel_count: number;
  profile: string[];
  mode_name: string | null;
  grp: string;
  height_3d: number;
  rotation_3d: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const getPatch = (): PatchedFixture[] => {
  const rows = db.prepare("SELECT * FROM patch ORDER BY universe, start_address").all() as any[];
  return rows.map((r) => ({ ...r, profile: JSON.parse(r.profile) }));
};

export const getPatchById = (id: number): PatchedFixture | null => {
  const row = db.prepare("SELECT * FROM patch WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, profile: JSON.parse(row.profile) };
};

export const addPatchFixture = (f: Omit<PatchedFixture, "id" | "created_at" | "updated_at">): number => {
  const stmt = db.prepare(`
    INSERT INTO patch (name, fixture_type, manufacturer, model, universe, start_address,
      channel_count, profile, mode_name, grp, height_3d, rotation_3d, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    f.name, f.fixture_type, f.manufacturer ?? null, f.model ?? null,
    f.universe, f.start_address, f.channel_count, JSON.stringify(f.profile),
    f.mode_name ?? null, f.grp, f.height_3d, f.rotation_3d, f.sort_order,
  );
  return Number(res.lastInsertRowid);
};

export const updatePatchFixture = (id: number, f: Partial<Omit<PatchedFixture, "id" | "created_at" | "updated_at">>): void => {
  const fields: string[] = [];
  const vals: any[] = [];
  const map: Record<string, any> = { ...f };
  if ("profile" in map) map.profile = JSON.stringify(map.profile);
  for (const [k, v] of Object.entries(map)) {
    fields.push(`${k} = ?`);
    vals.push(v);
  }
  fields.push("updated_at = CURRENT_TIMESTAMP");
  vals.push(id);
  db.prepare(`UPDATE patch SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
};

export const deletePatchFixture = (id: number): void => {
  db.prepare("DELETE FROM patch WHERE id = ?").run(id);
};

export const getNextAddress = (universe: number): number => {
  const row = db.prepare(
    "SELECT MAX(start_address + channel_count - 1) as last FROM patch WHERE universe = ?"
  ).get(universe) as { last: number | null };
  return (row.last ?? 0) + 1;
};

export default db;

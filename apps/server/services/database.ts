import Database from "better-sqlite3";
import path from "path";

// Local database file path
const dbPath = path.resolve(__dirname, "../../glow_logic.db");
const db = new Database(dbPath);
export const getDatabasePath = () => dbPath;

// Performance + safety pragmas — must be set before any DDL
db.pragma("journal_mode = WAL");   // crash-safe, concurrent reads don't block writes
db.pragma("synchronous = NORMAL"); // safe with WAL, faster than FULL
db.pragma("foreign_keys = ON");    // enforce FK constraints
db.pragma("busy_timeout = 5000");  // wait up to 5s instead of failing on SQLITE_BUSY

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
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    channels TEXT NOT NULL,
    total_channels INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    start_address INTEGER NOT NULL DEFAULT 1,
    grid_position TEXT,
    modes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#06b6d4',
    "values" TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cue_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS fixture_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT,
    color TEXT NOT NULL DEFAULT '#06b6d4',
    fixture_ids TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS venue_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS library_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'user',
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kind, scope, name)
  );
`);

// Migrations pour les tables existantes (ALTER TABLE ignore les colonnes deja presentes)
for (const sql of [
  `ALTER TABLE projects ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE projects ADD COLUMN created_at DATETIME`,
  `UPDATE projects SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique ON projects(name)`,
  `ALTER TABLE fixtures ADD COLUMN start_address INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE fixtures ADD COLUMN grid_position TEXT`,
  `ALTER TABLE fixtures ADD COLUMN modes TEXT`,
]) {
  try { db.exec(sql); } catch { /* colonne deja presente */ }
}

export interface ProjectListing {
  id: number;
  name: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectStorageHealth {
  ok: boolean;
  schemaVersion: number;
  projectCount: number;
  invalidJsonCount: number;
  duplicateNameCount: number;
  latestUpdatedAt: string | null;
  oldestCreatedAt: string | null;
  issues: string[];
}

export interface ProjectStorageRepairReport {
  ok: boolean;
  dryRun: boolean;
  scanned: number;
  normalized: number;
  invalidJson: number;
  duplicateNameCount: number;
  actions: string[];
  warnings: string[];
  health: ProjectStorageHealth;
}

function normalizeProjectName(name: string): string {
  return String(name || "").trim().slice(0, 120);
}

function normalizeProjectData(data: any) {
  const source = data && typeof data === "object" ? data : {};
  const version = Number(source.version || source.schemaVersion || 1);
  return {
    ...source,
    version: Number.isFinite(version) ? Math.max(1, version) : 1,
    nodes: Array.isArray(source.nodes) ? source.nodes : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
    smartPads: Array.isArray(source.smartPads) ? source.smartPads : [],
    clips: Array.isArray(source.clips) ? source.clips : [],
    markers: Array.isArray(source.markers) ? source.markers : [],
    playlist: Array.isArray(source.playlist) ? source.playlist : [],
    fixtureGroups: Array.isArray(source.fixtureGroups) ? source.fixtureGroups : [],
  };
}

export const saveProject = (name: string, data: any) => {
  const cleanName = normalizeProjectName(name);
  if (!cleanName) throw new Error("invalid_project_name");
  const normalizedData = normalizeProjectData(data);
  const schemaVersion = Number(normalizedData.version || 1);
  const jsonData = JSON.stringify(normalizedData);
  return db.transaction(() => {
    const existing = db.prepare("SELECT id FROM projects WHERE name = ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(cleanName) as { id: number } | undefined;
    if (existing) {
      db.prepare(
        "UPDATE projects SET data = ?, schema_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(jsonData, schemaVersion, existing.id);
      return existing.id;
    }
    const result = db.prepare(
      "INSERT INTO projects (name, data, schema_version, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    ).run(cleanName, jsonData, schemaVersion);
    return Number(result.lastInsertRowid);
  })();
};

export const getProjects = (): ProjectListing[] => {
  const stmt = db.prepare(
    "SELECT id, name, schema_version, COALESCE(created_at, updated_at) AS created_at, updated_at FROM projects ORDER BY updated_at DESC",
  );
  return stmt.all() as ProjectListing[];
};

export const getProjectById = (id: number) => {
  if (!Number.isFinite(id)) return null;
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
  const project = stmt.get(id) as any;
  if (project) {
    try {
      project.data = normalizeProjectData(JSON.parse(project.data));
      project.schema_version = Number(project.schema_version || project.data.version || 1);
    } catch {
      project.data = normalizeProjectData({});
      project.schema_version = 1;
    }
  }
  return project;
};

export const deleteProject = (id: number) => {
  if (!Number.isFinite(id)) return { changes: 0 };
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  return stmt.run(id);
};

export const getProjectStorageHealth = (): ProjectStorageHealth => {
  const rows = db.prepare(
    "SELECT id, name, data, schema_version, COALESCE(created_at, updated_at) AS created_at, updated_at FROM projects",
  ).all() as any[];
  const duplicateRows = db.prepare(
    "SELECT name, COUNT(*) AS count FROM projects GROUP BY name HAVING COUNT(*) > 1",
  ).all() as Array<{ name: string; count: number }>;
  let invalidJsonCount = 0;
  let maxSchemaVersion = 1;

  rows.forEach((row) => {
    maxSchemaVersion = Math.max(maxSchemaVersion, Number(row.schema_version || 1));
    try {
      normalizeProjectData(JSON.parse(row.data));
    } catch {
      invalidJsonCount += 1;
    }
  });

  const latestUpdatedAt = rows
    .map((row) => row.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const oldestCreatedAt = rows
    .map((row) => row.created_at || row.updated_at)
    .filter(Boolean)
    .sort()[0] || null;
  const duplicateNameCount = duplicateRows.reduce((sum, row) => sum + Math.max(0, Number(row.count) - 1), 0);
  const issues = [
    invalidJsonCount > 0 ? `${invalidJsonCount} projet(s) avec JSON invalide` : null,
    duplicateNameCount > 0 ? `${duplicateNameCount} doublon(s) de nom projet` : null,
  ].filter(Boolean) as string[];

  return {
    ok: issues.length === 0,
    schemaVersion: maxSchemaVersion,
    projectCount: rows.length,
    invalidJsonCount,
    duplicateNameCount,
    latestUpdatedAt,
    oldestCreatedAt,
    issues,
  };
};

export const repairProjectStorage = (dryRun = false): ProjectStorageRepairReport => {
  const rows = db.prepare(
    "SELECT id, name, data, schema_version, created_at, updated_at FROM projects ORDER BY updated_at DESC, id DESC",
  ).all() as any[];
  const duplicateRows = db.prepare(
    "SELECT name, COUNT(*) AS count FROM projects GROUP BY name HAVING COUNT(*) > 1",
  ).all() as Array<{ name: string; count: number }>;
  const updateStmt = db.prepare(
    "UPDATE projects SET data = ?, schema_version = ?, created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  );
  const actions: string[] = [];
  const warnings: string[] = [];
  let normalized = 0;
  let invalidJson = 0;

  const runRepair = db.transaction(() => {
    rows.forEach((row) => {
      try {
        const parsed = JSON.parse(row.data);
        const normalizedData = normalizeProjectData(parsed);
        const nextVersion = Number(normalizedData.version || 1);
        const nextJson = JSON.stringify(normalizedData);
        const changed =
          nextJson !== row.data ||
          Number(row.schema_version || 1) !== nextVersion ||
          !row.created_at;

        if (changed) {
          normalized += 1;
          actions.push(`Projet "${row.name}" normalise (id ${row.id}, schema v${nextVersion}).`);
          if (!dryRun) updateStmt.run(nextJson, nextVersion, row.id);
        }
      } catch {
        invalidJson += 1;
        warnings.push(`Projet "${row.name}" ignore: JSON invalide (id ${row.id}).`);
      }
    });
  });

  runRepair();

  const duplicateNameCount = duplicateRows.reduce((sum, row) => sum + Math.max(0, Number(row.count) - 1), 0);
  duplicateRows.forEach((row) => {
    warnings.push(`Doublon detecte pour "${row.name}" (${row.count} entrees). Aucune suppression automatique.`);
  });

  return {
    ok: invalidJson === 0,
    dryRun,
    scanned: rows.length,
    normalized,
    invalidJson,
    duplicateNameCount,
    actions,
    warnings,
    health: getProjectStorageHealth(),
  };
};

// ─── Fixtures ──────────────────────────────────────────────────────────

export interface DmxChannelRecord {
  channel: number;
  function: string;
  type: string;
  minValue?: number;
  maxValue?: number;
  notes?: string;
}

export interface FixtureMode {
  name: string;
  channels: DmxChannelRecord[];
}

export interface FixtureRecord {
  id: number;
  name: string;
  manufacturer: string | null;
  channels: DmxChannelRecord[];
  total_channels: number;
  notes: string | null;
  start_address: number;
  gridPosition: { x: number; y: number; z: number } | null;
  modes: FixtureMode[] | null;
  created_at: string;
  updated_at: string;
}

export interface FixtureListing {
  id: number;
  name: string;
  manufacturer: string | null;
  channels: DmxChannelRecord[];
  total_channels: number;
  start_address: number;
  gridPosition: { x: number; y: number; z: number } | null;
  updated_at: string;
}

function parseGridPosition(raw: unknown): { x: number; y: number; z: number } | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown; z?: unknown };
    const x = typeof parsed.x === "number" && Number.isFinite(parsed.x) ? parsed.x : 50;
    const y = typeof parsed.y === "number" && Number.isFinite(parsed.y) ? parsed.y : 50;
    const z = typeof parsed.z === "number" && Number.isFinite(parsed.z) ? parsed.z : 0;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      z,
    };
  } catch {
    return null;
  }
}


export const saveFixture = (
  name: string,
  channels: any[],
  manufacturer?: string,
  notes?: string,
  id?: number,
  startAddress?: number,
  modes?: any[],
  gridPosition?: { x: number; y: number; z?: number } | null,
): number => {
  const jsonChannels = JSON.stringify(channels);
  const jsonModes    = modes ? JSON.stringify(modes) : null;
  const jsonGrid     = gridPosition ? JSON.stringify(gridPosition) : null;
  const total        = channels.length;
  const addr         = startAddress ?? 1;

  if (id) {
    db.prepare(
      "UPDATE fixtures SET name=?, manufacturer=?, channels=?, total_channels=?, notes=?, start_address=?, modes=?, grid_position=COALESCE(?, grid_position), updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(name, manufacturer ?? null, jsonChannels, total, notes ?? null, addr, jsonModes, jsonGrid, id);
    return id;
  }
  const result = db.prepare(
    "INSERT INTO fixtures (name, manufacturer, channels, total_channels, notes, start_address, modes, grid_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(name, manufacturer ?? null, jsonChannels, total, notes ?? null, addr, jsonModes, jsonGrid);
  return Number(result.lastInsertRowid);
};

export const getFixtures = (): FixtureListing[] => {
  const rows = db.prepare(
    "SELECT id, name, manufacturer, channels, total_channels, start_address, grid_position, updated_at FROM fixtures ORDER BY updated_at DESC",
  ).all() as any[];
  return rows.map(r => {
    try {
      r.channels = JSON.parse(r.channels);
    } catch {
      r.channels = [];
    }
    r.gridPosition = parseGridPosition(r.grid_position);
    delete r.grid_position;
    return r;
  }) as FixtureListing[];
};

export const getFixtureById = (id: number): FixtureRecord | null => {
  const row = db.prepare("SELECT * FROM fixtures WHERE id = ?").get(id) as any;
  if (!row) return null;
  row.channels = JSON.parse(row.channels);
  row.modes    = row.modes ? JSON.parse(row.modes) : null;
  row.gridPosition = parseGridPosition(row.grid_position);
  delete row.grid_position;
  return row as FixtureRecord;
};

export const deleteFixture = (id: number) => {
  const stmt = db.prepare("DELETE FROM fixtures WHERE id = ?");
  return stmt.run(id);
};

// ─── Fixture Groups ───────────────────────────────────────────────

export interface FixtureGroupRow {
  id: number;
  name: string;
  role: string | null;
  color: string;
  fixtureIds: number[];
  created_at: string;
  updated_at: string;
}

function parseFixtureIds(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
  } catch {
    return [];
  }
}

function mapFixtureGroup(row: any): FixtureGroupRow {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    color: row.color,
    fixtureIds: parseFixtureIds(row.fixture_ids),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const saveFixtureGroup = (
  name: string,
  fixtureIds: number[],
  role?: string | null,
  color = "#06b6d4",
  id?: number,
): number => {
  const jsonFixtureIds = JSON.stringify(fixtureIds.map((fixtureId) => Number(fixtureId)));
  if (id) {
    db.prepare(
      "UPDATE fixture_groups SET name=?, role=?, color=?, fixture_ids=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(name, role ?? null, color, jsonFixtureIds, id);
    return id;
  }

  const result = db.prepare(
    "INSERT INTO fixture_groups (name, role, color, fixture_ids) VALUES (?, ?, ?, ?)",
  ).run(name, role ?? null, color, jsonFixtureIds);
  return Number(result.lastInsertRowid);
};

export const getFixtureGroups = (): FixtureGroupRow[] => {
  const rows = db.prepare("SELECT * FROM fixture_groups ORDER BY name ASC").all() as any[];
  return rows.map(mapFixtureGroup);
};

export const getFixtureGroupByName = (name: string): FixtureGroupRow | null => {
  const row = db.prepare("SELECT * FROM fixture_groups WHERE lower(name) = lower(?)").get(name) as any;
  return row ? mapFixtureGroup(row) : null;
};

export const getFixtureGroupById = (id: number): FixtureGroupRow | null => {
  const row = db.prepare("SELECT * FROM fixture_groups WHERE id = ?").get(id) as any;
  return row ? mapFixtureGroup(row) : null;
};

export const deleteFixtureGroup = (id: number) => {
  return db.prepare("DELETE FROM fixture_groups WHERE id = ?").run(id);
};

// ─── App Settings (LLM keys, preferences) ────────────────────

export interface VenueProfileRow {
  id: number;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

function mapVenueProfile(row: any): VenueProfileRow {
  let data: any = {};
  try { data = JSON.parse(row.data); } catch { data = {}; }
  return {
    id: row.id,
    name: row.name,
    data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const saveVenueProfile = (name: string, data: any, id?: number): number => {
  const jsonData = JSON.stringify(data || {});
  if (id) {
    db.prepare("UPDATE venue_profiles SET name=?, data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(name, jsonData, id);
    return id;
  }

  const existing = db.prepare("SELECT id FROM venue_profiles WHERE lower(name) = lower(?)").get(name) as any;
  if (existing?.id) {
    db.prepare("UPDATE venue_profiles SET name=?, data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(name, jsonData, existing.id);
    return Number(existing.id);
  }

  const result = db.prepare("INSERT INTO venue_profiles (name, data) VALUES (?, ?)")
    .run(name, jsonData);
  return Number(result.lastInsertRowid);
};

export const getVenueProfiles = (): VenueProfileRow[] => {
  const rows = db.prepare("SELECT * FROM venue_profiles ORDER BY updated_at DESC").all() as any[];
  return rows.map(mapVenueProfile);
};

export const getVenueProfileById = (id: number): VenueProfileRow | null => {
  const row = db.prepare("SELECT * FROM venue_profiles WHERE id = ?").get(id) as any;
  return row ? mapVenueProfile(row) : null;
};

export const deleteVenueProfile = (id: number) => {
  return db.prepare("DELETE FROM venue_profiles WHERE id = ?").run(id);
};

// --- Local Library ----------------------------------------------------------

export type LibraryItemKind = "fixture_profile" | "look_preset" | "show_template" | "venue_template";
export type LibraryItemScope = "system" | "user" | "community";

export interface LibraryItemRow {
  id: number;
  kind: LibraryItemKind;
  scope: LibraryItemScope;
  name: string;
  description: string | null;
  tags: string[];
  data: any;
  created_at: string;
  updated_at: string;
}

function parseJsonFallback(raw: string, fallback: any) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function mapLibraryItem(row: any): LibraryItemRow {
  return {
    id: row.id,
    kind: row.kind,
    scope: row.scope,
    name: row.name,
    description: row.description,
    tags: parseJsonFallback(row.tags, []),
    data: parseJsonFallback(row.data, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const saveLibraryItem = (
  kind: LibraryItemKind,
  scope: LibraryItemScope,
  name: string,
  data: any,
  description?: string | null,
  tags: string[] = [],
  id?: number,
): number => {
  const jsonTags = JSON.stringify(tags);
  const jsonData = JSON.stringify(data || {});

  if (id) {
    db.prepare(
      "UPDATE library_items SET kind=?, scope=?, name=?, description=?, tags=?, data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(kind, scope, name, description ?? null, jsonTags, jsonData, id);
    return id;
  }

  const existing = db.prepare(
    "SELECT id FROM library_items WHERE kind=? AND scope=? AND lower(name)=lower(?)",
  ).get(kind, scope, name) as any;

  if (existing?.id) {
    db.prepare(
      "UPDATE library_items SET description=?, tags=?, data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(description ?? null, jsonTags, jsonData, existing.id);
    return Number(existing.id);
  }

  const result = db.prepare(
    "INSERT INTO library_items (kind, scope, name, description, tags, data) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(kind, scope, name, description ?? null, jsonTags, jsonData);
  return Number(result.lastInsertRowid);
};

export const getLibraryItems = (kind?: string, scope?: string): LibraryItemRow[] => {
  const clauses: string[] = [];
  const params: string[] = [];
  if (kind) { clauses.push("kind = ?"); params.push(kind); }
  if (scope) { clauses.push("scope = ?"); params.push(scope); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM library_items ${where} ORDER BY scope ASC, kind ASC, name ASC`).all(...params) as any[];
  return rows.map(mapLibraryItem);
};

export const getLibraryItemById = (id: number): LibraryItemRow | null => {
  const row = db.prepare("SELECT * FROM library_items WHERE id = ?").get(id) as any;
  return row ? mapLibraryItem(row) : null;
};

export const deleteLibraryItem = (id: number) => {
  return db.prepare("DELETE FROM library_items WHERE id = ? AND scope != 'system'").run(id);
};

export const seedSystemLibrary = () => {
  const count = db.prepare("SELECT COUNT(*) as count FROM library_items WHERE scope='system'").get() as { count: number };
  if (count.count > 0) return;

  const fixtureProfiles = [
    {
      name: "PAR RGBW 8ch",
      description: "Profil simple pour projecteur PAR RGBW debutant.",
      tags: ["fixture", "rgbw", "debutant"],
      data: {
        manufacturer: "Glow Logic",
        modeName: "8ch RGBW",
        totalChannels: 8,
        channels: [
          { channel: 1, function: "Dimmer", type: "dimmer" },
          { channel: 2, function: "Red", type: "red" },
          { channel: 3, function: "Green", type: "green" },
          { channel: 4, function: "Blue", type: "blue" },
          { channel: 5, function: "White", type: "white" },
          { channel: 6, function: "Strobe", type: "strobe" },
          { channel: 7, function: "Macro", type: "effect" },
          { channel: 8, function: "Speed", type: "speed" },
        ],
      },
    },
    {
      name: "Moving Head Spot 12ch",
      description: "Lyre spot generique pour tests pan, tilt, dimmer, couleur, gobo.",
      tags: ["fixture", "moving-head", "beam"],
      data: {
        manufacturer: "Glow Logic",
        modeName: "12ch Spot",
        totalChannels: 12,
        channels: [
          { channel: 1, function: "Pan", type: "pan" },
          { channel: 2, function: "Pan Fine", type: "pan_fine" },
          { channel: 3, function: "Tilt", type: "tilt" },
          { channel: 4, function: "Tilt Fine", type: "tilt_fine" },
          { channel: 5, function: "Speed", type: "speed" },
          { channel: 6, function: "Dimmer", type: "dimmer" },
          { channel: 7, function: "Strobe", type: "strobe" },
          { channel: 8, function: "Color", type: "color_wheel" },
          { channel: 9, function: "Gobo", type: "gobo" },
          { channel: 10, function: "Prism", type: "prism" },
          { channel: 11, function: "Focus", type: "focus" },
          { channel: 12, function: "Reset", type: "control" },
        ],
      },
    },
  ];

  const lookPresets = [
    {
      name: "DJ Starter Looks",
      description: "Warm Up, Build, Drop et Break pour commencer sans DMX avance.",
      tags: ["look", "dj", "starter"],
      data: {
        pads: [
          { name: "Warm Up", rgb: { r: 0, g: 90, b: 255 }, intensity: 190 },
          { name: "Build", rgb: { r: 255, g: 0, b: 190 }, intensity: 235, strobe: 40 },
          { name: "Drop", rgb: { r: 255, g: 255, b: 255 }, intensity: 255, strobe: 220 },
          { name: "Break", rgb: { r: 0, g: 25, b: 180 }, intensity: 120 },
        ],
      },
    },
    {
      name: "Conference Safe Looks",
      description: "Looks doux sans strobe pour discours, panel et photo.",
      tags: ["look", "conference", "safe"],
      data: {
        pads: [
          { name: "Orateur", rgb: { r: 255, g: 220, b: 170 }, intensity: 225 },
          { name: "Panel", rgb: { r: 80, g: 180, b: 255 }, intensity: 165 },
          { name: "Pause", rgb: { r: 20, g: 70, b: 190 }, intensity: 95 },
          { name: "Photo", rgb: { r: 255, g: 255, b: 255 }, intensity: 255 },
        ],
      },
    },
  ];

  const venueTemplates = [
    {
      name: "Petit bar",
      description: "Deux barres RGB, controle tactile simple, groupes Piste et Bar.",
      tags: ["venue", "bar", "debutant"],
      data: { template: "bar_rgb", count: 2, groupName: "Piste", showProfile: "dj", controlSurface: "touch" },
    },
    {
      name: "VJ Mapping Room",
      description: "Lumiere basse pour garder la projection lisible.",
      tags: ["venue", "vj", "mapping"],
      data: { template: "bar_rgb", count: 2, groupName: "Fond", showProfile: "vj", controlSurface: "launchpad" },
    },
  ];

  const showTemplates = [
    {
      name: "DJ One Hour Starter",
      description: "Structure show DJ: intro, warm-up, build, drop, break, final.",
      tags: ["show", "dj", "timeline"],
      data: {
        sections: [
          { name: "Intro", startMin: 0, mood: "blue" },
          { name: "Warm Up", startMin: 5, mood: "cyan" },
          { name: "Build", startMin: 20, mood: "purple" },
          { name: "Drop", startMin: 30, mood: "white-strobe" },
          { name: "Break", startMin: 45, mood: "deep-blue" },
          { name: "Final", startMin: 55, mood: "bright" },
        ],
      },
    },
  ];

  [...fixtureProfiles.map((item) => ({ ...item, kind: "fixture_profile" as LibraryItemKind })),
   ...lookPresets.map((item) => ({ ...item, kind: "look_preset" as LibraryItemKind })),
   ...venueTemplates.map((item) => ({ ...item, kind: "venue_template" as LibraryItemKind })),
   ...showTemplates.map((item) => ({ ...item, kind: "show_template" as LibraryItemKind })),
  ].forEach((item) => saveLibraryItem(item.kind, "system", item.name, item.data, item.description, item.tags));
};

seedSystemLibrary();

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

// ─── Scenes ──────────────────────────────────────────────────────

export interface DmxValueRow {
  universe: number;
  channel: number;
  value: number;
}

export interface SceneRow {
  id: number;
  name: string;
  color: string;
  values: DmxValueRow[];
  created_at: string;
}

export const saveScene = (name: string, color: string, values: DmxValueRow[]): number => {
  const stmt = db.prepare(
    "INSERT INTO scenes (name, color, \"values\") VALUES (?, ?, ?)",
  );
  const result = stmt.run(name, color, JSON.stringify(values));
  return Number(result.lastInsertRowid);
};

export const getScenes = (): SceneRow[] => {
  const rows = db.prepare("SELECT * FROM scenes ORDER BY created_at DESC").all() as any[];
  return rows.map(r => {
    try { r.values = JSON.parse(r.values); } catch { r.values = []; }
    return r as SceneRow;
  });
};

export const getSceneById = (id: number): SceneRow | null => {
  const row = db.prepare("SELECT * FROM scenes WHERE id = ?").get(id) as any;
  if (!row) return null;
  try { row.values = JSON.parse(row.values); } catch { row.values = []; }
  return row as SceneRow;
};

export const deleteScene = (id: number) => {
  return db.prepare("DELETE FROM scenes WHERE id = ?").run(id);
};

// ─── Cue Lists ────────────────────────────────────────────────────

export interface CueChannel {
  universe: number;
  channel: number;
  value: number;
}

export interface Cue {
  id: number;
  name: string;
  channels: CueChannel[];
  fadeMs: number;
  holdMs: number;
  color: string;
  easing?: string;
}

export interface CueListRow {
  id: number;
  name: string;
  cues: Cue[];
  created_at: string;
}

export const saveCueList = (name: string, cues: Cue[]): number => {
  const stmt = db.prepare(
    "INSERT INTO cue_lists (name, data) VALUES (?, ?)",
  );
  const result = stmt.run(name, JSON.stringify(cues));
  return Number(result.lastInsertRowid);
};

export const getCueLists = (): CueListRow[] => {
  const rows = db.prepare("SELECT * FROM cue_lists ORDER BY created_at DESC").all() as any[];
  return rows.map(r => {
    try { r.cues = JSON.parse(r.data); } catch { r.cues = []; }
    delete r.data;
    return r as CueListRow;
  });
};

export const getCueListById = (id: number): CueListRow | null => {
  const row = db.prepare("SELECT * FROM cue_lists WHERE id = ?").get(id) as any;
  if (!row) return null;
  try { row.cues = JSON.parse(row.data); } catch { row.cues = []; }
  delete row.data;
  return row as CueListRow;
};

export const updateCueList = (id: number, name: string, cues: Cue[]) => {
  return db.prepare(
    "UPDATE cue_lists SET name = ?, data = ? WHERE id = ?",
  ).run(name, JSON.stringify(cues), id);
};

export const deleteCueList = (id: number) => {
  return db.prepare("DELETE FROM cue_lists WHERE id = ?").run(id);
};

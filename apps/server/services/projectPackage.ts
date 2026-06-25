import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  getAllSettings,
  getCueLists,
  getDatabasePath,
  getFixtureGroups,
  getFixtures,
  getLibraryItems,
  getProjectById,
  getScenes,
  getVenueProfiles,
  saveCueList,
  saveFixture,
  saveFixtureGroup,
  saveLibraryItem,
  saveProject,
  saveScene,
  saveVenueProfile,
  type Cue,
  type DmxChannelRecord,
  type DmxValueRow,
  type FixtureMode,
  type LibraryItemKind,
  type LibraryItemScope,
} from "./database";

const PROJECT_PACK_KIND = "glow-logic-project";
const PROJECT_PACK_FORMAT = "glowproject";
const PROJECT_SCHEMA_VERSION = 3;

type JsonRecord = Record<string, unknown>;

interface ZipEntryInput {
  name: string;
  data: Buffer;
}

interface ZipEntryOutput extends ZipEntryInput {
  compressionMethod: number;
}

export interface ProjectPackageManifest {
  app: "Glow Logic";
  kind: typeof PROJECT_PACK_KIND;
  format: typeof PROJECT_PACK_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  name: string;
  projectId: number | null;
  counts: Record<string, number>;
  files: {
    project: string;
    databaseSnapshot: string;
    sqliteDatabase: string | null;
    assets: string;
  };
  checksums: Record<string, string>;
  notes: string[];
}

export interface ParsedProjectPackage {
  manifest: ProjectPackageManifest;
  projectState: JsonRecord;
  databaseSnapshot: JsonRecord;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZip(entries: ZipEntryInput[]) {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, day } = dosTimeDate();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    fileParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, end]);
}

function parseZip(buffer: Buffer): ZipEntryOutput[] {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Archive .glowproject invalide");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntryOutput[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Central directory ZIP invalide");
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = compressionMethod === 8 ? zlib.inflateRawSync(compressed) : Buffer.from(compressed);
    if (data.length !== uncompressedSize) throw new Error(`Taille ZIP invalide pour ${name}`);

    entries.push({ name, data, compressionMethod });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function jsonBuffer(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeSettings() {
  const settings = getAllSettings();
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !/(key|token|secret|password)/i.test(key)),
  );
}

function extractAssetManifest(projectState: JsonRecord) {
  const playlist = Array.isArray(projectState.playlist) ? projectState.playlist : [];
  const media = playlist
    .map((track, index) => asRecord(track))
    .filter((track) => typeof track.fileUrl === "string" && track.fileUrl.length > 0)
    .map((track, index) => ({
      index,
      id: String(track.id ?? `media-${index}`),
      name: String(track.name ?? `Media ${index + 1}`),
      type: String(track.fileType ?? track.type ?? "media"),
      fileUrl: String(track.fileUrl),
      packaged: false,
      reason: "external_reference",
    }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    media,
    notes: [
      "Les medias locaux restent references par fileUrl dans ce MVP.",
      "Le pack contient les donnees show/patch/library et un snapshot SQLite pour support/restauration.",
    ],
  };
}

function databaseSnapshot() {
  return {
    exportedAt: new Date().toISOString(),
    fixtures: getFixtures(),
    fixtureGroups: getFixtureGroups(),
    venueProfiles: getVenueProfiles(),
    libraryItems: getLibraryItems().filter((item) => item.scope !== "system"),
    scenes: getScenes(),
    cueLists: getCueLists(),
    settings: safeSettings(),
  };
}

function countSnapshot(snapshot: JsonRecord) {
  return {
    fixtures: Array.isArray(snapshot.fixtures) ? snapshot.fixtures.length : 0,
    fixtureGroups: Array.isArray(snapshot.fixtureGroups) ? snapshot.fixtureGroups.length : 0,
    venueProfiles: Array.isArray(snapshot.venueProfiles) ? snapshot.venueProfiles.length : 0,
    libraryItems: Array.isArray(snapshot.libraryItems) ? snapshot.libraryItems.length : 0,
    scenes: Array.isArray(snapshot.scenes) ? snapshot.scenes.length : 0,
    cueLists: Array.isArray(snapshot.cueLists) ? snapshot.cueLists.length : 0,
  };
}

export function buildProjectPackage(input: { projectId?: number; name?: string; projectState?: JsonRecord }) {
  const storedProject = input.projectId ? getProjectById(input.projectId) : null;
  if (input.projectId && !storedProject) throw new Error("Projet introuvable");

  const projectState = input.projectState || asRecord(storedProject?.data);
  const projectName = String(input.name || storedProject?.name || projectState.currentProjectName || "Glow Logic Show");
  const projectJson = {
    id: storedProject?.id ?? null,
    name: projectName,
    schemaVersion: Number(projectState.version || PROJECT_SCHEMA_VERSION),
    createdAt: storedProject?.created_at ?? null,
    updatedAt: storedProject?.updated_at ?? null,
    projectState,
  };
  const snapshot = databaseSnapshot();
  const assets = extractAssetManifest(projectState);

  const entries: ZipEntryInput[] = [
    { name: "project.json", data: jsonBuffer(projectJson) },
    { name: "database/snapshot.json", data: jsonBuffer(snapshot) },
    { name: "assets/manifest.json", data: jsonBuffer(assets) },
  ];

  const sqlitePath = getDatabasePath();
  if (fs.existsSync(sqlitePath)) {
    entries.push({ name: "database/project.db", data: fs.readFileSync(sqlitePath) });
  }

  const checksums = Object.fromEntries(entries.map((entry) => [entry.name, sha256(entry.data)]));
  const manifest: ProjectPackageManifest = {
    app: "Glow Logic",
    kind: PROJECT_PACK_KIND,
    format: PROJECT_PACK_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    name: projectName,
    projectId: storedProject?.id ?? null,
    counts: {
      ...countSnapshot(snapshot),
      mediaReferences: Array.isArray(assets.media) ? assets.media.length : 0,
    },
    files: {
      project: "project.json",
      databaseSnapshot: "database/snapshot.json",
      sqliteDatabase: entries.some((entry) => entry.name === "database/project.db") ? "database/project.db" : null,
      assets: "assets/manifest.json",
    },
    checksums,
    notes: [
      "Archive .glowproject ZIP compatible offline.",
      "database/project.db est fourni comme snapshot support; l'import applicatif utilise database/snapshot.json.",
      "Les cles API, tokens, secrets et mots de passe ne sont pas exportes.",
    ],
  };

  const manifestEntry = { name: "manifest.json", data: jsonBuffer(manifest) };
  return {
    filename: `${projectName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 80) || "glow-logic"}.glowproject`,
    manifest,
    buffer: createZip([manifestEntry, ...entries]),
  };
}

function parseJsonEntry<T>(entry: ZipEntryOutput | undefined, fallback: T): T {
  if (!entry) return fallback;
  return JSON.parse(entry.data.toString("utf8")) as T;
}

export function parseProjectPackage(buffer: Buffer): ParsedProjectPackage {
  const trimmed = buffer.subarray(0, Math.min(buffer.length, 32)).toString("utf8").trimStart();
  if (trimmed.startsWith("{")) {
    const raw = JSON.parse(buffer.toString("utf8")) as JsonRecord;
    const manifest = asRecord(raw.manifest) as Partial<ProjectPackageManifest>;
    const legacyLibrary = asRecord(raw.library);
    return {
      manifest: {
        app: "Glow Logic",
        kind: PROJECT_PACK_KIND,
        format: PROJECT_PACK_FORMAT,
        schemaVersion: Number(raw.version || manifest.schemaVersion || PROJECT_SCHEMA_VERSION),
        exportedAt: String(raw.exportedAt || manifest.exportedAt || new Date().toISOString()),
        name: String(raw.name || manifest.name || "Glow Logic Show"),
        projectId: null,
        counts: {},
        files: {
          project: "inline",
          databaseSnapshot: "inline",
          sqliteDatabase: null,
          assets: "inline",
        },
        checksums: {},
        notes: ["Import JSON legacy normalise."],
      },
      projectState: asRecord(raw.projectState),
      databaseSnapshot: {
        fixtureGroups: Array.isArray(raw.fixtureGroups) ? raw.fixtureGroups : [],
        venueProfiles: Array.isArray(raw.venueProfiles) ? raw.venueProfiles : [],
        libraryItems: Array.isArray(legacyLibrary.items) ? legacyLibrary.items : [],
      },
    };
  }

  const entries = parseZip(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const manifest = parseJsonEntry<ProjectPackageManifest>(byName.get("manifest.json"), undefined as never);
  if (manifest.kind !== PROJECT_PACK_KIND || manifest.format !== PROJECT_PACK_FORMAT) {
    throw new Error("Format .glowproject non reconnu");
  }

  const project = parseJsonEntry<JsonRecord>(byName.get(manifest.files.project), {});
  const snapshot = parseJsonEntry<JsonRecord>(byName.get(manifest.files.databaseSnapshot), {});
  return {
    manifest,
    projectState: asRecord(project.projectState),
    databaseSnapshot: snapshot,
  };
}

function importArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function importProjectPackage(buffer: Buffer, options: { name?: string; mergeDatabase?: boolean } = {}) {
  const parsed = parseProjectPackage(buffer);
  const importName = String(options.name || `${parsed.manifest.name} (import)`);
  const projectId = saveProject(importName, {
    ...parsed.projectState,
    currentProjectName: importName,
  });

  const snapshot = parsed.databaseSnapshot;
  const mergeDatabase = options.mergeDatabase !== false;
  const imported = {
    projectId,
    fixtures: 0,
    fixtureGroups: 0,
    venueProfiles: 0,
    libraryItems: 0,
    scenes: 0,
    cueLists: 0,
  };

  if (mergeDatabase) {
    for (const fixture of importArray<JsonRecord>(snapshot.fixtures)) {
      saveFixture(
        String(fixture.name || "Fixture importee"),
        importArray<DmxChannelRecord>(fixture.channels),
        typeof fixture.manufacturer === "string" ? fixture.manufacturer : undefined,
        typeof fixture.notes === "string" ? fixture.notes : undefined,
        undefined,
        Number(fixture.start_address || fixture.startAddress || 1),
        importArray<FixtureMode>(fixture.modes),
      );
      imported.fixtures += 1;
    }

    for (const group of importArray<JsonRecord>(snapshot.fixtureGroups)) {
      saveFixtureGroup(
        String(group.name || "Groupe importe"),
        importArray<number>(group.fixtureIds).map(Number).filter(Number.isFinite),
        typeof group.role === "string" ? group.role : null,
        typeof group.color === "string" ? group.color : "#06b6d4",
      );
      imported.fixtureGroups += 1;
    }

    for (const venue of importArray<JsonRecord>(snapshot.venueProfiles)) {
      saveVenueProfile(String(venue.name || "Venue importee"), asRecord(venue.data));
      imported.venueProfiles += 1;
    }

    for (const item of importArray<JsonRecord>(snapshot.libraryItems)) {
      const kind = String(item.kind || "");
      if (!["fixture_profile", "look_preset", "show_template", "venue_template"].includes(kind)) continue;
      const scope = item.scope === "community" ? "community" : "user";
      saveLibraryItem(
        kind as LibraryItemKind,
        scope as LibraryItemScope,
        String(item.name || "Item importe"),
        asRecord(item.data),
        typeof item.description === "string" ? item.description : null,
        importArray<string>(item.tags).map(String),
      );
      imported.libraryItems += 1;
    }

    for (const scene of importArray<JsonRecord>(snapshot.scenes)) {
      saveScene(
        String(scene.name || "Scene importee"),
        typeof scene.color === "string" ? scene.color : "#06b6d4",
        importArray<DmxValueRow>(scene.values),
      );
      imported.scenes += 1;
    }

    for (const cueList of importArray<JsonRecord>(snapshot.cueLists)) {
      saveCueList(String(cueList.name || "Cue list importee"), importArray<Cue>(cueList.cues));
      imported.cueLists += 1;
    }
  }

  return {
    success: true,
    manifest: parsed.manifest,
    imported,
  };
}

export const CURRENT_PROJECT_SCHEMA_VERSION = 3;

function asArray<T = any>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function asRecord<T = unknown>(value: unknown, fallback: Record<string, T> = {}): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, T>
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePlaylist(value: unknown) {
  return asArray<any>(value).map((track) => ({
    id: track?.id || `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: track?.name || track?.fileName || "Media",
    fileUrl: track?.fileUrl || "",
    fileName: track?.fileName,
    fileType: track?.fileType === "video" ? "video" : "audio",
    volume: asNumber(track?.volume, 0.8),
    lightMode: ["manuel", "ia", "programme"].includes(track?.lightMode) ? track.lightMode : "manuel",
    aiPreset: ["rock", "jazz", "club", "tv"].includes(track?.aiPreset) ? track.aiPreset : "club",
    duration: asNumber(track?.duration, 0),
    isPause: Boolean(track?.isPause),
    pauseDuration: asNumber(track?.pauseDuration, 0),
  }));
}

export function normalizeProjectState(
  input: any,
  fallback: any = {},
  options: { projectName?: string | null } = {},
) {
  const sourceVersion = Number(input?.version || input?.schemaVersion || 1);
  const migrations: string[] = [];

  if (sourceVersion < CURRENT_PROJECT_SCHEMA_VERSION) {
    migrations.push(`Projet/snapshot v${sourceVersion} normalise vers v${CURRENT_PROJECT_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(input?.playlist)) {
    migrations.push("Playlist absente ou invalide remplacee par une liste sure.");
  }
  if (!Array.isArray(input?.smartPads)) {
    migrations.push("Pads absents ou invalides remplaces par une liste vide.");
  }

  const normalized = {
    version: CURRENT_PROJECT_SCHEMA_VERSION,
    nodes: asArray(input?.nodes, asArray(fallback.nodes)),
    edges: asArray(input?.edges, asArray(fallback.edges)),
    smartPads: asArray(input?.smartPads, []),
    smartZoneValues: asRecord(input?.smartZoneValues, asRecord(fallback.smartZoneValues)),
    smartZoneMappings: asRecord(input?.smartZoneMappings, asRecord(fallback.smartZoneMappings)),
    smartWidgets: asArray(input?.smartWidgets, asArray(fallback.smartWidgets)),
    smartPadColumns: asNumber(input?.smartPadColumns, asNumber(fallback.smartPadColumns, 4)),
    midiMappings: asRecord(input?.midiMappings, asRecord(fallback.midiMappings)),
    dmxOutputs: asRecord(input?.dmxOutputs, asRecord(fallback.dmxOutputs, { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false })),
    networkState: {
      adapters: asArray(input?.networkState?.adapters, asArray(fallback.networkState?.adapters)),
      activeAdapter: input?.networkState?.activeAdapter ?? fallback.networkState?.activeAdapter ?? null,
      discoveredNodes: asArray(input?.networkState?.discoveredNodes, asArray(fallback.networkState?.discoveredNodes)),
    },
    appMode: input?.appMode === "creator" ? "creator" : "smart",
    proView: input?.proView || fallback.proView || "canvas",
    clips: asArray(input?.clips, asArray(fallback.clips)),
    markers: asArray(input?.markers, asArray(fallback.markers)),
    automationTracks: asArray(input?.automationTracks, asArray(fallback.automationTracks)),
    duration: asNumber(input?.duration, asNumber(fallback.duration, 60)),
    zoom: asNumber(input?.zoom, asNumber(fallback.zoom, 1)),
    viewStart: asNumber(input?.viewStart, asNumber(fallback.viewStart, 0)),
    playlist: normalizePlaylist(input?.playlist ?? fallback.playlist),
    currentTrackIndex: asNumber(input?.currentTrackIndex, asNumber(fallback.currentTrackIndex, 0)),
    isPlaying: Boolean(input?.isPlaying ?? fallback.isPlaying ?? false),
    masterVolume: asNumber(input?.masterVolume, asNumber(fallback.masterVolume, 0.8)),
    masterDimmer: asNumber(input?.masterDimmer, asNumber(fallback.masterDimmer, 255)),
    blackout: Boolean(input?.blackout ?? input?.smartBlackout ?? fallback.blackout ?? fallback.smartBlackout ?? false),
    smartBlackout: Boolean(input?.smartBlackout ?? input?.blackout ?? fallback.smartBlackout ?? fallback.blackout ?? false),
    audioSource: input?.audioSource === "mic" ? "mic" : "player",
    groupLevels: asRecord<number>(input?.groupLevels, asRecord(fallback.groupLevels)),
    groupMutes: asRecord<boolean>(input?.groupMutes, asRecord(fallback.groupMutes)),
    groupColors: asRecord<string>(input?.groupColors, asRecord(fallback.groupColors)),
    showLock: Boolean(input?.showLock ?? fallback.showLock ?? false),
    laserArmed: Boolean(input?.laserArmed ?? fallback.laserArmed ?? false),
    pyroArmed: Boolean(input?.pyroArmed ?? fallback.pyroArmed ?? false),
    currentProjectName: options.projectName ?? input?.currentProjectName ?? fallback.currentProjectName ?? null,
  };

  return {
    state: normalized,
    migrations,
    sourceVersion,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  };
}

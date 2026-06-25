import { StateCreator } from 'zustand';
import { API_BASE } from '../../lib/config';
import { socket } from '../../lib/socket';
import { dmxEngine } from '../../lib/dmxEngine';
import { startCrossfade, isContinuousChannel, type CrossfadeTarget } from '../../lib/crossfadeEngine';
import { applyMaster } from '../../lib/masterScale';
import { normalizeStageGridPosition, type StageGridPosition } from '../../lib/stagePlanMapping';
import { isReplayingHistory, pushHistory } from '../history';
import type { DmxOutputHealthSnapshot, DmxOutputsConfig, NetworkState, PatchedFixture } from '../../types/dmx';

export type SmartPad = {
    id: number;
    name: string;
    color: string;           // Tailwind bg class e.g. 'bg-cyan-500'
    textColor: string;       // Tailwind text class e.g. 'text-cyan-400'
    iconName: string;
    qlcPage: number;
    qlcWidget: number;
    dmxValues?: Record<number, number>;
    dmxCommands?: Array<{ universe: number; channel: number; value: number }>;
    // Channel masking (A2 contract): liste des canaux DMX 1..512 reellement appliques au chargement.
    // undefined/absent => TOUS les canaux s'appliquent (retro-compat). [] => AUCUN canal.
    enabledChannels?: number[];
    // Flash (A5 contract): true => pad momentane (active au press, restaure au release).
    // undefined/false => comportement actuel (toggle) INCHANGE.
    flash?: boolean;
    // MIDI mapping
    midiNote: number;        // 0-127, -1 = not mapped
    midiChannel: number;     // 1-16
    // Grid position
    gridCol: number;
    gridRow: number;
    gridW: number;
    gridH: number;
    page: number;
    slot: number;
};

export type SmartPadInput = Omit<SmartPad, 'page' | 'slot'> & Partial<Pick<SmartPad, 'page' | 'slot'>>;

// Widget sections in Smart view
export type SmartWidgetType = 'scenePads' | 'groupStrips' | 'zoneControls' | 'miniPlaylist' | 'spectro' | 'stagePlan' | 'vjDeck' | 'outputHealth';

export type VjShaderMode = "gradient" | "waves" | "strobe" | "laser" | "drone" | "pyro" | "gobo" | "prism";

export type SmartWidget = {
    id: SmartWidgetType;
    label: string;
    order: number;
    collapsed: boolean;
    visible: boolean;
};

const DEFAULT_PADS: SmartPad[] = [
    { id: 1, name: 'Blue Ocean', color: 'bg-cyan-500', textColor: 'text-cyan-400', iconName: 'Droplets', qlcPage: 1, qlcWidget: 10, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 0, 8: 150 }, midiNote: 56, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 0 },
    { id: 2, name: 'Red Alert', color: 'bg-red-500', textColor: 'text-red-400', iconName: 'Flame', qlcPage: 1, qlcWidget: 11, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 50, 8: 30 }, midiNote: 57, midiChannel: 1, gridCol: 1, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 1 },
    { id: 3, name: 'Neon City', color: 'bg-purple-500', textColor: 'text-purple-400', iconName: 'Zap', qlcPage: 1, qlcWidget: 12, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 0, 8: 90, 9: 80 }, midiNote: 58, midiChannel: 1, gridCol: 2, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 2 },
    { id: 4, name: 'Strobe BPM', color: 'bg-white', textColor: 'text-slate-800', iconName: 'Activity', qlcPage: 1, qlcWidget: 13, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 200, 8: 0 }, midiNote: 59, midiChannel: 1, gridCol: 3, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 3 },
];

export const DEFAULT_WIDGETS: SmartWidget[] = [
    { id: 'scenePads', label: 'Scenes Live', order: 0, collapsed: false, visible: true },
    { id: 'groupStrips', label: 'Groupes DMX (6 ch)', order: 1, collapsed: false, visible: true },
    { id: 'stagePlan', label: 'Plan de Scène Interactif', order: 1, collapsed: false, visible: true },
    { id: 'zoneControls', label: 'Contrôles de Zone', order: 2, collapsed: false, visible: true },
    { id: 'vjDeck', label: 'VJ / Mapping / Resolume', order: 4, collapsed: false, visible: true },
    { id: 'miniPlaylist', label: 'Mini Playlist', order: 5, collapsed: true, visible: true },
    { id: 'spectro', label: 'Spectro Audio', order: 6, collapsed: true, visible: true },
    { id: 'outputHealth', label: 'Santé Sorties DMX', order: 6, collapsed: true, visible: true },
];

export type PadTemplateId = 'mariage' | 'club' | 'livevj';
export type SmartPadViewMode = 'visual' | 'midi';

const PAD_TEMPLATES: Record<PadTemplateId, Array<Pick<SmartPad, 'name' | 'color' | 'textColor' | 'iconName'> & { values: Record<number, number> }>> = {
    mariage: [
        { name: "Accueil doux", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Droplets", values: { 1: 95, 3: 120, 6: 180, 7: 0, 8: 40 } },
        { name: "Diner chaud", color: "bg-orange-500", textColor: "text-orange-400", iconName: "Sparkles", values: { 1: 70, 3: 90, 6: 150, 7: 30, 8: 15 } },
        { name: "Ouverture bal", color: "bg-white", textColor: "text-slate-100", iconName: "Activity", values: { 1: 150, 3: 150, 6: 255, 7: 0, 8: 0 } },
        { name: "Dancefloor", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Zap", values: { 1: 170, 3: 170, 6: 255, 7: 80, 8: 120 } },
        { name: "Slow", color: "bg-pink-500", textColor: "text-pink-400", iconName: "Droplets", values: { 1: 90, 3: 110, 6: 180, 7: 20, 8: 70 } },
        { name: "Final blanc", color: "bg-white", textColor: "text-slate-100", iconName: "Sparkles", values: { 1: 220, 3: 220, 6: 255, 7: 0, 8: 0 } },
    ],
    club: [
        { name: "Warmup blue", color: "bg-blue-500", textColor: "text-blue-400", iconName: "Droplets", values: { 1: 80, 3: 100, 6: 180, 7: 0, 8: 140 } },
        { name: "Build amber", color: "bg-amber-500", textColor: "text-amber-400", iconName: "Activity", values: { 1: 130, 3: 130, 6: 220, 7: 40, 8: 60 } },
        { name: "Drop neon", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Zap", values: { 1: 210, 3: 210, 6: 255, 7: 120, 8: 90, 9: 90 } },
        { name: "Bass pulse", color: "bg-red-500", textColor: "text-red-400", iconName: "Flame", values: { 1: 190, 3: 160, 6: 255, 7: 70, 8: 30 } },
        { name: "Strobe safe", color: "bg-white", textColor: "text-slate-100", iconName: "Activity", values: { 1: 180, 3: 180, 6: 255, 7: 180, 8: 0 } },
        { name: "Reset look", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Sparkles", values: { 1: 120, 3: 120, 6: 180, 7: 0, 8: 0 } },
    ],
    livevj: [
        { name: "Video readable", color: "bg-blue-500", textColor: "text-blue-400", iconName: "AudioLines", values: { 1: 55, 3: 70, 6: 120, 7: 0, 8: 100 } },
        { name: "Face propre", color: "bg-white", textColor: "text-slate-100", iconName: "Sparkles", values: { 1: 110, 3: 80, 6: 170, 7: 0, 8: 0 } },
        { name: "Silhouette", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Droplets", values: { 1: 75, 3: 90, 6: 150, 7: 10, 8: 130 } },
        { name: "Chorus lift", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Activity", values: { 1: 145, 3: 145, 6: 210, 7: 0, 8: 70 } },
        { name: "Solo focus", color: "bg-amber-500", textColor: "text-amber-400", iconName: "Zap", values: { 1: 130, 3: 110, 6: 180, 7: 20, 8: 20 } },
        { name: "Interlude dark", color: "bg-slate-500", textColor: "text-slate-300", iconName: "Droplets", values: { 1: 30, 3: 45, 6: 90, 7: 0, 8: 160 } },
    ],
};

const LEGACY_SMART_WIDGET_IDS: Record<string, SmartWidgetType> = {
    pads: 'scenePads',
    apcVirtual: 'scenePads',
};
const VALID_SMART_WIDGET_IDS = new Set<SmartWidgetType>(DEFAULT_WIDGETS.map((widget) => widget.id));
let previewSavedGate: DmxOutputsConfig | null = null;
const stagePlanSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Flash (A5 contract): snapshot transitoire des valeurs DMX avant un flash momentane.
// Vit HORS du state persiste (Map module-level keyee par sceneId).
// flashPadOn capture { universe, channel, value } courants; flashPadOff restaure puis purge.
const flashSnapshots = new Map<number, Array<{ universe: number; channel: number; value: number }>>();

function resolveSmartWidgetId(id: unknown): SmartWidgetType | null {
    if (typeof id !== 'string') return null;
    if (id in LEGACY_SMART_WIDGET_IDS) return LEGACY_SMART_WIDGET_IDS[id];
    return VALID_SMART_WIDGET_IDS.has(id as SmartWidgetType) ? id as SmartWidgetType : null;
}

export function normalizeSmartWidgets(widgets: unknown): SmartWidget[] {
    const source = Array.isArray(widgets) ? widgets : [];
    const defaultsById = new Map<SmartWidgetType, SmartWidget>(DEFAULT_WIDGETS.map((widget) => [widget.id, widget]));
    const seen = new Set<SmartWidgetType>();
    const normalized: SmartWidget[] = [];

    source.forEach((rawWidget, index) => {
        if (!rawWidget || typeof rawWidget !== 'object') return;
        const candidate = rawWidget as { id?: unknown; label?: unknown; order?: unknown; collapsed?: unknown; visible?: unknown };
        const id = resolveSmartWidgetId(candidate.id);
        if (!id || seen.has(id)) return;
        const fallback = defaultsById.get(id);
        if (!fallback) return;
        seen.add(id);
        normalized.push({
            ...fallback,
            id,
            label: typeof candidate.label === 'string' && candidate.label.trim().length > 0 ? candidate.label : fallback.label,
            order: typeof candidate.order === 'number' && Number.isFinite(candidate.order) ? candidate.order : index,
            collapsed: typeof candidate.collapsed === 'boolean' ? candidate.collapsed : fallback.collapsed,
            visible: candidate.visible !== false,
        });
    });

    const sorted = normalized.sort((a, b) => a.order - b.order);
    DEFAULT_WIDGETS.forEach((widget) => {
        if (!seen.has(widget.id)) sorted.push({ ...widget });
    });
    return sorted.map((widget, index) => ({ ...widget, order: index }));
}

function clampPage(value: unknown, fallback: number) {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.max(0, Math.min(3, numeric));
}

function clampSlot(value: unknown, fallback: number) {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.max(0, Math.min(15, numeric));
}

// Channel masking (A2): normalise une liste de canaux DMX -> trie, dedup, clampe 1..512.
// undefined/absent reste undefined (retro-compat: tous les canaux s'appliquent).
function normalizeEnabledChannels(channels: unknown): number[] | undefined {
    if (!Array.isArray(channels)) return undefined;
    const cleaned = channels
        .map((value) => Math.round(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 512);
    return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

export function normalizeSmartPads(pads: unknown): SmartPad[] {
    if (!Array.isArray(pads)) return [];
    const occupied = new Set<string>();

    return pads.map((rawPad, index) => {
        const pad = rawPad as Partial<SmartPad>;
        let page = clampPage(pad.page, Math.floor(index / 16));
        let slot = clampSlot(pad.slot, index % 16);
        if (occupied.has(`${page}:${slot}`)) {
            const fallbackIndex = Array.from({ length: 64 }, (_, candidate) => candidate)
                .find((candidate) => !occupied.has(`${Math.floor(candidate / 16)}:${candidate % 16}`));
            if (fallbackIndex !== undefined) {
                page = Math.floor(fallbackIndex / 16);
                slot = fallbackIndex % 16;
            }
        }
        occupied.add(`${page}:${slot}`);
        return {
            id: Number(pad.id ?? Date.now() + index),
            name: String(pad.name || `Scene ${index + 1}`),
            color: String(pad.color || 'bg-cyan-500'),
            textColor: String(pad.textColor || 'text-cyan-400'),
            iconName: String(pad.iconName || 'Zap'),
            qlcPage: Number(pad.qlcPage || 1),
            qlcWidget: Number(pad.qlcWidget || 80 + index),
            dmxValues: pad.dmxValues,
            dmxCommands: pad.dmxCommands,
            enabledChannels: normalizeEnabledChannels(pad.enabledChannels),
            flash: pad.flash === true ? true : undefined,
            midiNote: Number(pad.midiNote ?? -1),
            midiChannel: Number(pad.midiChannel || 1),
            gridCol: Number(pad.gridCol ?? slot % 4),
            gridRow: Number(pad.gridRow ?? Math.floor(slot / 4)),
            gridW: Number(pad.gridW || 1),
            gridH: Number(pad.gridH || 1),
            page,
            slot,
        };
    }).filter((pad) => pad.page < 4 && pad.slot < 16);
}

export function migratePadMidiMappings(mappings: unknown, pads: SmartPad[]): Record<string, { type: number; channel: number; data1: number }> {
    const source = mappings && typeof mappings === 'object' && !Array.isArray(mappings)
        ? mappings as Record<string, { type: number; channel: number; data1: number }>
        : {};
    const next: Record<string, { type: number; channel: number; data1: number }> = {};

    Object.entries(source).forEach(([key, mapping]) => {
        const legacyMatch = /^pad_(\d+)$/.exec(key);
        if (legacyMatch) {
            const pad = pads.find((candidate) => candidate.id === Number(legacyMatch[1]));
            if (pad) next[`pad_${pad.page}_${pad.slot}`] = mapping;
            return;
        }
        next[key] = mapping;
    });

    return next;
}

function normalizeFixtureRecord(fixture: any): PatchedFixture {
    const id = Number(fixture.id || fixture.fixtureId || Date.now());
    const channels = Array.isArray(fixture.channels)
        ? fixture.channels.map((channel: any) => ({
            ...channel,
            channel: Number(channel.channel || 1),
            name: String(channel.name || channel.function || channel.type || "Channel"),
            type: String(channel.type || channel.function || "custom"),
            minVal: Number(channel.minVal ?? channel.min ?? channel.minValue ?? 0),
            maxVal: Number(channel.maxVal ?? channel.max ?? channel.maxValue ?? 255),
            defaultVal: Number(channel.defaultVal ?? channel.default ?? 0),
            function: String(channel.function || channel.name || channel.type || "Channel"),
            minValue: Number(channel.minValue ?? channel.minVal ?? channel.min ?? 0),
            maxValue: Number(channel.maxValue ?? channel.maxVal ?? channel.max ?? 255),
        }))
        : [];

    return {
        id,
        nodeId: fixture.nodeId || `fixture-${id}`,
        fixtureId: typeof fixture.id === "number" ? fixture.id : fixture.fixtureId,
        name: String(fixture.name || fixture.label || "Fixture"),
        profileId: String(fixture.profileId || fixture.fixtureId || fixture.id || id),
        activeMode: String(fixture.activeMode || fixture.modeName || fixture.modes?.[0]?.name || "Default"),
        universe: Number(fixture.universe || 1),
        startAddress: Number(fixture.startAddress || fixture.start_address || 1),
        start_address: Number(fixture.start_address || fixture.startAddress || 1),
        gridPosition: fixture.gridPosition ? normalizeStageGridPosition(fixture.gridPosition) : { x: 0, y: 0, z: 0 },
        totalChannels: Number(fixture.totalChannels || fixture.total_channels || channels.length),
        total_channels: Number(fixture.total_channels || fixture.totalChannels || channels.length),
        color: fixture.color,
        nodeType: fixture.nodeType || fixture.type,
        channels,
    };
}

function stageGridPositionsEqual(a: StageGridPosition, b: StageGridPosition) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

export interface ZoneMapping {
    name: string;
    fixtures: number[];
}

export interface SmartModeSlice {
    dmxOutputs: DmxOutputsConfig;
    setDmxOutputs: (outputs: Partial<DmxOutputsConfig>) => void;
    dmxOutputHealth: DmxOutputHealthSnapshot | null;
    setDmxOutputHealth: (snapshot: DmxOutputHealthSnapshot | null) => void;
    networkState: NetworkState;
    setNetworkState: (state: Partial<NetworkState>) => void;
    smartBlackout: boolean;
    setSmartBlackout: (v: boolean) => void;
    blackout: boolean;
    setBlackout: (v: boolean) => void;
    masterDimmer: number;
    setMasterDimmer: (value: number) => void;
    smartAutoPilot: boolean;
    setSmartAutoPilot: (v: boolean) => void;
    smartActiveScene: number | null;
    setSmartActiveScene: (id: number | null) => void;
    smartZoneValues: Record<string, number>;
    setSmartZoneValue: (zone: string, value: number) => void;
    smartZoneMappings: Record<string, ZoneMapping>;
    setSmartZoneMapping: (zoneKey: string, mapping: ZoneMapping) => void;
    smartPads: SmartPad[];
    setSmartPads: (pads: SmartPad[]) => void;
    addSmartPad: (pad: SmartPadInput) => void;
    updateSmartPad: (id: number, updated: Partial<SmartPad>) => void;
    deleteSmartPad: (id: number) => void;
    reorderSmartPads: (fromId: number, toId: number) => void;
    activePadPage: number;
    setActivePadPage: (page: number) => void;
    smartPadViewMode: SmartPadViewMode;
    setSmartPadViewMode: (mode: SmartPadViewMode) => void;
    movePad: (padId: number, toPage: number, toSlot: number) => void;
    applyPadTemplate: (template: PadTemplateId, page: number) => void;
    // Channel masking (A2 contract)
    setSceneMask: (sceneId: number, channels: number[]) => void;
    clearSceneMask: (sceneId: number) => void;
    toggleSceneChannel: (sceneId: number, channel: number) => void;
    // Flash (A5 contract): pad momentane
    setPadFlash: (sceneId: number, flash: boolean) => void;
    flashPadOn: (sceneId: number) => void;
    flashPadOff: (sceneId: number) => void;
    // Widget layout
    smartWidgets: SmartWidget[];
    setSmartWidgets: (widgets: SmartWidget[]) => void;
    updateSmartWidget: (id: SmartWidgetType, updated: Partial<SmartWidget>) => void;
    reorderSmartWidgets: (fromOrder: number, toOrder: number) => void;
    // Grid config
    smartPadColumns: number;
    setSmartPadColumns: (cols: number) => void;
    // Edit mode
    smartEditMode: boolean;
    setSmartEditMode: (v: boolean) => void;
    // VJ / Projection / Resolume persisted state
    vjShaderMode: VjShaderMode;
    setVjShaderMode: (mode: VjShaderMode) => void;
    vjShaderIntensity: number;
    setVjShaderIntensity: (v: number) => void;
    projectionActive: boolean;
    setProjectionActive: (v: boolean) => void;
    resolumeHost: string;
    setResolumeHost: (v: string) => void;
    resolumePort: number;
    setResolumePort: (v: number) => void;
    resolumeLayer: number;
    setResolumeLayer: (v: number) => void;
    resolumeClip: number;
    setResolumeClip: (v: number) => void;
    resolumeOpacity: number;
    setResolumeOpacity: (v: number) => void;
    bpm: number;
    setBpm: (bpm: number) => void;
    fixtures: PatchedFixture[];
    stagePlanHidden: string[];
    stagePlanEditMode: boolean;
    previewMode: boolean;
    setFixtureGridPosition: (fixtureId: string, position: StageGridPosition) => void;
    addFixtureToPlan: (fixtureId: string) => void;
    removeFixtureFromPlan: (fixtureId: string) => void;
    setStagePlanEditMode: (enabled: boolean) => void;
    setPreviewMode: (enabled: boolean) => void;
    fetchFixtures: () => Promise<void>;
    triggerSmartPad: (pad: SmartPad) => void;
}

export const createSmartModeSlice: StateCreator<SmartModeSlice, [], [], SmartModeSlice> = (set, get) => ({
    dmxOutputs: { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false },
    setDmxOutputs: (outputs) => set(state => ({
        dmxOutputs: { ...state.dmxOutputs, ...outputs },
    })),
    dmxOutputHealth: null,
    setDmxOutputHealth: (dmxOutputHealth) => set({ dmxOutputHealth }),
    networkState: { adapters: [], activeAdapter: null, discoveredNodes: [] },
    setNetworkState: (networkState) => set(state => ({
        networkState: { ...state.networkState, ...networkState },
    })),
    smartBlackout: false,
    setSmartBlackout: (v) => set({ smartBlackout: v, blackout: v }),
    blackout: false,
    setBlackout: (v) => set({ blackout: v, smartBlackout: v }),
    masterDimmer: 255,
    setMasterDimmer: (value) => set({ masterDimmer: Math.max(0, Math.min(255, Math.round(value))) }),
    smartAutoPilot: false,
    setSmartAutoPilot: (v) => set({ smartAutoPilot: v }),
    smartActiveScene: null,
    setSmartActiveScene: (id) => set({ smartActiveScene: id }),
    smartZoneValues: { Master: 100, Stage: 80, Bar: 80, Dancefloor: 80 },
    setSmartZoneValue: (zone, value) => set(state => ({
        smartZoneValues: { ...state.smartZoneValues, [zone]: value }
    })),
    smartZoneMappings: {
        Master: { name: "Master", fixtures: [] },
        Stage: { name: "Stage", fixtures: [] },
        Bar: { name: "Bar", fixtures: [] },
        Dancefloor: { name: "Dancefloor", fixtures: [] },
    },
    setSmartZoneMapping: (zoneKey, mapping) => set(state => ({
        smartZoneMappings: { ...state.smartZoneMappings, [zoneKey]: mapping }
    })),
    smartPads: DEFAULT_PADS,
    setSmartPads: (pads) => set({ smartPads: normalizeSmartPads(pads) }),
    addSmartPad: (pad) => set(state => ({ smartPads: normalizeSmartPads([...state.smartPads, pad]) })),
    updateSmartPad: (id, updated) => {
        const before = get().smartPads.find((pad) => pad.id === id);
        if (!before) return;
        const after = { ...before, ...updated };
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Pad modifie: ${before.name}`,
                undo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === id ? before : pad)) })),
                redo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === id ? after : pad)) })),
            });
        }
        set(state => ({
            smartPads: state.smartPads.map(p => p.id === id ? after : p)
        }));
    },
    deleteSmartPad: (id) => {
        const before = get().smartPads;
        const deleted = before.find((pad) => pad.id === id);
        if (!deleted) return;
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Pad supprime: ${deleted.name}`,
                undo: () => set({ smartPads: before }),
                redo: () => set((state) => ({ smartPads: state.smartPads.filter((pad) => pad.id !== id) })),
            });
        }
        set(state => ({
            smartPads: state.smartPads.filter(p => p.id !== id)
        }));
    },
    reorderSmartPads: (fromId, toId) => set(state => {
        const pads = [...state.smartPads];
        const fromIdx = pads.findIndex(p => p.id === fromId);
        const toIdx = pads.findIndex(p => p.id === toId);
        if (fromIdx === -1 || toIdx === -1) return {};
        const [removed] = pads.splice(fromIdx, 1);
        pads.splice(toIdx, 0, removed);
        return { smartPads: pads };
    }),
    activePadPage: 0,
    setActivePadPage: (page) => set({ activePadPage: clampPage(page, 0) }),
    smartPadViewMode: 'visual',
    setSmartPadViewMode: (mode) => set({ smartPadViewMode: mode === 'midi' ? 'midi' : 'visual' }),
    movePad: (padId, toPage, toSlot) => {
      const before = get().smartPads;
      let movedLabel = before.find((pad) => pad.id === padId)?.name || "Pad";
      set(state => {
        const targetPage = clampPage(toPage, 0);
        const targetSlot = clampSlot(toSlot, 0);
        const source = state.smartPads.find(pad => pad.id === padId);
        if (!source) return {};
        movedLabel = source.name;
        const target = state.smartPads.find(pad => pad.id !== padId && pad.page === targetPage && pad.slot === targetSlot);
        const next = state.smartPads.map((pad) => {
            if (pad.id === padId) return { ...pad, page: targetPage, slot: targetSlot };
            if (target && pad.id === target.id) return { ...pad, page: source.page, slot: source.slot };
            return pad;
        });
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Pad deplace: ${movedLabel}`,
                undo: () => set({ smartPads: before }),
                redo: () => set({ smartPads: next }),
            });
        }
        return {
            smartPads: state.smartPads.map((pad) => {
                if (pad.id === padId) return { ...pad, page: targetPage, slot: targetSlot };
                if (target && pad.id === target.id) return { ...pad, page: source.page, slot: source.slot };
                return pad;
            }),
        };
      });
    },
    applyPadTemplate: (template, page) => set(state => {
        const targetPage = clampPage(page, 0);
        const baseId = Date.now();
        const nextPads = state.smartPads.filter((pad) => pad.page !== targetPage);
        const templatePads = PAD_TEMPLATES[template].map((pad, index): SmartPad => ({
            id: baseId + index,
            name: pad.name,
            color: pad.color,
            textColor: pad.textColor,
            iconName: pad.iconName,
            qlcPage: 1,
            qlcWidget: 80 + targetPage * 16 + index,
            dmxValues: { ...pad.values },
            midiNote: 56 + targetPage * 16 + index,
            midiChannel: 1,
            gridCol: index % 4,
            gridRow: Math.floor(index / 4),
            gridW: 1,
            gridH: 1,
            page: targetPage,
            slot: index,
        }));
        return { smartPads: [...nextPads, ...templatePads] };
    }),
    // Channel masking (A2 contract) — meme pattern que updateSmartPad (immutabilite par id + pushHistory).
    setSceneMask: (sceneId, channels) => {
        const before = get().smartPads.find((pad) => pad.id === sceneId);
        if (!before) return;
        const mask = normalizeEnabledChannels(channels) ?? [];
        const after = { ...before, enabledChannels: mask };
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Masque canaux: ${before.name}`,
                undo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? before : pad)) })),
                redo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? after : pad)) })),
            });
        }
        set((state) => ({ smartPads: state.smartPads.map((pad) => pad.id === sceneId ? after : pad) }));
    },
    clearSceneMask: (sceneId) => {
        const before = get().smartPads.find((pad) => pad.id === sceneId);
        if (!before || before.enabledChannels === undefined) return;
        // Supprime enabledChannels => tous les canaux s'appliquent de nouveau (retro-compat).
        const { enabledChannels: _omit, ...rest } = before;
        const after = rest as SmartPad;
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Masque efface: ${before.name}`,
                undo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? before : pad)) })),
                redo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? after : pad)) })),
            });
        }
        set((state) => ({ smartPads: state.smartPads.map((pad) => pad.id === sceneId ? after : pad) }));
    },
    toggleSceneChannel: (sceneId, channel) => {
        const before = get().smartPads.find((pad) => pad.id === sceneId);
        if (!before) return;
        const clamped = Math.round(Number(channel));
        if (!Number.isFinite(clamped) || clamped < 1 || clamped > 512) return;
        // Cree le masque si absent (part de la liste vide), puis ajoute/retire le canal.
        const current = before.enabledChannels ?? [];
        const exists = current.includes(clamped);
        const nextChannels = exists ? current.filter((ch) => ch !== clamped) : [...current, clamped];
        const after = { ...before, enabledChannels: normalizeEnabledChannels(nextChannels) ?? [] };
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Canal ${clamped} ${exists ? 'retire' : 'ajoute'}: ${before.name}`,
                undo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? before : pad)) })),
                redo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? after : pad)) })),
            });
        }
        set((state) => ({ smartPads: state.smartPads.map((pad) => pad.id === sceneId ? after : pad) }));
    },
    // Flash (A5 contract) — bascule le mode flash du pad. Meme pattern que setSceneMask (pushHistory).
    setPadFlash: (sceneId, flash) => {
        const before = get().smartPads.find((pad) => pad.id === sceneId);
        if (!before) return;
        const nextFlash = flash === true ? true : undefined;
        if (before.flash === nextFlash) return;
        const after = { ...before, flash: nextFlash };
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Mode flash ${nextFlash ? 'active' : 'desactive'}: ${before.name}`,
                undo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? before : pad)) })),
                redo: () => set((state) => ({ smartPads: normalizeSmartPads(state.smartPads.map((pad) => pad.id === sceneId ? after : pad)) })),
            });
        }
        set((state) => ({ smartPads: state.smartPads.map((pad) => pad.id === sceneId ? after : pad) }));
    },
    // Flash (A5 contract) — PRESS: snapshot des valeurs courantes puis applique les valeurs du pad.
    // Memes regles d'application que la branche d'activation de triggerSmartPad:
    // filtre enabledChannels (A2), scaleValue (masterDimmer), dmxValues univers 1 + dmxCommands.
    // N'altere PAS smartActiveScene.
    flashPadOn: (sceneId) => {
        const { smartPads: pads, masterDimmer, fixtures } = get();
        const pad = pads.find((p) => p.id === sceneId);
        if (!pad) return;
        // A9: resolution du TYPE d'un canal absolu (universe, channel) via les fixtures.
        // Le master ne doit attenuer QUE les canaux d'intensite (applyMaster), pas pan/tilt/gobo/etc.
        const channelType = (universe: number, channel: number): string | undefined => {
            for (const f of fixtures as any[]) {
                const fUniverse = Number(f.universe || 1);
                if (fUniverse !== universe) continue;
                const start = f.start_address || f.startAddress || 1;
                for (const ch of (f.channels || []) as any[]) {
                    if (start + ch.channel - 1 === channel) return ch.type;
                }
            }
            return undefined;
        };
        const mask = pad.enabledChannels;
        const isChannelEnabled = (channel: number) => mask === undefined || mask.includes(channel);
        const snapshot: Array<{ universe: number; channel: number; value: number }> = [];
        const applied = new Set<string>();
        const captureAndApply = (universe: number, channel: number, value: number) => {
            const key = `${universe}:${channel}`;
            if (!applied.has(key)) {
                applied.add(key);
                snapshot.push({ universe, channel, value: dmxEngine.getChannel(universe, channel) });
            }
            dmxEngine.setChannel(universe, channel, value);
        };
        if (pad.dmxValues) {
            Object.entries(pad.dmxValues).forEach(([chStr, val]) => {
                const channel = Number(chStr);
                if (!isChannelEnabled(channel)) return;
                captureAndApply(1, channel, applyMaster(Number(val), channelType(1, channel), masterDimmer));
            });
        }
        if (pad.dmxCommands) {
            pad.dmxCommands.forEach((command) => {
                if (!isChannelEnabled(command.channel)) return;
                captureAndApply(command.universe, command.channel, applyMaster(command.value, channelType(command.universe, command.channel), masterDimmer));
            });
        }
        flashSnapshots.set(sceneId, snapshot);
    },
    // Flash (A5 contract) — RELEASE: restaure les valeurs snapshot puis purge l'entree.
    flashPadOff: (sceneId) => {
        const snapshot = flashSnapshots.get(sceneId);
        if (!snapshot) return;
        snapshot.forEach(({ universe, channel, value }) => {
            dmxEngine.setChannel(universe, channel, value, { source: 'manual' });
        });
        flashSnapshots.delete(sceneId);
    },
    smartWidgets: DEFAULT_WIDGETS,
    setSmartWidgets: (widgets) => set({ smartWidgets: normalizeSmartWidgets(widgets) }),
    updateSmartWidget: (id, updated) => set(state => ({
        smartWidgets: state.smartWidgets.map(w => w.id === id ? { ...w, ...updated } : w)
    })),
    reorderSmartWidgets: (fromOrder, toOrder) => set(state => {
        const widgets = [...state.smartWidgets].sort((a, b) => a.order - b.order);
        const fromIdx = widgets.findIndex(w => w.order === fromOrder);
        const toIdx = widgets.findIndex(w => w.order === toOrder);
        if (fromIdx === -1 || toIdx === -1) return {};
        const [removed] = widgets.splice(fromIdx, 1);
        widgets.splice(toIdx, 0, removed);
        return { smartWidgets: widgets.map((w, i) => ({ ...w, order: i })) };
    }),
    smartPadColumns: 4,
    setSmartPadColumns: (cols) => set({ smartPadColumns: Math.max(2, Math.min(8, cols)) }),
    smartEditMode: false,
    setSmartEditMode: (v) => set({ smartEditMode: v }),
    vjShaderMode: "gradient",
    setVjShaderMode: (mode) => set({ vjShaderMode: mode }),
    vjShaderIntensity: 0.72,
    setVjShaderIntensity: (v) => set({ vjShaderIntensity: v }),
    projectionActive: false,
    setProjectionActive: (v) => set({ projectionActive: v }),
    resolumeHost: "127.0.0.1",
    setResolumeHost: (v) => set({ resolumeHost: v }),
    resolumePort: 7000,
    setResolumePort: (v) => set({ resolumePort: v }),
    resolumeLayer: 1,
    setResolumeLayer: (v) => set({ resolumeLayer: v }),
    resolumeClip: 1,
    setResolumeClip: (v) => set({ resolumeClip: v }),
    resolumeOpacity: 1,
    setResolumeOpacity: (v) => set({ resolumeOpacity: v }),
    bpm: 128.0,
    setBpm: (bpm) => set({ bpm }),
    fixtures: [],
    stagePlanHidden: [],
    stagePlanEditMode: false,
    previewMode: false,
    setFixtureGridPosition: (fixtureId, position) => {
        const nextPosition = normalizeStageGridPosition(position);
        const existingFixture = get().fixtures.find((fixture) => String(fixture.nodeId) === fixtureId || String(fixture.id) === fixtureId);
        if (!existingFixture) return;
        const previousPosition = normalizeStageGridPosition(existingFixture.gridPosition);
        if (stageGridPositionsEqual(previousPosition, nextPosition)) return;

        if (!isReplayingHistory()) {
            pushHistory({
                label: `Projecteur deplace: ${existingFixture.name}`,
                coalesceKey: `stage-fixture:${existingFixture.id}`,
                undo: () => set((state) => ({
                    fixtures: state.fixtures.map((fixture) => (
                        fixture.id === existingFixture.id ? { ...fixture, gridPosition: previousPosition } : fixture
                    )),
                })),
                redo: () => set((state) => ({
                    fixtures: state.fixtures.map((fixture) => (
                        fixture.id === existingFixture.id ? { ...fixture, gridPosition: nextPosition } : fixture
                    )),
                })),
            });
        }

        set(state => ({
            fixtures: state.fixtures.map((fixture) => {
                const matches = String(fixture.nodeId) === fixtureId || String(fixture.id) === fixtureId;
                if (!matches) return fixture;
                return { ...fixture, gridPosition: nextPosition };
            }),
        }));

        const saveKey = String(existingFixture.id);
        const previousTimer = stagePlanSaveTimers.get(saveKey);
        if (previousTimer) clearTimeout(previousTimer);
        stagePlanSaveTimers.set(saveKey, setTimeout(() => {
            const fixture = get().fixtures.find((candidate) => String(candidate.id) === saveKey);
            if (!fixture) return;
            void fetch(`${API_BASE}/api/fixtures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: fixture.id,
                    name: fixture.name,
                    manufacturer: fixture.profileId,
                    channels: fixture.channels,
                    startAddress: fixture.startAddress || fixture.start_address,
                    gridPosition: fixture.gridPosition,
                }),
            }).catch((error) => console.error('Failed to save stage plan position', error));
        }, 500));
    },
    addFixtureToPlan: (fixtureId) => {
        const before = get().stagePlanHidden;
        const after = before.filter((id) => id !== fixtureId);
        if (after.length === before.length) return;
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Projecteur ajoute au plan: ${fixtureId}`,
                undo: () => set({ stagePlanHidden: before }),
                redo: () => set({ stagePlanHidden: after }),
            });
        }
        set({ stagePlanHidden: after });
    },
    removeFixtureFromPlan: (fixtureId) => {
        const before = get().stagePlanHidden;
        const after = Array.from(new Set([...before, fixtureId]));
        if (after.length === before.length) return;
        if (!isReplayingHistory()) {
            pushHistory({
                label: `Projecteur retire du plan: ${fixtureId}`,
                undo: () => set({ stagePlanHidden: before }),
                redo: () => set({ stagePlanHidden: after }),
            });
        }
        set({ stagePlanHidden: after });
    },
    setStagePlanEditMode: (enabled) => set({ stagePlanEditMode: enabled }),
    setPreviewMode: (enabled) => {
        const wasEnabled = get().previewMode;
        if (enabled === wasEnabled) return;
        if (enabled) {
            previewSavedGate = dmxEngine.getOutputGate();
            dmxEngine.setOutputGate({ qlcOsc: false, qlcWs: false, artNet: false, usbDmx: false });
        } else if (previewSavedGate) {
            dmxEngine.setOutputGate(previewSavedGate);
            previewSavedGate = null;
        }
        set({ previewMode: enabled });
    },
    fetchFixtures: async () => {
        try {
            const response = await fetch(`${API_BASE}/api/fixtures`);
            if (response.ok) {
                const data = await response.json();
                set({ fixtures: Array.isArray(data) ? data.map(normalizeFixtureRecord) : [] });
            }
        } catch (error) {
            console.error('Failed to fetch fixtures', error);
        }
    },
    triggerSmartPad: (pad) => {
        const { smartActiveScene: activeScene, smartPads: pads, fixtures, masterDimmer } = get();
        const isActive = activeScene === pad.qlcWidget;
        // A9: resolution centralisee du TYPE d'un canal absolu (universe, channel) via les fixtures.
        // Utilisee a la fois pour le crossfade (continuous) et pour le master type-aware (applyMaster).
        const channelType = (universe: number, channel: number): string | undefined => {
            for (const f of fixtures as any[]) {
                const fUniverse = Number(f.universe || 1);
                if (fUniverse !== universe) continue;
                const start = f.start_address || f.startAddress || 1;
                for (const ch of (f.channels || []) as any[]) {
                    if (start + ch.channel - 1 === channel) return ch.type;
                }
            }
            return undefined;
        };

        const deactivatePadDmx = (padToDeactivate: SmartPad) => {
            const dmxValues = padToDeactivate.dmxValues;
            const dmxCommands = padToDeactivate.dmxCommands || [];
            if (!dmxValues && dmxCommands.length === 0) return;
            const intensityChannels = new Set<number>();
            const intensityCommands = new Set<string>();
            fixtures.forEach((f: any) => {
                const universe = Number(f.universe || 1);
                const start = f.start_address || f.startAddress || 1;
                (f.channels || []).forEach((ch: any) => {
                    if (['dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv', 'strobe', 'shutter', 'intensity'].includes(ch.type)) {
                        intensityChannels.add(start + ch.channel - 1);
                        intensityCommands.add(`${universe}:${start + ch.channel - 1}`);
                    }
                });
            });
            Object.keys(dmxValues || {}).forEach((chStr) => {
                const ch = Number(chStr);
                if (intensityChannels.has(ch) || ch === 6 || ch === 7) {
                    dmxEngine.setChannel(1, ch, 0);
                }
            });
            dmxCommands.forEach((command) => {
                if (intensityCommands.size === 0 || intensityCommands.has(`${command.universe}:${command.channel}`)) {
                    dmxEngine.setChannel(command.universe, command.channel, 0);
                }
            });
        };

        if (activeScene !== null && activeScene !== pad.qlcWidget) {
            const prev = pads.find((p) => p.qlcWidget === activeScene);
            if (prev) {
                socket.emit('smart:trigger_scene', { pageId: prev.qlcPage, widgetId: prev.qlcWidget, active: false });
                deactivatePadDmx(prev);
            }
        }

        socket.emit('smart:trigger_scene', { pageId: pad.qlcPage, widgetId: pad.qlcWidget, active: !isActive });

        if (!isActive) {
            // Channel masking (A2 contract): si enabledChannels est defini, n'appliquer QUE ces canaux
            // (les canaux masques gardent leur valeur courante -> comportement "tracking" console).
            // Si enabledChannels est absent/undefined, comportement INCHANGE: tous les canaux s'appliquent.
            const mask = pad.enabledChannels;
            const isChannelEnabled = (channel: number) => mask === undefined || mask.includes(channel);

            // A3 contract: crossfade intelligent. Si fadeSeconds > 0, fondre chaque canal de sa
            // valeur COURANTE vers la valeur cible au lieu d'un snap instantane. Sinon, comportement
            // ACTUEL inchange (set instantane).
            const fadeSeconds = Number((get() as any).fadeSeconds) || 0;

            if (fadeSeconds > 0) {
                const targets: CrossfadeTarget[] = [];
                if (pad.dmxValues) {
                    Object.entries(pad.dmxValues).forEach(([chStr, val]) => {
                        const channel = Number(chStr);
                        if (!isChannelEnabled(channel)) return;
                        const type = channelType(1, channel);
                        targets.push({
                            universe: 1,
                            channel,
                            value: applyMaster(Number(val), type, masterDimmer),
                            continuous: isContinuousChannel(type),
                        });
                    });
                }
                if (pad.dmxCommands) {
                    pad.dmxCommands.forEach((command) => {
                        if (!isChannelEnabled(command.channel)) return;
                        const type = channelType(command.universe, command.channel);
                        targets.push({
                            universe: command.universe,
                            channel: command.channel,
                            value: applyMaster(command.value, type, masterDimmer),
                            continuous: isContinuousChannel(type),
                        });
                    });
                }
                if (targets.length > 0) {
                    startCrossfade(targets, fadeSeconds * 1000);
                }
            } else {
                if (pad.dmxValues) {
                    Object.entries(pad.dmxValues).forEach(([chStr, val]) => {
                        const channel = Number(chStr);
                        if (!isChannelEnabled(channel)) return;
                        dmxEngine.setChannel(1, channel, applyMaster(Number(val), channelType(1, channel), masterDimmer));
                    });
                }
                if (pad.dmxCommands) {
                    pad.dmxCommands.forEach((command) => {
                        if (!isChannelEnabled(command.channel)) return;
                        dmxEngine.setChannel(command.universe, command.channel, applyMaster(command.value, channelType(command.universe, command.channel), masterDimmer));
                    });
                }
            }
        } else {
            deactivatePadDmx(pad);
        }

        set({ smartActiveScene: isActive ? null : pad.qlcWidget });

        const anyGet = get() as any;
        if (anyGet.addToast) {
            anyGet.addToast({
                type: isActive ? 'info' : 'success',
                message: isActive ? 'Scène désactivée' : 'Scène activée',
                detail: pad.name,
                duration: 1800,
            });
        }
    },
});

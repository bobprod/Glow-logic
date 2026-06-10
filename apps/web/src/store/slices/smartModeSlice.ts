import { StateCreator } from 'zustand';
import { API_BASE } from '../../lib/config';
import { socket } from '../../lib/socket';
import { dmxEngine } from '../../lib/dmxEngine';
import type { DmxOutputsConfig, NetworkState, PatchedFixture } from '../../types/dmx';

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
    // MIDI mapping
    midiNote: number;        // 0-127, -1 = not mapped
    midiChannel: number;     // 1-16
    // Grid position
    gridCol: number;
    gridRow: number;
    gridW: number;
    gridH: number;
};

// Widget sections in Smart view
export type SmartWidgetType = 'pads' | 'groupStrips' | 'zoneControls' | 'miniPlaylist' | 'spectro' | 'apcVirtual' | 'stagePlan' | 'vjDeck';

export type SmartWidget = {
    id: SmartWidgetType;
    label: string;
    order: number;
    collapsed: boolean;
    visible: boolean;
};

const DEFAULT_PADS: SmartPad[] = [
    { id: 1, name: 'Blue Ocean', color: 'bg-cyan-500', textColor: 'text-cyan-400', iconName: 'Droplets', qlcPage: 1, qlcWidget: 10, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 0, 8: 150 }, midiNote: 56, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1 },
    { id: 2, name: 'Red Alert', color: 'bg-red-500', textColor: 'text-red-400', iconName: 'Flame', qlcPage: 1, qlcWidget: 11, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 50, 8: 30 }, midiNote: 57, midiChannel: 1, gridCol: 1, gridRow: 0, gridW: 1, gridH: 1 },
    { id: 3, name: 'Neon City', color: 'bg-purple-500', textColor: 'text-purple-400', iconName: 'Zap', qlcPage: 1, qlcWidget: 12, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 0, 8: 90, 9: 80 }, midiNote: 58, midiChannel: 1, gridCol: 2, gridRow: 0, gridW: 1, gridH: 1 },
    { id: 4, name: 'Strobe BPM', color: 'bg-white', textColor: 'text-slate-800', iconName: 'Activity', qlcPage: 1, qlcWidget: 13, dmxValues: { 1: 127, 3: 127, 6: 255, 7: 200, 8: 0 }, midiNote: 59, midiChannel: 1, gridCol: 3, gridRow: 0, gridW: 1, gridH: 1 },
];

const DEFAULT_WIDGETS: SmartWidget[] = [
    { id: 'groupStrips', label: 'Groupes DMX (6 ch)', order: 0, collapsed: false, visible: true },
    { id: 'stagePlan', label: 'Plan de Scène Interactif', order: 1, collapsed: false, visible: true },
    { id: 'pads', label: 'Pads de Scènes', order: 2, collapsed: false, visible: true },
    { id: 'zoneControls', label: 'Contrôles de Zone', order: 3, collapsed: false, visible: true },
    { id: 'vjDeck', label: 'VJ / Mapping / Resolume', order: 4, collapsed: false, visible: true },
    { id: 'miniPlaylist', label: 'Mini Playlist', order: 5, collapsed: true, visible: true },
    { id: 'spectro', label: 'Spectro Audio', order: 6, collapsed: true, visible: true },
    { id: 'apcVirtual', label: 'APC mini Virtuel', order: 7, collapsed: true, visible: true },
];

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
        gridPosition: fixture.gridPosition || {
            x: Number(fixture.x3d || fixture.position?.x || 0),
            y: Number(fixture.y3d || fixture.position?.y || 0),
            z: Number(fixture.z3d || 0),
        },
        totalChannels: Number(fixture.totalChannels || fixture.total_channels || channels.length),
        total_channels: Number(fixture.total_channels || fixture.totalChannels || channels.length),
        color: fixture.color,
        nodeType: fixture.nodeType || fixture.type,
        channels,
    };
}

export interface ZoneMapping {
    name: string;
    fixtures: number[];
}

export interface SmartModeSlice {
    dmxOutputs: DmxOutputsConfig;
    setDmxOutputs: (outputs: Partial<DmxOutputsConfig>) => void;
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
    addSmartPad: (pad: SmartPad) => void;
    updateSmartPad: (id: number, updated: Partial<SmartPad>) => void;
    deleteSmartPad: (id: number) => void;
    reorderSmartPads: (fromId: number, toId: number) => void;
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
    bpm: number;
    setBpm: (bpm: number) => void;
    fixtures: PatchedFixture[];
    fetchFixtures: () => Promise<void>;
    triggerSmartPad: (pad: SmartPad) => void;
}

export const createSmartModeSlice: StateCreator<SmartModeSlice, [], [], SmartModeSlice> = (set, get) => ({
    dmxOutputs: { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false },
    setDmxOutputs: (outputs) => set(state => ({
        dmxOutputs: { ...state.dmxOutputs, ...outputs },
    })),
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
    setSmartPads: (pads) => set({ smartPads: pads }),
    addSmartPad: (pad) => set(state => ({ smartPads: [...state.smartPads, pad] })),
    updateSmartPad: (id, updated) => set(state => ({
        smartPads: state.smartPads.map(p => p.id === id ? { ...p, ...updated } : p)
    })),
    deleteSmartPad: (id) => set(state => ({
        smartPads: state.smartPads.filter(p => p.id !== id)
    })),
    reorderSmartPads: (fromId, toId) => set(state => {
        const pads = [...state.smartPads];
        const fromIdx = pads.findIndex(p => p.id === fromId);
        const toIdx = pads.findIndex(p => p.id === toId);
        if (fromIdx === -1 || toIdx === -1) return {};
        const [removed] = pads.splice(fromIdx, 1);
        pads.splice(toIdx, 0, removed);
        return { smartPads: pads };
    }),
    smartWidgets: DEFAULT_WIDGETS,
    setSmartWidgets: (widgets) => set({ smartWidgets: widgets }),
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
    bpm: 128.0,
    setBpm: (bpm) => set({ bpm }),
    fixtures: [],
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
        const scaleValue = (value: number) => Math.round(Math.max(0, Math.min(255, value)) * (masterDimmer / 255));

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
            if (pad.dmxValues) {
                Object.entries(pad.dmxValues).forEach(([chStr, val]) => {
                    dmxEngine.setChannel(1, Number(chStr), scaleValue(Number(val)));
                });
            }
            if (pad.dmxCommands) {
                pad.dmxCommands.forEach((command) => {
                    dmxEngine.setChannel(command.universe, command.channel, scaleValue(command.value));
                });
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

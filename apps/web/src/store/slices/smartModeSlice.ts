import { StateCreator } from 'zustand';

export type SmartPad = {
    id: number;
    name: string;
    color: string;
    textColor: string;
    iconName: string;
    qlcPage: number;
    qlcWidget: number;
};

const DEFAULT_PADS: SmartPad[] = [
    { id: 1, name: 'Blue Ocean', color: 'bg-cyan-500', textColor: 'text-cyan-400', iconName: 'Droplets', qlcPage: 1, qlcWidget: 10 },
    { id: 2, name: 'Red Alert', color: 'bg-red-500', textColor: 'text-red-400', iconName: 'Flame', qlcPage: 1, qlcWidget: 11 },
    { id: 3, name: 'Neon City', color: 'bg-purple-500', textColor: 'text-purple-400', iconName: 'Zap', qlcPage: 1, qlcWidget: 12 },
    { id: 4, name: 'Strobe BPM', color: 'bg-white', textColor: 'text-slate-800', iconName: 'Activity', qlcPage: 1, qlcWidget: 13 },
];

export interface SmartModeSlice {
    smartBlackout: boolean;
    setSmartBlackout: (v: boolean) => void;
    smartAutoPilot: boolean;
    setSmartAutoPilot: (v: boolean) => void;
    smartActiveScene: number | null;
    setSmartActiveScene: (id: number | null) => void;
    smartZoneValues: Record<string, number>;
    setSmartZoneValue: (zone: string, value: number) => void;
    smartPads: SmartPad[];
    setSmartPads: (pads: SmartPad[]) => void;
    addSmartPad: (pad: SmartPad) => void;
    bpm: number;
    setBpm: (bpm: number) => void;
}

export const createSmartModeSlice: StateCreator<SmartModeSlice, [], [], SmartModeSlice> = (set) => ({
    smartBlackout: false,
    setSmartBlackout: (v: boolean) => set({ smartBlackout: v }),
    smartAutoPilot: false,
    setSmartAutoPilot: (v: boolean) => set({ smartAutoPilot: v }),
    smartActiveScene: null,
    setSmartActiveScene: (id: number | null) => set({ smartActiveScene: id }),
    smartZoneValues: { Master: 100, Stage: 80, Bar: 80, Dancefloor: 80 },
    setSmartZoneValue: (zone: string, value: number) => set(state => ({
        smartZoneValues: { ...state.smartZoneValues, [zone]: value }
    })),
    smartPads: DEFAULT_PADS,
    setSmartPads: (pads: SmartPad[]) => set({ smartPads: pads }),
    addSmartPad: (pad: SmartPad) => set(state => ({ smartPads: [...state.smartPads, pad] })),
    bpm: 128.0,
    setBpm: (bpm: number) => set({ bpm }),
});

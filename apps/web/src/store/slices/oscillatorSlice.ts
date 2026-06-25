import { StateCreator } from 'zustand';
import { DEFAULT_OSC_CONFIG, OscillatorConfig } from '../../lib/oscillatorEngine';

export interface OscillatorAssignment {
    id: string;
    channels: number[];
    config: OscillatorConfig;
    enabled: boolean;
}

export interface OscillatorSlice {
    oscillators: OscillatorAssignment[];
    addOscillator: (channels: number[], config?: Partial<OscillatorConfig>) => string;
    updateOscillatorConfig: (id: string, patch: Partial<OscillatorConfig>) => void;
    setOscillatorEnabled: (id: string, enabled: boolean) => void;
    setOscillatorChannels: (id: string, channels: number[]) => void;
    removeOscillator: (id: string) => void;
}

let oscillatorCounter = 0;

const createOscillatorId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `osc-${crypto.randomUUID()}`;
    }
    oscillatorCounter += 1;
    return `osc-${oscillatorCounter}`;
};

export const createOscillatorSlice: StateCreator<OscillatorSlice, [], [], OscillatorSlice> = (set) => ({
    oscillators: [],
    addOscillator: (channels, config) => {
        const id = createOscillatorId();
        set((state) => ({
            oscillators: [
                ...state.oscillators,
                {
                    id,
                    channels: [...channels],
                    config: { ...DEFAULT_OSC_CONFIG, ...config },
                    enabled: true,
                },
            ],
        }));
        return id;
    },
    updateOscillatorConfig: (id, patch) => set((state) => ({
        oscillators: state.oscillators.map((osc) =>
            osc.id === id ? { ...osc, config: { ...osc.config, ...patch } } : osc,
        ),
    })),
    setOscillatorEnabled: (id, enabled) => set((state) => ({
        oscillators: state.oscillators.map((osc) =>
            osc.id === id ? { ...osc, enabled } : osc,
        ),
    })),
    setOscillatorChannels: (id, channels) => set((state) => ({
        oscillators: state.oscillators.map((osc) =>
            osc.id === id ? { ...osc, channels: [...channels] } : osc,
        ),
    })),
    removeOscillator: (id) => set((state) => ({
        oscillators: state.oscillators.filter((osc) => osc.id !== id),
    })),
});

import { StateCreator } from 'zustand';
import { DEFAULT_PIXELMAP_CONFIG, PixelMapConfig } from '../../lib/pixelMapEngine';

export interface PixelMapSlice {
    pixelMap: { enabled: boolean } & PixelMapConfig;
    /** État UI transitoire — fenêtre/overlay projecteur ouverte. Non persisté. */
    projectorOpen: boolean;
    setPixelMapEnabled: (v: boolean) => void;
    setPixelMapConfig: (patch: Partial<PixelMapConfig>) => void;
    setProjectorOpen: (v: boolean) => void;
}

export const createPixelMapSlice: StateCreator<PixelMapSlice, [], [], PixelMapSlice> = (set) => ({
    pixelMap: { enabled: false, ...DEFAULT_PIXELMAP_CONFIG },
    projectorOpen: false,
    setPixelMapEnabled: (v) => set((state) => ({
        pixelMap: { ...state.pixelMap, enabled: v },
    })),
    setPixelMapConfig: (patch) => set((state) => ({
        pixelMap: { ...state.pixelMap, ...patch },
    })),
    setProjectorOpen: (v) => set(() => ({ projectorOpen: v })),
});

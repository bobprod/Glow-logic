import { StateCreator } from 'zustand';

export interface UISlice {
    appMode: 'smart' | 'creator' | 'live';
    setAppMode: (mode: 'smart' | 'creator' | 'live') => void;
    proView: 'canvas' | 'visualizer';
    setProView: (view: 'canvas' | 'visualizer') => void;
    isTimelineVisible: boolean;
    setIsTimelineVisible: (visible: boolean) => void;
    isSidebarVisible: boolean;
    setIsSidebarVisible: (visible: boolean) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    appMode: 'smart',
    setAppMode: (mode) => set({ appMode: mode }),
    proView: 'canvas',
    setProView: (view) => set({ proView: view }),
    isTimelineVisible: true,
    setIsTimelineVisible: (visible) => set({ isTimelineVisible: visible }),
    isSidebarVisible: true,
    setIsSidebarVisible: (visible) => set({ isSidebarVisible: visible }),
});

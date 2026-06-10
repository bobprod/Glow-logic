import { StateCreator } from 'zustand';

export interface UISlice {
    appMode: 'smart' | 'creator';
    setAppMode: (mode: 'smart' | 'creator') => void;
    proView: 'canvas' | 'visualizer' | 'patch';
    setProView: (view: 'canvas' | 'visualizer' | 'patch') => void;
    isTimelineVisible: boolean;
    setIsTimelineVisible: (visible: boolean) => void;
    isSidebarVisible: boolean;
    setIsSidebarVisible: (visible: boolean) => void;
    selectedFixtureId: string | null;
    setSelectedFixtureId: (id: string | null) => void;
    selectedFixtureIds: string[];
    setSelectedFixtureIds: (ids: string[]) => void;
    isBottomPanelVisible: boolean;
    setIsBottomPanelVisible: (visible: boolean) => void;
    isRightPanelVisible: boolean;
    setIsRightPanelVisible: (visible: boolean) => void;
    activeRightTab: 'ai' | 'scenes' | 'cues';
    setActiveRightTab: (tab: 'ai' | 'scenes' | 'cues') => void;
    showLock: boolean;
    setShowLock: (locked: boolean) => void;
    laserArmed: boolean;
    pyroArmed: boolean;
    setLaserArmed: (armed: boolean) => void;
    setPyroArmed: (armed: boolean) => void;
    setMidiArmed: (type: 'laser' | 'pyro', state: boolean) => void;
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
    selectedFixtureId: null,
    setSelectedFixtureId: (id) => set({ selectedFixtureId: id }),
    selectedFixtureIds: [],
    setSelectedFixtureIds: (ids) => set({ selectedFixtureIds: ids }),
    isBottomPanelVisible: true,
    setIsBottomPanelVisible: (visible) => set({ isBottomPanelVisible: visible }),
    isRightPanelVisible: true,
    setIsRightPanelVisible: (visible) => set({ isRightPanelVisible: visible }),
    activeRightTab: 'ai',
    setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    showLock: false,
    setShowLock: (locked) => set({ showLock: locked }),
    laserArmed: false,
    pyroArmed: false,
    setLaserArmed: (armed) => set({ laserArmed: armed }),
    setPyroArmed: (armed) => set({ pyroArmed: armed }),
    setMidiArmed: (type, armed) => set(type === 'laser' ? { laserArmed: armed } : { pyroArmed: armed }),
});


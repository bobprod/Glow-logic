import { StateCreator } from 'zustand';
import { setHistoryLock } from '../history';

export type AiInspectorLogType = 'sys' | 'ai' | 'warn' | 'osc' | 'info';

export type AiInspectorLogEntry = {
    id: number;
    type: AiInspectorLogType;
    text: string;
};

const DEFAULT_AI_INSPECTOR_LOGS: AiInspectorLogEntry[] = [];

let showLockBeforeLivePerformance = false;

export interface UISlice {
    smartSidebarPanel: 'widgets' | 'inspector' | 'library' | 'aiInspector' | 'aiLight';
    setSmartSidebarPanel: (panel: 'widgets' | 'inspector' | 'library' | 'aiInspector' | 'aiLight') => void;
    openTool: 'diagnostic' | 'preflight' | 'recovery' | null;
    setOpenTool: (tool: 'diagnostic' | 'preflight' | 'recovery' | null) => void;
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
    selectFixture: (id: string | null, options?: { openInspector?: boolean }) => void;
    // Source de vérité unique pour la sélection : ces helpers évitent que chaque
    // appelant (3D, plan, canvas, patch) ré-implémente sa propre logique toggle/clear.
    toggleFixtureSelection: (id: string, additive?: boolean) => void;
    clearFixtureSelection: () => void;
    selectedStageGroup: string | null;
    setSelectedStageGroup: (group: string | null) => void;
    isBottomPanelVisible: boolean;
    setIsBottomPanelVisible: (visible: boolean) => void;
    isRightPanelVisible: boolean;
    setIsRightPanelVisible: (visible: boolean) => void;
    activeRightTab: 'scenes' | 'cues';
    setActiveRightTab: (tab: 'scenes' | 'cues') => void;
    showLock: boolean;
    setShowLock: (locked: boolean) => void;
    livePerformanceMode: boolean;
    setLivePerformanceMode: (on: boolean) => void;
    // Source de vérité UNIQUE pour "scène en live / lecture-seule".
    // Aujourd'hui dérivée directement de livePerformanceMode (le flag pivot),
    // mais centralisée ici pour que SceneController/GroupStrips ne dépendent
    // plus de props locales concurrentes (variant="performance", performanceMode, readonly).
    isLive: boolean;
    laserArmed: boolean;
    pyroArmed: boolean;
    setLaserArmed: (armed: boolean) => void;
    setPyroArmed: (armed: boolean) => void;
    setMidiArmed: (type: 'laser' | 'pyro', state: boolean) => void;
    timelineHeight: number;
    setTimelineHeight: (height: number) => void;
    snapEnabled: boolean;
    setSnapEnabled: (enabled: boolean) => void;
    bpmGridVisible: boolean;
    setBpmGridVisible: (visible: boolean) => void;
    fadeSeconds: number;
    setFadeSeconds: (seconds: number) => void;
    effectSpeed: number;
    setEffectSpeed: (v: number) => void;
    focusMode: boolean;
    setFocusMode: (v: boolean) => void;
    aiInspectorLogs: AiInspectorLogEntry[];
    addAiInspectorLog: (type: AiInspectorLogType, text: string) => void;
    clearAiInspectorLogs: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    smartSidebarPanel: 'widgets',
    setSmartSidebarPanel: (panel) => set({ smartSidebarPanel: panel }),
    openTool: null,
    setOpenTool: (tool) => set({ openTool: tool }),
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
    selectFixture: (id, options) => set(id ? {
        selectedFixtureId: id,
        selectedFixtureIds: [id],
        selectedStageGroup: null,
        // N'ouvre/ne bascule la sidebar que si l'appelant le demande explicitement
        // (ex: la sidebar Smart). Le canvas, la 3D et le FixtureController gardent
        // leur propre surface sans forcer l'inspecteur — corrige le panneau parametre
        // qui disparaissait en mode Creator.
        ...(options?.openInspector ? { smartSidebarPanel: 'inspector' as const, isSidebarVisible: true } : {}),
    } : {
        selectedFixtureId: null,
        selectedFixtureIds: [],
        selectedStageGroup: null,
    }),
    toggleFixtureSelection: (id, additive = true) => set((state) => {
        // Mode additif (Shift/Ctrl) : ajoute/retire `id` de la sélection partagée.
        if (additive) {
            const exists = state.selectedFixtureIds.includes(id);
            const nextIds = exists
                ? state.selectedFixtureIds.filter((existing) => existing !== id)
                : [...state.selectedFixtureIds, id];
            return {
                selectedFixtureIds: nextIds,
                // Garde selectedFixtureId synchronisé (dernier sélectionné, ou null si vide).
                selectedFixtureId: nextIds.length ? nextIds[nextIds.length - 1] : null,
                selectedStageGroup: null,
            };
        }
        // Mode simple : la sélection devient uniquement cette fixture.
        return {
            selectedFixtureId: id,
            selectedFixtureIds: [id],
            selectedStageGroup: null,
        };
    }),
    clearFixtureSelection: () => set({
        selectedFixtureId: null,
        selectedFixtureIds: [],
        selectedStageGroup: null,
    }),
    selectedStageGroup: null,
    setSelectedStageGroup: (group) => set({ selectedStageGroup: group }),
    isBottomPanelVisible: true,
    setIsBottomPanelVisible: (visible) => set({ isBottomPanelVisible: visible }),
    isRightPanelVisible: true,
    setIsRightPanelVisible: (visible) => set({ isRightPanelVisible: visible }),
    activeRightTab: 'scenes',
    setActiveRightTab: (tab) => set({ activeRightTab: tab }),
    showLock: false,
    setShowLock: (locked) => {
        setHistoryLock(locked);
        set({ showLock: locked });
    },
    livePerformanceMode: false,
    // isLive reste synchronisé avec livePerformanceMode (même valeur).
    // On le maintient comme champ stocké plutôt que getter pour rester
    // compatible avec les sélecteurs Zustand simples (s) => s.isLive.
    isLive: false,
    setLivePerformanceMode: (on) => set((state) => {
        if (on) {
            showLockBeforeLivePerformance = state.showLock;
            setHistoryLock(true);
            return { livePerformanceMode: true, isLive: true, showLock: true };
        }
        setHistoryLock(showLockBeforeLivePerformance);
        return { livePerformanceMode: false, isLive: false, showLock: showLockBeforeLivePerformance };
    }),
    laserArmed: false,
    pyroArmed: false,
    setLaserArmed: (armed) => set({ laserArmed: armed }),
    setPyroArmed: (armed) => set({ pyroArmed: armed }),
    setMidiArmed: (type, armed) => set(type === 'laser' ? { laserArmed: armed } : { pyroArmed: armed }),
    timelineHeight: 288,
    setTimelineHeight: (height) => set({ timelineHeight: Math.max(120, Math.min(600, height)) }),
    snapEnabled: false,
    setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
    bpmGridVisible: false,
    setBpmGridVisible: (visible) => set({ bpmGridVisible: visible }),
    fadeSeconds: 0,
    setFadeSeconds: (seconds) => set({ fadeSeconds: Math.max(0, Number.isFinite(seconds) ? seconds : 0) }),
    effectSpeed: 1,
    setEffectSpeed: (v) => set({ effectSpeed: Math.max(0.1, Math.min(8, Number.isFinite(v) ? v : 1)) }),
    focusMode: false,
    setFocusMode: (v) => set({ focusMode: v }),
    aiInspectorLogs: DEFAULT_AI_INSPECTOR_LOGS,
    addAiInspectorLog: (type, text) => set((state) => {
        const nextId = state.aiInspectorLogs.reduce((max, log) => Math.max(max, log.id), 0) + 1;
        return {
            aiInspectorLogs: [
                ...state.aiInspectorLogs.slice(-49),
                { id: nextId, type, text },
            ],
        };
    }),
    clearAiInspectorLogs: () => set({ aiInspectorLogs: [] }),
});

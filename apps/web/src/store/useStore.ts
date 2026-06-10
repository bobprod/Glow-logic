import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createUISlice, UISlice } from "./slices/uiSlice";
import { createMidiSlice, MidiSlice, MidiMapping } from "./slices/midiSlice";
import {
  createSmartModeSlice,
  SmartModeSlice,
  SmartPad,
  SmartWidget,
  SmartWidgetType,
} from "./slices/smartModeSlice";
import { createReactFlowSlice, ReactFlowSlice } from "./slices/reactFlowSlice";
import { createProjectSlice, ProjectSlice } from "./slices/projectSlice";
import { createTimelineSlice, TimelineSlice } from "./slices/timelineSlice";
import { createToastSlice, ToastSlice } from "./slices/toastSlice";
import { createShowPlayerSlice, ShowPlayerSlice } from "./slices/showPlayerSlice";

type StoreState = UISlice &
  MidiSlice &
  SmartModeSlice &
  ReactFlowSlice &
  ProjectSlice &
  TimelineSlice &
  ToastSlice &
  ShowPlayerSlice;

const useStore = create<StoreState>()(
  persist(
    (set, get, api) => ({
      ...createUISlice(set, get, api),
      ...createMidiSlice(set, get, api),
      ...createSmartModeSlice(set, get, api),
      ...createReactFlowSlice(set, get, api),
      ...createProjectSlice(set, get, api),
      ...createTimelineSlice(set, get, api),
      ...createToastSlice(set, get, api),
      ...createShowPlayerSlice(set, get, api),
    }),
    {
      name: "glow-logic-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        appMode: state.appMode,
        proView: state.proView,
        showLock: state.showLock,
        laserArmed: state.laserArmed,
        pyroArmed: state.pyroArmed,
        dmxOutputs: state.dmxOutputs,
        networkState: state.networkState,
        smartBlackout: state.smartBlackout,
        blackout: state.blackout,
        masterDimmer: state.masterDimmer,
        smartAutoPilot: state.smartAutoPilot,
        smartActiveScene: state.smartActiveScene,
        smartZoneValues: state.smartZoneValues,
        smartZoneMappings: state.smartZoneMappings,
        smartPads: state.smartPads,
        smartWidgets: state.smartWidgets,
        smartPadColumns: state.smartPadColumns,
        midiMappings: state.midiMappings,
        currentProjectName: state.currentProjectName,
        clips: state.clips,
        markers: state.markers,
        automationTracks: state.automationTracks,
        duration: state.duration,
        zoom: state.zoom,
        viewStart: state.viewStart,
        playlist: state.playlist,
        groupLevels: state.groupLevels,
        groupMutes: state.groupMutes,
        groupColors: state.groupColors,
        masterVolume: state.masterVolume,
        audioSource: state.audioSource,
      }),
      onRehydrateStorage: () => (rehydratedState) => {
        if (!rehydratedState) return;
        if (rehydratedState.appMode !== 'smart' && rehydratedState.appMode !== 'creator') {
          rehydratedState.appMode = 'smart';
        }
        const CORE_VISIBLE = ['groupStrips', 'stagePlan', 'pads', 'zoneControls'];
        const ALWAYS_VISIBLE = ['vjDeck', 'miniPlaylist', 'spectro', 'apcVirtual'];
        const existingWidgets = Array.isArray(rehydratedState.smartWidgets) ? rehydratedState.smartWidgets : [];
        const fixed = existingWidgets.map((w: any) => {
          if (CORE_VISIBLE.includes(w.id)) {
            return { ...w, visible: true, collapsed: false };
          }
          if (ALWAYS_VISIBLE.includes(w.id)) {
            return { ...w, visible: true };
          }
          return w;
        });
        if (!fixed.some((w: any) => w.id === 'vjDeck')) {
          fixed.push({
            id: 'vjDeck',
            label: 'VJ / Mapping / Resolume',
            order: fixed.length,
            collapsed: false,
            visible: true,
          });
        }
        rehydratedState.smartWidgets = fixed.map((w: any, index: number) => ({ ...w, order: index }));
        rehydratedState.blackout = Boolean(rehydratedState.blackout ?? rehydratedState.smartBlackout ?? false);
        rehydratedState.smartBlackout = rehydratedState.blackout;
        rehydratedState.masterDimmer = Math.max(0, Math.min(255, Number(rehydratedState.masterDimmer ?? 255)));
        rehydratedState.laserArmed = Boolean(rehydratedState.laserArmed ?? false);
        rehydratedState.pyroArmed = Boolean(rehydratedState.pyroArmed ?? false);
      },
    },
  ),
);

export default useStore;
export type { SmartPad, SmartWidget, SmartWidgetType, MidiMapping };
export type { TimelineClip } from "./slices/timelineSlice";
export type { Toast, ToastType } from "./slices/toastSlice";
export type {
  AutomationTrackContract,
  DmxChannel,
  DmxOutputsConfig,
  FixtureProfile,
  Keyframe,
  MediaClip,
  NetworkState,
  PatchedFixture,
  TimelineProject,
} from "../types/show";

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
  VjShaderMode,
  migratePadMidiMappings,
  normalizeSmartPads,
  normalizeSmartWidgets,
} from "./slices/smartModeSlice";
import { createReactFlowSlice, ReactFlowSlice } from "./slices/reactFlowSlice";
import { createProjectSlice, ProjectSlice } from "./slices/projectSlice";
import { createTimelineSlice, TimelineSlice } from "./slices/timelineSlice";
import { createToastSlice, ToastSlice } from "./slices/toastSlice";
import { createShowPlayerSlice, migrateGroupState, ShowPlayerSlice } from "./slices/showPlayerSlice";
import { createOscillatorSlice, OscillatorSlice } from "./slices/oscillatorSlice";
import { createPixelMapSlice, PixelMapSlice } from "./slices/pixelMapSlice";

type StoreState = UISlice &
  MidiSlice &
  SmartModeSlice &
  ReactFlowSlice &
  ProjectSlice &
  TimelineSlice &
  ToastSlice &
  ShowPlayerSlice &
  OscillatorSlice &
  PixelMapSlice;

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
      ...createOscillatorSlice(set, get, api),
      ...createPixelMapSlice(set, get, api),
    }),
    {
      name: "glow-logic-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        appMode: state.appMode,
        proView: state.proView,
        designStep: state.designStep,
        smartSidebarPanel: state.smartSidebarPanel,
        showLock: state.showLock,
        timelineHeight: state.timelineHeight,
        snapEnabled: state.snapEnabled,
        bpmGridVisible: state.bpmGridVisible,
        fadeSeconds: state.fadeSeconds,
        effectSpeed: state.effectSpeed,
        focusMode: state.focusMode,
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
        activePadPage: state.activePadPage,
        smartPadViewMode: state.smartPadViewMode,
        stagePlanHidden: state.stagePlanHidden,
        midiMappings: state.midiMappings,
        currentProjectName: state.currentProjectName,
        clips: state.clips,
        markers: state.markers,
        automationTracks: state.automationTracks,
        duration: state.duration,
        zoom: state.zoom,
        viewStart: state.viewStart,
        playlist: state.playlist,
        dmxGroups: state.dmxGroups,
        groupPresets: state.groupPresets,
        groupLevels: state.groupLevels,
        groupMutes: state.groupMutes,
        groupColors: state.groupColors,
        masterVolume: state.masterVolume,
        audioSource: state.audioSource,
        vjShaderMode: state.vjShaderMode,
        vjShaderIntensity: state.vjShaderIntensity,
        projectionActive: state.projectionActive,
        resolumeHost: state.resolumeHost,
        resolumePort: state.resolumePort,
        resolumeLayer: state.resolumeLayer,
        resolumeClip: state.resolumeClip,
        resolumeOpacity: state.resolumeOpacity,
        oscillators: state.oscillators,
        pixelMap: state.pixelMap,
      }),
      onRehydrateStorage: () => (rehydratedState) => {
        if (!rehydratedState) return;
        if (rehydratedState.appMode !== 'smart' && rehydratedState.appMode !== 'creator') {
          rehydratedState.appMode = 'smart';
        }
        const persistedSidebarPanel = rehydratedState.smartSidebarPanel as unknown;
        if (persistedSidebarPanel === 'scenes') {
          rehydratedState.smartSidebarPanel = 'widgets';
        }
        if (!['widgets', 'inspector', 'library', 'aiInspector', 'aiLight'].includes(String(persistedSidebarPanel))) {
          rehydratedState.smartSidebarPanel = 'widgets';
        }
        rehydratedState.openTool = null;
        rehydratedState.livePerformanceMode = false;
        rehydratedState.smartPads = normalizeSmartPads(rehydratedState.smartPads);
        rehydratedState.midiMappings = migratePadMidiMappings(rehydratedState.midiMappings, rehydratedState.smartPads);
        rehydratedState.smartWidgets = normalizeSmartWidgets(rehydratedState.smartWidgets);
        rehydratedState.activePadPage = Math.max(0, Math.min(3, Number(rehydratedState.activePadPage ?? 0)));
        rehydratedState.smartPadViewMode = rehydratedState.smartPadViewMode === 'midi' ? 'midi' : 'visual';
        rehydratedState.stagePlanHidden = Array.isArray(rehydratedState.stagePlanHidden)
          ? rehydratedState.stagePlanHidden.map(String)
          : [];
        rehydratedState.stagePlanEditMode = false;
        rehydratedState.previewMode = false;
        Object.assign(rehydratedState, migrateGroupState({
          dmxGroups: rehydratedState.dmxGroups,
          groupLevels: rehydratedState.groupLevels,
          groupMutes: rehydratedState.groupMutes,
          groupColors: rehydratedState.groupColors,
          groupPresets: rehydratedState.groupPresets,
        }));
        const blackoutActive = Boolean(rehydratedState.blackout || rehydratedState.smartBlackout);
        rehydratedState.blackout = blackoutActive;
        rehydratedState.smartBlackout = blackoutActive;
        rehydratedState.masterDimmer = Math.max(0, Math.min(255, Number(rehydratedState.masterDimmer ?? 255)));
        rehydratedState.dmxOutputs = {
          qlcOsc: Boolean(rehydratedState.dmxOutputs?.qlcOsc ?? true),
          qlcWs: Boolean(rehydratedState.dmxOutputs?.qlcWs ?? false),
          artNet: Boolean(rehydratedState.dmxOutputs?.artNet ?? true),
          usbDmx: Boolean(rehydratedState.dmxOutputs?.usbDmx ?? false),
        };
        rehydratedState.laserArmed = Boolean(rehydratedState.laserArmed ?? false);
        rehydratedState.pyroArmed = Boolean(rehydratedState.pyroArmed ?? false);
        rehydratedState.snapEnabled = Boolean(rehydratedState.snapEnabled ?? false);
        rehydratedState.bpmGridVisible = Boolean(rehydratedState.bpmGridVisible ?? false);
      },
    },
  ),
);

export default useStore;
export type { SmartPad, SmartWidget, SmartWidgetType, VjShaderMode, MidiMapping };
export type { DmxGroup, GroupPreset } from "./slices/showPlayerSlice";
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
} from "../types/dmx";

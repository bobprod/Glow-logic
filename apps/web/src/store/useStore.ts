import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createUISlice, UISlice } from "./slices/uiSlice";
import { createMidiSlice, MidiSlice, MidiMapping } from "./slices/midiSlice";
import {
  createSmartModeSlice,
  SmartModeSlice,
  SmartPad,
} from "./slices/smartModeSlice";
import { createReactFlowSlice, ReactFlowSlice } from "./slices/reactFlowSlice";
import { createProjectSlice, ProjectSlice } from "./slices/projectSlice";
import { createTimelineSlice, TimelineSlice } from "./slices/timelineSlice";
import { createToastSlice, ToastSlice } from "./slices/toastSlice";
import { createPatchSlice, PatchSlice } from "./slices/patchSlice";
import { createAISlice, AISlice } from "./slices/aiSlice";

type StoreState = UISlice &
  MidiSlice &
  SmartModeSlice &
  ReactFlowSlice &
  ProjectSlice &
  TimelineSlice &
  ToastSlice &
  PatchSlice &
  AISlice;

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
      ...createPatchSlice(set, get, api),
      ...createAISlice(set, get, api),
    }),
    {
      name: "glow-logic-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        appMode: state.appMode,
        proView: state.proView,
        smartBlackout: state.smartBlackout,
        smartAutoPilot: state.smartAutoPilot,
        smartActiveScene: state.smartActiveScene,
        smartZoneValues: state.smartZoneValues,
        smartPads: state.smartPads,
        midiMappings: state.midiMappings,
        currentProjectName: state.currentProjectName,
        clips: state.clips,
        markers: state.markers,
        duration: state.duration,
        zoom: state.zoom,
        viewStart: state.viewStart,
      }),
    },
  ),
);

export default useStore;
export type { SmartPad, MidiMapping };
export type { TimelineClip } from "./slices/timelineSlice";
export type { Toast, ToastType } from "./slices/toastSlice";
export type { PatchedFixture } from "./slices/patchSlice";
export type { AIDropEffect, AIGroupConfig } from "./slices/aiSlice";

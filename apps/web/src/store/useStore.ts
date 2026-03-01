import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createMidiSlice, MidiSlice, MidiMapping } from './slices/midiSlice';
import { createSmartModeSlice, SmartModeSlice, SmartPad } from './slices/smartModeSlice';
import { createReactFlowSlice, ReactFlowSlice } from './slices/reactFlowSlice';

type StoreState = UISlice & MidiSlice & SmartModeSlice & ReactFlowSlice;

const useStore = create<StoreState>()(
    persist(
        (set, get, api) => ({
            ...createUISlice(set, get, api),
            ...createMidiSlice(set, get, api),
            ...createSmartModeSlice(set, get, api),
            ...createReactFlowSlice(set, get, api),
        }),
        {
            name: 'glow-logic-storage',
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
            }),
        }
    )
);

export default useStore;
export type { SmartPad, MidiMapping };

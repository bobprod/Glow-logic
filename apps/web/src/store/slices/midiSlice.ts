import { StateCreator } from 'zustand';

export interface MidiMapping {
    type: number;   // 144 (Note On), 176 (CC)
    channel: number;
    data1: number;  // note or cc number
}

export interface MidiSlice {
    midiLearnMode: boolean;
    setMidiLearnMode: (active: boolean) => void;
    midiLearnActiveControl: string | null;
    setMidiLearnActiveControl: (controlId: string | null) => void;
    midiMappings: Record<string, MidiMapping>;
    setMidiMapping: (controlId: string, mapping: MidiMapping) => void;
    removeMidiMapping: (controlId: string) => void;
}

export const createMidiSlice: StateCreator<MidiSlice, [], [], MidiSlice> = (set) => ({
    midiLearnMode: false,
    setMidiLearnMode: (active: boolean) => set({ midiLearnMode: active, midiLearnActiveControl: null }),
    midiLearnActiveControl: null,
    setMidiLearnActiveControl: (controlId: string | null) => set({ midiLearnActiveControl: controlId }),
    midiMappings: {},
    setMidiMapping: (controlId: string, mapping: MidiMapping) => set(state => ({
        midiMappings: { ...state.midiMappings, [controlId]: mapping },
        midiLearnActiveControl: null // deselect after mapping
    })),
    removeMidiMapping: (controlId: string) => set(state => {
        const newMappings = { ...state.midiMappings };
        delete newMappings[controlId];
        return { midiMappings: newMappings };
    }),
});

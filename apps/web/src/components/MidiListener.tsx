/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect } from 'react';
import useStore from '../store/useStore';
import { socket } from '../lib/socket';

export default function MidiListener() {
    useEffect(() => {
        let midiAccess: any = null;
        // Keep track of outputs for feedback
        let midiOutputs: any[] = [];

        const updateLEDFeedback = (state: any) => {
            if (!midiOutputs || midiOutputs.length === 0) return;

            const activeScene = state.smartActiveScene;
            const mappings = state.midiMappings;

            // Loop through mappings
            for (const [controlId, mapping] of Object.entries(mappings)) {
                if (controlId.startsWith('pad_') && (mapping as any).type === 144) {
                    const padId = parseInt(controlId.split('_')[1]);
                    const pad = state.smartPads.find((p: any) => p.id === padId);

                    if (pad) {
                        const isActive = activeScene === pad.qlcWidget;
                        // For Akai APC mini: 0=Off, 1=Green, 3=Red, 5=Yellow
                        const velocity = isActive ? 1 : 0;

                        midiOutputs.forEach((output: any) => {
                            output.send([144, (mapping as any).data1, velocity]);
                        });
                    }
                }
            }
        };

        let unsubscribeStore: (() => void) | null = null;

        const onMIDISuccess = (access: any) => {
            midiAccess = access;
            for (const input of access.inputs.values()) {
                input.onmidimessage = getMIDIMessage;
            }

            midiOutputs = Array.from(access.outputs.values());

            // Initial feedback
            setTimeout(() => updateLEDFeedback(useStore.getState()), 500);

            // Subscribe to store changes to update LEDs
            unsubscribeStore = useStore.subscribe((state) => {
                updateLEDFeedback(state);
            });
        };

        const onMIDIFailure = () => {
            console.warn("L'accès au MIDI a échoué.");
        };

        const getMIDIMessage = (midiMessage: any) => {
            const [command, noteOffset, velocityOffset] = midiMessage.data;
            const channel = command & 0x0F;
            const type = command & 0xF0;
            const data1 = noteOffset;
            const data2 = velocityOffset;

            // 144 = Note On, 176 = CC
            if (type !== 144 && type !== 176) return;

            const state = useStore.getState();

            // --- MIDI LEARN MODE ---
            if (state.midiLearnMode && state.midiLearnActiveControl) {
                // Ignore note offs (velocity 0) for mapping
                if (type === 144 && data2 === 0) return;

                state.setMidiMapping(state.midiLearnActiveControl, {
                    type,
                    channel,
                    data1
                });
                state.setMidiLearnActiveControl(null); // Deselect after map
                return;
            }

            // --- PLAY MODE ---
            const currentMappings = state.midiMappings;
            let targetControlId: string | null = null;

            for (const [controlId, mapping] of Object.entries(currentMappings)) {
                if ((mapping as any).type === type && (mapping as any).channel === channel && (mapping as any).data1 === data1) {
                    targetControlId = controlId;
                    break;
                }
            }

            if (!targetControlId) return;

            // Actions function mapping
            if (targetControlId.startsWith('pad_')) {
                if (type === 144 && data2 > 0) { // Note On & Velocity > 0
                    const padId = parseInt(targetControlId.split('_')[1]);
                    const pad = state.smartPads.find((p: any) => p.id === padId);
                    if (pad) {
                        const currentActive = state.smartActiveScene;
                        const isActive = currentActive === pad.qlcWidget;
                        if (pad.qlcWidget && socket) {
                            socket.emit('smart:trigger_scene', { pageId: pad.qlcPage || 1, widgetId: pad.qlcWidget, active: !isActive });
                        }
                        state.setSmartActiveScene(!isActive && pad.qlcWidget ? pad.qlcWidget : null);
                    }
                }
            } else if (targetControlId.startsWith('fader_')) {
                if (type === 176) { // CC
                    const zoneName = targetControlId.replace('fader_', '');
                    const percent = Math.round((data2 / 127) * 100);
                    state.setSmartZoneValue(zoneName, percent);

                    let zoneId = 0;
                    if (zoneName === 'Master') zoneId = 1;
                    if (zoneName === 'Stage') zoneId = 2;
                    if (zoneName === 'Dancefloor') zoneId = 4;

                    if (zoneId && socket) {
                        const val255 = Math.round((percent / 100) * 255);
                        socket.emit('smart:zone_intensity', { zoneId, value: val255 });
                    }
                }
            } else if (targetControlId === 'crossfader_main') {
                if (type === 176) { // CC
                    const percent = Math.round((data2 / 127) * 100);
                    // Emit value to websocket directly
                    if (socket) {
                        socket.emit('smart:crossfader', { value: percent });
                    }
                }
            } else if (targetControlId === 'topbar_blackout') {
                if (type === 144 && data2 > 0) { // Note On / CC Button mapping
                    const isActive = !state.smartBlackout;
                    state.setSmartBlackout(isActive);
                    if (socket) {
                        socket.emit('smart:blackout', { active: isActive });
                    }
                }
            } else if (targetControlId === 'topbar_autopilot') {
                if (type === 144 && data2 > 0) {
                    const isActive = !state.smartAutoPilot;
                    state.setSmartAutoPilot(isActive);
                    if (socket) {
                        // socket.emit('smart:autopilot', { active: isActive });
                        // Add server listener support in your backend to handle smart:autopilot if needed
                    }
                }
            }
        };

        const nav = navigator as any;
        if (nav.requestMIDIAccess) {
            nav.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        } else {
            console.warn("Web MIDI API non supporté par ce navigateur.");
        }

        return () => {
            if (unsubscribeStore) unsubscribeStore();
            if (midiAccess) {
                for (const input of midiAccess.inputs.values()) {
                    input.onmidimessage = null;
                }
            }
        };
    }, []);

    return null;
}

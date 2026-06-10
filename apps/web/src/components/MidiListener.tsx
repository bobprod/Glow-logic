 
"use client";

import { useEffect } from "react";
import useStore from "../store/useStore";
import { socket } from "../lib/socket";

export default function MidiListener() {
  useEffect(() => {
    let midiAccess: any = null;
    // Keep track of outputs for feedback
    let midiOutputs: any[] = [];

    // Load controller profile for LED colors
    let ledColors: Record<string, number> = {
      off: 0,
      green: 1,
      red: 3,
      yellow: 5,
    };
    try {
      const midiCfg = JSON.parse(
        localStorage.getItem("glowlogic_midi") ?? "{}",
      );
      if (midiCfg.controllerId) {
        // Known profiles LED colors
        const profiles: Record<string, Record<string, number>> = {
          "akai-apc-mini": {
            off: 0,
            green: 1,
            "green-blink": 2,
            red: 3,
            "red-blink": 4,
            yellow: 5,
          },
          "akai-apc-40": { off: 0, green: 1, red: 3, yellow: 5 },
          "novation-launchpad-mini": {
            off: 12,
            red: 15,
            green: 60,
            yellow: 62,
            amber: 63,
          },
          "novation-launch-control-xl": {
            off: 12,
            red: 15,
            green: 60,
            yellow: 62,
          },
          "arturia-minilab": { off: 0, on: 127 },
          "behringer-x-touch-mini": { off: 0, on: 127 },
        };
        if (profiles[midiCfg.controllerId]) {
          ledColors = profiles[midiCfg.controllerId];
        }
      }
    } catch {
      /* ignore */
    }

    const getActiveColor = () => ledColors["green"] ?? ledColors["on"] ?? 1;
    const getOffColor = () => ledColors["off"] ?? 0;
    
    // MIDI Clock state
    let clockTicks = 0;
    let lastClockTime = 0;
    const clockIntervals: number[] = [];

    const updateLEDFeedback = (state: any) => {
      if (!midiOutputs || midiOutputs.length === 0) return;

      const activeScene = state.smartActiveScene;
      const mappings = state.midiMappings;

      // 1. Update standard learned mappings
      for (const [controlId, mapping] of Object.entries(mappings)) {
        if (controlId.startsWith("pad_") && (mapping as any).type === 144) {
          const padId = parseInt(controlId.split("_")[1]);
          const pad = state.smartPads.find((p: any) => p.id === padId);

          if (pad) {
            const isActive = activeScene === pad.qlcWidget;
            const velocity = isActive ? getActiveColor() : getOffColor();

            midiOutputs.forEach((output: any) => {
              output.send([144, (mapping as any).data1, velocity]);
            });
          }
        }
      }

      // 2. Auto feedback for AKAI APC mini mutes (Note 64-69)
      const groupMutes = state.groupMutes || {};
      const groups = ['Face', 'Douche 1', 'Douche 2', 'Douche 3', 'Latéral', 'Contre'];
      
      groups.forEach((g, idx) => {
        const isMuted = groupMutes[g] === true;
        const note = 64 + idx; 
        const velocity = isMuted ? 3 : 1; 
        
        midiOutputs.forEach((output: any) => {
          output.send([144, note, velocity]);
        });
      });
    };

    let unsubscribeStore: (() => void) | null = null;

    const onMIDISuccess = (access: any) => {
      midiAccess = access;
      for (const input of access.inputs.values()) {
        input.onmidimessage = (msg: any) => getMIDIMessage(msg, input.name);
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

    const getMIDIMessage = (midiMessage: any, deviceName: string = "") => {
      const data = midiMessage.data;
      if (!data || data.length === 0) return;

      const command = data[0];

      // --- MIDI CLOCK (Timing Clock = 0xF8) ---
      if (command === 0xF8) {
        const now = performance.now();
        if (lastClockTime > 0) {
          const diff = now - lastClockTime;
          if (diff > 5 && diff < 300) {
            clockIntervals.push(diff);
            if (clockIntervals.length > 48) clockIntervals.shift();
            
            clockTicks++;
            if (clockTicks % 24 === 0) {
              const avgInterval = clockIntervals.reduce((a, b) => a + b, 0) / clockIntervals.length;
              const calculatedBpm = Math.round(60000 / (avgInterval * 24));
              if (calculatedBpm >= 40 && calculatedBpm <= 240) {
                useStore.getState().setBpm(calculatedBpm);
              }
            }
          }
        }
        lastClockTime = now;
        return;
      }

      const type = command & 0xf0;
      const channel = command & 0x0f;
      
      if (type !== 144 && type !== 176) return;

      const data1 = data[1];
      const data2 = data[2];
      const state = useStore.getState();

      const isApcMini = deviceName.toLowerCase().includes("apc") || deviceName.toLowerCase().includes("akai");

      // --- AKAI APC MINI AUTO-MAP ROUTING ---
      if (isApcMini) {
        if (type === 176 && data1 >= 48 && data1 <= 56) {
          const percent = Math.round((data2 / 127) * 100);
          
          if (data1 === 48) state.setGroupLevel('Face', percent);
          else if (data1 === 49) state.setGroupLevel('Douche 1', percent);
          else if (data1 === 50) state.setGroupLevel('Douche 2', percent);
          else if (data1 === 51) state.setGroupLevel('Douche 3', percent);
          else if (data1 === 52) state.setGroupLevel('Latéral', percent);
          else if (data1 === 53) state.setGroupLevel('Contre', percent);
          else if (data1 === 55) {
            state.setSmartZoneValue('Master', percent);
            if (socket) socket.emit("smart:zone_intensity", { zoneId: 1, value: Math.round((percent/100)*255) });
          }
          return;
        }

        if (type === 144 && data2 > 0 && data1 >= 64 && data1 <= 71) {
          const groups = ['Face', 'Douche 1', 'Douche 2', 'Douche 3', 'Latéral', 'Contre'];
          const groupIdx = data1 - 64;
          if (groupIdx >= 0 && groupIdx < groups.length) {
            const g = groups[groupIdx];
            const currentMute = state.groupMutes[g] === true;
            state.setGroupMute(g, !currentMute);
            return;
          }
        }
      }

      // --- MIDI LEARN MODE ---
      if (state.midiLearnMode && state.midiLearnActiveControl) {
        if (type === 144 && data2 === 0) return;

        state.setMidiMapping(state.midiLearnActiveControl, {
          type,
          channel,
          data1,
        });
        state.setMidiLearnActiveControl(null);
        return;
      }

      // --- PLAY MODE ---
      const currentMappings = state.midiMappings;
      let targetControlId: string | null = null;

      for (const [controlId, mapping] of Object.entries(currentMappings)) {
        if (
          (mapping as any).type === type &&
          (mapping as any).channel === channel &&
          (mapping as any).data1 === data1
        ) {
          targetControlId = controlId;
          break;
        }
      }

      if (!targetControlId) return;

      if (targetControlId.startsWith("pad_")) {
        if (type === 144 && data2 > 0) {
          const padId = parseInt(targetControlId.split("_")[1]);
          const pad = state.smartPads.find((p: any) => p.id === padId);
          if (pad) {
            const currentActive = state.smartActiveScene;
            const isActive = currentActive === pad.qlcWidget;
            if (pad.qlcWidget && socket) {
              socket.emit("smart:trigger_scene", {
                pageId: pad.qlcPage || 1,
                widgetId: pad.qlcWidget,
                active: !isActive,
              });
            }
            state.setSmartActiveScene(
              !isActive && pad.qlcWidget ? pad.qlcWidget : null,
            );
          }
        }
      } else if (targetControlId.startsWith("fader_")) {
        if (type === 176) {
          const zoneName = targetControlId.replace("fader_", "");
          const percent = Math.round((data2 / 127) * 100);
          state.setSmartZoneValue(zoneName, percent);

          let zoneId = 0;
          if (zoneName === "Master") zoneId = 1;
          if (zoneName === "Stage") zoneId = 2;
          if (zoneName === "Dancefloor") zoneId = 4;

          if (zoneId && socket) {
            const val255 = Math.round((percent / 100) * 255);
            socket.emit("smart:zone_intensity", { zoneId, value: val255 });
          }
        }
      } else if (targetControlId === "crossfader_main") {
        if (type === 176) {
          const percent = Math.round((data2 / 127) * 100);
          if (socket) {
            socket.emit("smart:crossfader", { value: percent });
          }
        }
      } else if (targetControlId === "topbar_blackout") {
        if (type === 144 && data2 > 0) {
          const isActive = !state.smartBlackout;
          state.setSmartBlackout(isActive);
          if (socket) {
            socket.emit("smart:blackout", { active: isActive });
          }
        }
      } else if (targetControlId === "topbar_autopilot") {
        if (type === 144 && data2 > 0) {
          const isActive = !state.smartAutoPilot;
          state.setSmartAutoPilot(isActive);
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

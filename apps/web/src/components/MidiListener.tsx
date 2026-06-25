 
"use client";

import { useEffect } from "react";
import useStore from "../store/useStore";
import { socket } from "../lib/socket";
import { dmxEngine } from "../lib/dmxEngine";

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

    const findPadByControlId = (state: any, controlId: string) => {
      const parts = controlId.split("_");
      if (parts.length === 3) {
        const page = Number(parts[1]);
        const slot = Number(parts[2]);
        return state.smartPads.find((pad: any) => pad.page === page && pad.slot === slot);
      }
      if (parts.length === 2) {
        const legacyId = Number(parts[1]);
        return state.smartPads.find((pad: any) => pad.id === legacyId);
      }
      return null;
    };

    const resolveFixtureControl = (state: any, controlId: string) => {
      const parts = controlId.split("_");
      const target = parts.at(-1);
      const nodeId = parts.slice(1, -1).join("_");
      if (!nodeId || !["pan", "tilt", "dimmer"].includes(String(target))) return null;
      const fixture = state.fixtures.find((candidate: any) => candidate.nodeId === nodeId);
      if (!fixture) return null;
      const channelType = target === "dimmer" ? ["dimmer", "intensity"] : [target];
      const channelDef = fixture.channels?.find((candidate: any) => channelType.includes(candidate.type));
      if (!channelDef) return null;
      const startAddress = fixture.startAddress || fixture.start_address || 1;
      return {
        fixture,
        channelType: String(target),
        universe: Number(fixture.universe || 1),
        channel: Number(startAddress + channelDef.channel - 1),
      };
    };

    const sortedDmxGroups = (state: any) => [...(state.dmxGroups || [])].sort((a: any, b: any) => a.order - b.order);

    const emitDmxGroupLevel = (group: any, percent: number, state: any) => {
      if (!group?.backendZone) return;
      const zoneIds: Record<string, number> = { Face: 1, Piste: 2, Bar: 3, Dancefloor: 4 };
      socket.emit("smart:zone_intensity", {
        zoneId: zoneIds[group.backendZone],
        groupName: group.backendZone,
        value: Math.round(((percent / 100) * 255) * ((state.masterDimmer ?? 255) / 255)),
      });
    };
    
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
          const pad = findPadByControlId(state, controlId);

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
      const groups = sortedDmxGroups(state).slice(0, 6);
      
      groups.forEach((group, idx) => {
        const isMuted = groupMutes[group.id] === true;
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
      const midiRoutes = [
        {
          match: (controlId: string) => controlId === "apc_group_faders",
          handle: () => {
            if (!isApcMini || type !== 176 || data1 < 48 || data1 > 56) return false;
            const percent = Math.round((data2 / 127) * 100);
            const group = sortedDmxGroups(state)[data1 - 48];
            if (group) {
              state.setGroupLevel(group.id, percent);
              emitDmxGroupLevel(group, percent, state);
            }
            return Boolean(group);
          },
        },
        {
          match: (controlId: string) => controlId === "apc_group_mutes",
          handle: () => {
            if (!isApcMini || type !== 144 || data2 <= 0 || data1 < 64 || data1 > 71) return false;
            const group = sortedDmxGroups(state)[data1 - 64];
            if (group) state.setGroupMute(group.id, state.groupMutes[group.id] !== true);
            return Boolean(group);
          },
        },
        {
          match: (controlId: string) => controlId.startsWith("group_"),
          handle: (controlId: string) => {
            const suffix = controlId.endsWith("_level") ? "_level" : controlId.endsWith("_mute") ? "_mute" : "";
            if (!suffix) return false;
            const groupId = controlId.slice("group_".length, -suffix.length);
            const group = (state.dmxGroups || []).find((candidate: any) => candidate.id === groupId);
            if (!group) return false;
            if (suffix === "_level") {
              if (type !== 176) return false;
              const percent = Math.round((data2 / 127) * 100);
              state.setGroupLevel(group.id, percent);
              emitDmxGroupLevel(group, percent, state);
              return true;
            }
            if (type !== 144 || data2 <= 0) return false;
            state.setGroupMute(group.id, state.groupMutes[group.id] !== true);
            return true;
          },
        },
        {
          match: (controlId: string) => controlId.startsWith("pad_"),
          handle: (controlId: string) => {
            if (type !== 144 || data2 <= 0) return false;
            const pad = findPadByControlId(state, controlId);
            if (pad) state.triggerSmartPad(pad);
            return Boolean(pad);
          },
        },
        {
          match: (controlId: string) => controlId.startsWith("fixture_"),
          handle: (controlId: string) => {
            if (type !== 176) return false;
            const resolved = resolveFixtureControl(state, controlId);
            if (!resolved) return false;
            dmxEngine.setChannel(resolved.universe, resolved.channel, Math.round((data2 * 255) / 127), { source: "manual" });
            return true;
          },
        },
        {
          match: (controlId: string) => controlId.startsWith("fader_"),
          handle: (controlId: string) => {
            if (type !== 176) return false;
            const zoneName = controlId.replace("fader_", "");
            const percent = Math.round((data2 / 127) * 100);
            state.setSmartZoneValue(zoneName, percent);
            let zoneId = 0;
            if (zoneName === "Master") zoneId = 1;
            if (zoneName === "Stage") zoneId = 2;
            if (zoneName === "Dancefloor") zoneId = 4;
            if (zoneId) socket.emit("smart:zone_intensity", { zoneId, value: Math.round((percent / 100) * 255) });
            return true;
          },
        },
        {
          match: (controlId: string) => controlId === "crossfader_main",
          handle: () => {
            if (type !== 176) return false;
            socket.emit("smart:crossfader", { value: Math.round((data2 / 127) * 100) });
            return true;
          },
        },
        {
          match: (controlId: string) => controlId === "topbar_blackout",
          handle: () => {
            if (type !== 144 || data2 <= 0) return false;
            const isActive = !state.smartBlackout;
            state.setSmartBlackout(isActive);
            socket.emit("smart:blackout", { active: isActive });
            return true;
          },
        },
        {
          match: (controlId: string) => controlId === "topbar_autopilot",
          handle: () => {
            if (type !== 144 || data2 <= 0) return false;
            state.setSmartAutoPilot(!state.smartAutoPilot);
            return true;
          },
        },
      ];

      for (const routeId of ["apc_group_faders", "apc_group_mutes"]) {
        const route = midiRoutes.find((candidate) => candidate.match(routeId));
        if (route?.handle(routeId)) return;
      }
      // --- MIDI LEARN MODE ---
      if (state.midiLearnMode && state.midiLearnActiveControl) {
        if (type === 144 && data2 === 0) return;
        if (state.midiLearnActiveControl.startsWith("fixture_") && type !== 176) return;
        if (state.midiLearnActiveControl.startsWith("group_") && state.midiLearnActiveControl.endsWith("_level") && type !== 176) return;
        if (state.midiLearnActiveControl.startsWith("group_") && state.midiLearnActiveControl.endsWith("_mute") && type !== 144) return;

        state.setMidiMapping(state.midiLearnActiveControl, {
          type,
          channel,
          data1,
        });
        if (state.midiLearnActiveControl.startsWith("pad_")) {
          const pad = findPadByControlId(state, state.midiLearnActiveControl);
          if (pad) {
            state.updateSmartPad(pad.id, {
              midiNote: data1,
              midiChannel: channel + 1,
            });
          }
        }
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
      const route = midiRoutes.find((candidate) => candidate.match(targetControlId));
      route?.handle(targetControlId);    };

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

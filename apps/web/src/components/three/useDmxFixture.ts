"use client";

import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { subscribeDmxStore, getDmxChannel } from "./DmxSyncController";

export interface DmxFixtureState {
  dimmer?: number;
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  amber?: number;
  pan?: number;
  tilt?: number;
  strobe?: number;
  zoom?: number;
  color_wheel?: number;
  gobo?: number;
  prism?: number;
}

export function useDmxFixtureState(
  universe: number,
  startAddress: number,
  channels: { channel: number; type: string }[]
): DmxFixtureState {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeDmxStore(() => forceUpdate((n) => n + 1));
    return unsubscribe;
  }, []);

  return useMemo(() => {
    const state: DmxFixtureState = {};
    channels.forEach((ch) => {
      const absChannel = startAddress + ch.channel - 1;
      const value = getDmxChannel(universe, absChannel);
      switch (ch.type) {
        case "dimmer":
        case "intensity":
          state.dimmer = value;
          break;
        case "red":
          state.red = value;
          break;
        case "green":
          state.green = value;
          break;
        case "blue":
          state.blue = value;
          break;
        case "white":
          state.white = value;
          break;
        case "amber":
          state.amber = value;
          break;
        case "pan":
          state.pan = value;
          break;
        case "tilt":
          state.tilt = value;
          break;
        case "strobe":
          state.strobe = value;
          break;
        case "zoom":
          state.zoom = value;
          break;
        case "color_wheel":
        case "color":
          state.color_wheel = value;
          break;
        case "gobo":
          state.gobo = value;
          break;
        case "prism":
          state.prism = value;
          break;
      }
    });
    return state;
  }, [universe, startAddress, channels]);
}

// Shared helper: convert DMX 0-255 values to color + intensity
export function useFixtureColor(state: DmxFixtureState): {
  color: THREE.Color;
  intensity: number;
} {
  return useMemo(() => {
    let r = (state.red ?? 255) / 255;
    let g = (state.green ?? 255) / 255;
    let b = (state.blue ?? 255) / 255;
    const w = (state.white ?? 0) / 255;
    const dim = (state.dimmer ?? 255) / 255;

    // Convert color wheel values to RGB
    // Standard 12ch beam color wheel mapping:
    // 0-7: White, 8-23: Red, 24-39: Orange, 40-55: Yellow/Amber,
    // 56-71: Light Green, 72-87: Green, 88-103: Cyan,
    // 104-119: Light Blue, 120-135: Blue, 136-151: Purple,
    // 152-167: Magenta/Rose, 168-183: Deep Red, 184-199: UV Violet,
    // 200-215: Lamp Arc, 216-255: Rotation
    if (state.color_wheel !== undefined) {
      const cw = state.color_wheel;
      if (cw >= 10 && cw < 20) {
        r = 1; g = 0; b = 0; // Rouge (10-19)
      } else if (cw >= 20 && cw < 30) {
        r = 1; g = 0.5; b = 0; // Orange (20-29)
      } else if (cw >= 30 && cw < 40) {
        r = 0; g = 0.9; b = 0.9; // Cyan / Aquamarine (30-39)
      } else if (cw >= 40 && cw < 50) {
        r = 0; g = 1; b = 0; // Vert (40-49)
      } else if (cw >= 50 && cw < 60) {
        r = 0.5; g = 1; b = 0.5; // Vert Clair (50-59)
      } else if (cw >= 60 && cw < 70) {
        r = 0.6; g = 0.6; b = 1; // Bleu Lavande / Light Blue (60-69)
      } else if (cw >= 70 && cw < 80) {
        r = 1; g = 0.9; b = 0; // Jaune (70-79)
      } else if (cw >= 80 && cw < 90) {
        r = 1; g = 0.4; b = 0.7; // Rose (80-89)
      } else if (cw >= 90 && cw < 100) {
        r = 1; g = 0.7; b = 0; // Amber / Yellowish (90-99)
      } else if (cw >= 100 && cw < 110) {
        r = 0.9; g = 0; b = 0.9; // Magenta (100-109)
      } else if (cw >= 110 && cw < 120) {
        r = 0.4; g = 0.8; b = 1; // Cyan / Light Blue (110-119)
      } else if (cw >= 120 && cw < 130) {
        r = 0; g = 0; b = 1; // Bleu foncé (120-129)
      } else if (cw >= 130 && cw < 140) {
        r = 0.9; g = 0.8; b = 0.6; // Marron / Warm White (130-139)
      } else if (cw >= 140) {
        // Rotation — blend through rainbow
        const phase = ((cw - 140) / 115) % 1;
        r = Math.round((Math.sin(phase * Math.PI * 2) * 0.5 + 0.5) * 10) / 10;
        g = Math.round((Math.sin(phase * Math.PI * 2 + 2.094) * 0.5 + 0.5) * 10) / 10;
        b = Math.round((Math.sin(phase * Math.PI * 2 + 4.189) * 0.5 + 0.5) * 10) / 10;
      } else {
        r = 1; g = 1; b = 1; // Blanc (0-9)
      }
    }

    const color = new THREE.Color(
      Math.min(1, r + w),
      Math.min(1, g + w),
      Math.min(1, b + w)
    );

    const intensity = dim * (r + g + b + w) / 4 * 50; // scale to light intensity

    return { color, intensity };
  }, [state.red, state.green, state.blue, state.white, state.dimmer, state.color_wheel]);
}

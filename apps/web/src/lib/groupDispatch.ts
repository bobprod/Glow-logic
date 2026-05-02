/**
 * groupDispatch — couche d'intégration centrale de Glow Logic
 *
 * Toute feature (AI Lumière, MIDI, Effect Editor, Timeline…) passe par ici
 * pour envoyer des valeurs à un groupe de fixtures.
 *
 * Pipeline :  sendToGroup(grp, r, g, b, intensity)
 *              → calcule les canaux DMX selon le profil de chaque fixture
 *              → socket.emit("dmx_update") × N canaux  →  Server  →  ArtNet + QLC+ OSC
 *              → socket.emit("smart:zone_intensity")   →  Smart Mode UI + QLC+ slider
 */

import { socket } from "./socket";
import type { PatchedFixture } from "../store/slices/patchSlice";

// Groups A–D mapped to Smart Mode zone IDs (QLC+ slider widgets 1–4)
const GROUP_TO_ZONE_ID: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

/**
 * Normalize a channel profile label to a canonical key.
 */
function canonicalize(label: string): string {
  return label.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Calculate the DMX value for a single channel given the color + intensity.
 */
function channelValue(
  label: string,
  r: number,
  g: number,
  b: number,
  intensity: number // 0–1
): number {
  const ch = canonicalize(label);

  // RGB
  if (ch === "r" || ch === "red") return Math.round(r * intensity);
  if (ch === "g" || ch === "green") return Math.round(g * intensity);
  if (ch === "b" || ch === "blue") return Math.round(b * intensity);

  // White / Warm white
  if (ch === "w" || ch === "white" || ch === "warmwhite" || ch === "cw") {
    return Math.round(((r + g + b) / 3) * intensity);
  }

  // Amber
  if (ch === "ambre" || ch === "amber" || ch === "a") {
    return Math.round(Math.max(r, g) * 0.6 * intensity);
  }

  // UV
  if (ch === "uv") return Math.round(b * 0.5 * intensity);

  // Dimmer / Intensity master
  if (
    ch === "dim" ||
    ch === "dimmer" ||
    ch === "intensity" ||
    ch === "master" ||
    ch === "brightness"
  ) {
    return Math.round(255 * intensity);
  }

  // Strobe — leave at 0 unless caller explicitly wants it
  if (ch === "strobe" || ch === "shutter") return 0;

  // Pan / Tilt — don't touch
  if (ch === "pan" || ch === "tilt" || ch === "pantilt" || ch === "panfine" || ch === "tiltfine") {
    return 128; // centre
  }

  // Anything else (Gobo, Prism, Speed…) → 0
  return 0;
}

export interface DispatchOptions {
  /** Raw RGB 0–255 */
  r: number;
  g: number;
  b: number;
  /** Global intensity multiplier 0–1 (applied on top of per-channel logic) */
  intensity: number;
  /** Fixtures from the patch store */
  patch: PatchedFixture[];
  /** Callback to update Smart Mode zone slider in Zustand */
  setSmartZoneValue?: (zone: string, value: number) => void;
}

/**
 * Send color + intensity to all fixtures belonging to `grp`.
 */
export function sendToGroup(grp: string, opts: DispatchOptions): void {
  const { r, g, b, intensity, patch, setSmartZoneValue } = opts;

  const fixtures = patch.filter((f) => f.grp === grp);

  for (const fixture of fixtures) {
    const profile: string[] = Array.isArray(fixture.profile)
      ? fixture.profile
      : [];

    for (let i = 0; i < fixture.channel_count; i++) {
      const label = profile[i] ?? "";
      const val = channelValue(label, r, g, b, intensity);
      socket.emit("dmx_update", {
        universe: fixture.universe,
        channel: fixture.start_address + i,
        value: val,
      });
    }
  }

  // Mirror intensity to Smart Mode zones A–D (visual feedback + QLC+ slider)
  const zoneId = GROUP_TO_ZONE_ID[grp];
  if (zoneId !== undefined) {
    const pct = Math.round(intensity * 100);
    socket.emit("smart:zone_intensity", { zoneId, value: pct });
    setSmartZoneValue?.(grp, pct);
  }
}

/**
 * Send a blackout (all 0) to all fixtures in a group.
 */
export function blackoutGroup(grp: string, patch: PatchedFixture[]): void {
  const fixtures = patch.filter((f) => f.grp === grp);
  for (const fixture of fixtures) {
    for (let i = 0; i < fixture.channel_count; i++) {
      socket.emit("dmx_update", {
        universe: fixture.universe,
        channel: fixture.start_address + i,
        value: 0,
      });
    }
  }
}

/**
 * Send a full-white strobe flash to all fixtures in a group (for DROP effect).
 */
export function flashGroup(grp: string, patch: PatchedFixture[], intensity = 1): void {
  sendToGroup(grp, { r: 255, g: 255, b: 255, intensity, patch });
}

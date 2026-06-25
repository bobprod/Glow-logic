import type { FixtureCategoryId } from "../lib/fixtureCategories";

export type DmxChannelType =
  | "dimmer"
  | "pan"
  | "tilt"
  | "color"
  | "gobo"
  | "prism"
  | "zoom"
  | "strobe"
  | "effect"
  | "red"
  | "green"
  | "blue"
  | "white"
  | "amber"
  | "uv"
  | "shutter"
  | "focus"
  | "iris"
  | "speed"
  | "macro"
  | "custom";

export interface DmxChannel {
  channel: number;
  name: string;
  type: DmxChannelType | string;
  minVal: number;
  maxVal: number;
  defaultVal: number;
  function: string;
  minValue: number;
  maxValue: number;
  min?: number;
  max?: number;
}

export interface FixtureMode {
  name: string;
  channels: DmxChannel[];
}

export interface FixtureProfile {
  id: string;
  manufacturer: string;
  model: string;
  modes: FixtureMode[];
}

export interface PatchedFixture {
  id: number;
  name: string;
  profileId: string;
  activeMode: string;
  universe: number;
  startAddress: number;
  start_address: number;
  total_channels: number;
  gridPosition: { x: number; y: number; z: number };
  nodeId?: string;
  fixtureId?: number;
  totalChannels?: number;
  color?: string;
  nodeType?: string;
  // Famille d'équipement (lyre/laser/fumigène…) — cf. lib/fixtureCategories.
  // Optionnel : absent = catégorie à inférer/non renseignée (rétro-compatible).
  category?: FixtureCategoryId;
  channels: DmxChannel[];
}

export interface Keyframe {
  id?: string;
  timeMs: number;
  value: number;
}

export interface AutomationTrackContract {
  id: string;
  fixtureId: string;
  channelType: string;
  keyframes: Keyframe[];
}

export interface MediaClip {
  id: string;
  name: string;
  type: "audio" | "video";
  fileUrl: string;
  startMs: number;
  durationMs: number;
}

export interface TimelineProject {
  id: number;
  name: string;
  bpm: number;
  durationMs: number;
  clips: MediaClip[];
  automations: AutomationTrackContract[];
}

export type DmxOutputsConfig = {
  qlcOsc: boolean;
  qlcWs: boolean;
  artNet: boolean;
  usbDmx: boolean;
};

export type DmxOutputId = "python" | "qlcOsc" | "qlcWs" | "artNet" | "usbDmx";

export type DmxOutputHealthState = "ok" | "degraded" | "error" | "off";

export type DmxOutputState = {
  enabled: boolean;
  state: DmxOutputHealthState;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  errorCount: number;
};

export type DmxOutputHealthSnapshot = {
  outputs: Record<DmxOutputId, DmxOutputState>;
  at: number;
};

export type NetworkState = {
  adapters: unknown[];
  activeAdapter: unknown | null;
  discoveredNodes: unknown[];
};

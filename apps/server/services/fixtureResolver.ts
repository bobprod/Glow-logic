import { DmxChannelRecord, FixtureListing, getFixtureGroupByName, getFixtures } from "./database";

export type DmxUpdate = { universe: number; channel: number; value: number };

type Rgb = { r: number; g: number; b: number };
type ResolveTarget = { groupName?: string };

const DEFAULT_UNIVERSE = 1;

function clampDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeType(type: string): string {
  return type.toLowerCase().trim().replace(/\s+/g, "_");
}

function absoluteChannel(fixture: FixtureListing, channel: DmxChannelRecord): number {
  return (fixture.start_address || 1) + channel.channel - 1;
}

function findChannel(fixture: FixtureListing, types: string[]): DmxChannelRecord | undefined {
  const wanted = new Set(types.map(normalizeType));
  return fixture.channels.find((channel) => wanted.has(normalizeType(channel.type)));
}

function findChannels(fixture: FixtureListing, types: string[]): DmxChannelRecord[] {
  const wanted = new Set(types.map(normalizeType));
  return fixture.channels.filter((channel) => wanted.has(normalizeType(channel.type)));
}

function colorNameToRgb(name: string): Rgb | null {
  const lower = name.toLowerCase();
  if (lower.includes("off")) return { r: 0, g: 0, b: 0 };
  if (lower.includes("rouge") || lower.includes("red")) return { r: 255, g: 0, b: 0 };
  if (lower.includes("orange")) return { r: 255, g: 90, b: 0 };
  if (lower.includes("jaune") || lower.includes("yellow")) return { r: 255, g: 220, b: 0 };
  if (lower.includes("vert") || lower.includes("green")) return { r: 0, g: 255, b: 70 };
  if (lower.includes("cyan")) return { r: 0, g: 220, b: 255 };
  if (lower.includes("bleu") || lower.includes("blue")) return { r: 0, g: 60, b: 255 };
  if (lower.includes("violet") || lower.includes("purple") || lower.includes("magenta")) return { r: 180, g: 0, b: 255 };
  if (lower.includes("blanc") || lower.includes("white")) return { r: 255, g: 255, b: 255 };
  return null;
}

function colorNameToWheelValue(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("rouge") || lower.includes("red")) return 15;
  if (lower.includes("orange")) return 25;
  if (lower.includes("jaune") || lower.includes("yellow")) return 75;
  if (lower.includes("vert") || lower.includes("green")) return 45;
  if (lower.includes("cyan")) return 35;
  if (lower.includes("bleu") || lower.includes("blue")) return 125;
  if (lower.includes("violet") || lower.includes("purple") || lower.includes("magenta")) return 105;
  return 5;
}

export class FixtureResolver {
  getPatchedFixtures(target: ResolveTarget = {}): FixtureListing[] {
    const fixtures = getFixtures().filter((fixture) => Array.isArray(fixture.channels) && fixture.channels.length > 0);
    if (!target.groupName) return fixtures;

    const group = getFixtureGroupByName(target.groupName);
    if (!group || group.fixtureIds.length === 0) return [];

    const ids = new Set(group.fixtureIds);
    return fixtures.filter((fixture) => ids.has(fixture.id));
  }

  setAllIntensity(value: number, target: ResolveTarget = {}): DmxUpdate[] {
    const updates: DmxUpdate[] = [];
    for (const fixture of this.getPatchedFixtures(target)) {
      const dimmers = findChannels(fixture, ["dimmer", "intensity", "shutter"]);
      for (const channel of dimmers) {
        updates.push({
          universe: DEFAULT_UNIVERSE,
          channel: absoluteChannel(fixture, channel),
          value: clampDmx(value),
        });
      }
    }
    return updates;
  }

  centerMovingHeads(target: ResolveTarget = {}): DmxUpdate[] {
    const updates: DmxUpdate[] = [];
    for (const fixture of this.getPatchedFixtures(target)) {
      for (const type of ["pan", "tilt"]) {
        const channel = findChannel(fixture, [type]);
        if (channel) {
          updates.push({
            universe: DEFAULT_UNIVERSE,
            channel: absoluteChannel(fixture, channel),
            value: 127,
          });
        }
      }
    }
    return updates;
  }

  setAllColorByName(name: string, target: ResolveTarget = {}): DmxUpdate[] {
    const updates: DmxUpdate[] = [];
    const rgb = colorNameToRgb(name);

    for (const fixture of this.getPatchedFixtures(target)) {
      const red = findChannel(fixture, ["red"]);
      const green = findChannel(fixture, ["green"]);
      const blue = findChannel(fixture, ["blue"]);
      if (rgb && red && green && blue) {
        updates.push(
          { universe: DEFAULT_UNIVERSE, channel: absoluteChannel(fixture, red), value: rgb.r },
          { universe: DEFAULT_UNIVERSE, channel: absoluteChannel(fixture, green), value: rgb.g },
          { universe: DEFAULT_UNIVERSE, channel: absoluteChannel(fixture, blue), value: rgb.b },
        );
        continue;
      }

      const wheel = findChannel(fixture, ["color_wheel", "color"]);
      if (wheel) {
        updates.push({
          universe: DEFAULT_UNIVERSE,
          channel: absoluteChannel(fixture, wheel),
          value: colorNameToWheelValue(name),
        });
      }
    }

    return updates;
  }

  setAllStrobe(value: number, target: ResolveTarget = {}): DmxUpdate[] {
    const updates: DmxUpdate[] = [];
    for (const fixture of this.getPatchedFixtures(target)) {
      const channel = findChannel(fixture, ["strobe"]);
      if (channel) {
        updates.push({
          universe: DEFAULT_UNIVERSE,
          channel: absoluteChannel(fixture, channel),
          value: clampDmx(value),
        });
      }
    }
    return updates;
  }

  setAllGobo(index: number, target: ResolveTarget = {}): DmxUpdate[] {
    const goboValues = [5, 15, 25, 35, 45, 55, 65, 75];
    const updates: DmxUpdate[] = [];
    for (const fixture of this.getPatchedFixtures(target)) {
      const channel = findChannel(fixture, ["gobo"]);
      if (channel) {
        updates.push({
          universe: DEFAULT_UNIVERSE,
          channel: absoluteChannel(fixture, channel),
          value: goboValues[index] ?? 5,
        });
      }
    }
    return updates;
  }

  setAllPrism(value: number, target: ResolveTarget = {}): DmxUpdate[] {
    const updates: DmxUpdate[] = [];
    for (const fixture of this.getPatchedFixtures(target)) {
      const channel = findChannel(fixture, ["prism"]);
      if (channel) {
        updates.push({
          universe: DEFAULT_UNIVERSE,
          channel: absoluteChannel(fixture, channel),
          value: clampDmx(value),
        });
      }
    }
    return updates;
  }
}

export const fixtureResolver = new FixtureResolver();

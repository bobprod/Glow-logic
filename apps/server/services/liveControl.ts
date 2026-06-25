import { Server, Socket } from "socket.io";
import { setBlackout, setBpm, setSlider, triggerScene } from "./qlc";
import { dmxRouter } from "./dmxRouter";
import { DmxUpdate, fixtureResolver } from "./fixtureResolver";

type DmxSync = { universe: number; channel: number; value: number };

const DEMO_BEAM = {
  universe: 1,
  pan: 1,
  tilt: 3,
  dimmer: 6,
  strobe: 7,
  colorWheel: 8,
  gobo: 9,
  prism: 10,
};

const DEMO_SCENES: Record<number, DmxSync[]> = {
  10: [
    { universe: 1, channel: DEMO_BEAM.colorWheel, value: 40 },
    { universe: 1, channel: DEMO_BEAM.strobe, value: 0 },
  ],
  11: [
    { universe: 1, channel: DEMO_BEAM.colorWheel, value: 80 },
    { universe: 1, channel: DEMO_BEAM.strobe, value: 50 },
  ],
  12: [
    { universe: 1, channel: DEMO_BEAM.colorWheel, value: 150 },
    { universe: 1, channel: DEMO_BEAM.gobo, value: 15 },
    { universe: 1, channel: DEMO_BEAM.strobe, value: 0 },
  ],
  13: [
    { universe: 1, channel: DEMO_BEAM.colorWheel, value: 5 },
    { universe: 1, channel: DEMO_BEAM.strobe, value: 200 },
  ],
};

const SMART_SCENE_PRESETS: Record<number, { color: string; strobe?: number; gobo?: number }> = {
  10: { color: "bleu", strobe: 0 },
  11: { color: "rouge", strobe: 50 },
  12: { color: "violet", gobo: 1 },
  13: { color: "blanc", strobe: 200 },
};

const ZONE_GROUPS: Record<number, string> = {
  1: "Master",
  2: "Piste",
  3: "Bar",
  4: "Dancefloor",
};

function sendDmx(io: Server, update: DmxSync) {
  dmxRouter.setChannel(update.universe, update.channel, update.value);
  io.emit("dmx_sync", update);
}

function sendResolved(io: Server, updates: DmxUpdate[]): boolean {
  if (updates.length === 0) return false;
  for (const update of updates) sendDmx(io, update);
  return true;
}

function zoneTarget(zoneId?: number, groupName?: string) {
  const resolvedGroupName = groupName || (zoneId ? ZONE_GROUPS[zoneId] : undefined);
  return resolvedGroupName ? { groupName: resolvedGroupName } : {};
}

function resolveForZone(
  zoneId: number | undefined,
  groupName: string | undefined,
  build: (target: { groupName?: string }) => DmxUpdate[],
): DmxUpdate[] {
  const target = zoneTarget(zoneId, groupName);
  const targeted = build(target);
  return targeted.length > 0 ? targeted : build({});
}

function qlcZoneId(zoneId?: number, groupName?: string) {
  if (zoneId) return zoneId;
  const found = Object.entries(ZONE_GROUPS).find(([, name]) => name.toLowerCase() === groupName?.toLowerCase());
  return found ? Number(found[0]) : 0;
}

function centerDemoBeam(io: Server) {
  sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.pan, value: 127 });
  sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.tilt, value: 127 });
}

function colorNameToDemoWheel(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("rouge")) return 15;
  if (lower.includes("orange")) return 25;
  if (lower.includes("jaune") || lower.includes("yellow")) return 75;
  if (lower.includes("vert") || lower.includes("green")) return 45;
  if (lower.includes("cyan")) return 35;
  if (lower.includes("bleu") || lower.includes("blue")) return 125;
  if (lower.includes("violet") || lower.includes("purple") || lower.includes("magenta")) return 105;
  return 5;
}

export function registerLiveControlHandlers(io: Server, socket: Socket) {
  socket.on("smart:zone_intensity", (data: { zoneId?: number; groupName?: string; value: number }) => {
    const { zoneId, groupName, value } = data;
    const sliderId = qlcZoneId(zoneId, groupName);
    if (sliderId) setSlider(1, sliderId, value);

    const updates = resolveForZone(zoneId, groupName, (target) => [
      ...fixtureResolver.setAllIntensity(value, target),
      ...fixtureResolver.centerMovingHeads(target),
    ]);

    if (sendResolved(io, updates)) {
      return;
    }

    // Demo fallback: keeps the current Beam 12ch test rig working until fixtures are patched.
    if (sliderId >= 1 && sliderId <= 4) {
      sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.dimmer, value });
      centerDemoBeam(io);
    }
  });

  socket.on("smart:trigger_scene", (data: { pageId: number; widgetId: number; active: boolean }) => {
    const { pageId, widgetId, active } = data;
    triggerScene(pageId, widgetId, active);

    if (active) {
      const sceneUpdates = [
        ...fixtureResolver.setAllIntensity(255),
        ...fixtureResolver.centerMovingHeads(),
      ];
      const preset = SMART_SCENE_PRESETS[widgetId];
      if (preset) {
        sceneUpdates.push(...fixtureResolver.setAllColorByName(preset.color));
        if (preset.strobe !== undefined) sceneUpdates.push(...fixtureResolver.setAllStrobe(preset.strobe));
        if (preset.gobo !== undefined) sceneUpdates.push(...fixtureResolver.setAllGobo(preset.gobo));
      }
      if (sendResolved(io, sceneUpdates)) return;

      sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.dimmer, value: 255 });
      centerDemoBeam(io);
      for (const update of DEMO_SCENES[widgetId] ?? []) sendDmx(io, update);
      return;
    }

    if (sendResolved(io, [
      ...fixtureResolver.setAllIntensity(0),
      ...fixtureResolver.setAllStrobe(0),
      ...fixtureResolver.setAllGobo(0),
      ...fixtureResolver.setAllColorByName("blanc"),
    ])) {
      return;
    }

    for (const update of [
      { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.dimmer, value: 0 },
      { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.strobe, value: 0 },
      { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.gobo, value: 5 },
      { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.colorWheel, value: 5 },
    ]) {
      sendDmx(io, update);
    }
  });

  socket.on("smart:color", (data: { nodeId: string; rgb: [number, number, number]; name: string }) => {
    const updates = [...fixtureResolver.setAllColorByName(data.name)];
    if (data.name.toLowerCase().includes("off")) {
      updates.push(...fixtureResolver.setAllIntensity(0));
    }
    if (sendResolved(io, updates)) return;

    if (data.name.toLowerCase().includes("off")) {
      sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.dimmer, value: 0 });
    }
    sendDmx(io, {
      universe: DEMO_BEAM.universe,
      channel: DEMO_BEAM.colorWheel,
      value: colorNameToDemoWheel(data.name),
    });
  });

  socket.on("smart:gobo", (data: { nodeId: string; gobo: number }) => {
    if (sendResolved(io, fixtureResolver.setAllGobo(data.gobo))) return;

    const goboValues = [5, 15, 25, 35, 45, 55, 65, 75];
    sendDmx(io, {
      universe: DEMO_BEAM.universe,
      channel: DEMO_BEAM.gobo,
      value: goboValues[data.gobo] ?? 5,
    });
  });

  socket.on("smart:prism", (data: { nodeId: string; value: number }) => {
    if (sendResolved(io, fixtureResolver.setAllPrism(data.value))) return;
    sendDmx(io, { universe: DEMO_BEAM.universe, channel: DEMO_BEAM.prism, value: data.value });
  });

  socket.on("smart:blackout", (data: { active: boolean }) => {
    setBlackout(data.active);
    if (sendResolved(io, fixtureResolver.setAllIntensity(data.active ? 0 : 255))) {
      io.emit("smart:blackout", data);
      return;
    }

    sendDmx(io, {
      universe: DEMO_BEAM.universe,
      channel: DEMO_BEAM.dimmer,
      value: data.active ? 0 : 255,
    });
    io.emit("smart:blackout", data);
  });

  socket.on("smart:bpm", (data: { bpm: number }) => {
    setBpm(data.bpm);
    io.emit("smart:bpm", data);
  });
}

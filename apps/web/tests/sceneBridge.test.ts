/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { padToClip, clipToPad } = require("../src/lib/sceneBridge");

// Helper : retrouve une commande DMX par (universe, channel).
const findCmd = (cmds: Array<{ universe: number; channel: number; value: number }>, u: number, c: number) =>
  cmds.find((x) => x.universe === u && x.channel === c);

// (a) Fusion dmxValues (univers 1) + dmxCommands -> dmxCommands dédupliqués.
{
  const pad = {
    id: 7,
    name: "Blue Ocean",
    color: "bg-cyan-500",
    textColor: "text-cyan-400",
    iconName: "Droplets",
    qlcPage: 1,
    qlcWidget: 80,
    dmxValues: { 6: 200 },
    dmxCommands: [{ universe: 1, channel: 2, value: 100 }],
    enabledChannels: [2, 6],
    midiNote: -1,
    midiChannel: 1,
    gridCol: 0,
    gridRow: 0,
    gridW: 1,
    gridH: 1,
    page: 0,
    slot: 0,
  };

  const clip = padToClip(pad, { startTime: 1500, fadeSeconds: 2 });

  assert.ok(Array.isArray(clip.dmxCommands), "dmxCommands doit être un tableau");
  const c6 = findCmd(clip.dmxCommands, 1, 6);
  const c2 = findCmd(clip.dmxCommands, 1, 2);
  assert.deepEqual(c6, { universe: 1, channel: 6, value: 200 }, "doit contenir {1,6,200}");
  assert.deepEqual(c2, { universe: 1, channel: 2, value: 100 }, "doit contenir {1,2,100}");
  assert.equal(clip.dmxCommands.length, 2, "pas de doublon");

  // Report des champs.
  assert.deepEqual(clip.enabledChannels, [2, 6], "enabledChannels reporté");
  assert.equal(clip.fadeSeconds, 2, "fadeSeconds reporté via opts");
  assert.equal(clip.name, "Blue Ocean");
  assert.equal(clip.color, "bg-cyan-500");
  assert.equal(clip.textColor, "text-cyan-400");
  assert.equal(clip.startTime, 1500, "startTime depuis opts");
  assert.equal(clip.duration, 4000, "duration par défaut 4000");
  assert.equal(clip.track, "lights", "track par défaut lights");
  assert.equal(clip.sourceType, "pad");
  assert.equal(clip.sourceId, "7");
  // Pas d'id généré ici (généré par l'action store).
  assert.equal((clip as Record<string, unknown>).id, undefined, "pas d'id côté convertisseur");
}

// (a-bis) Conflit (universe,channel) : dmxCommands prime sur dmxValues.
{
  const pad = {
    id: 1, name: "X", color: "", textColor: "", iconName: "Zap",
    qlcPage: 0, qlcWidget: 0,
    dmxValues: { 10: 50 },
    dmxCommands: [{ universe: 1, channel: 10, value: 222 }],
    midiNote: -1, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 0,
  };
  const clip = padToClip(pad);
  const c10 = findCmd(clip.dmxCommands, 1, 10);
  assert.deepEqual(c10, { universe: 1, channel: 10, value: 222 }, "dmxCommands prime");
  assert.equal(clip.dmxCommands.length, 1, "dédup sur conflit");
}

// (a-ter) Multi-univers conservé + clamp valeurs et canaux invalides ignorés.
{
  const pad = {
    id: 2, name: "M", color: "bg-x", textColor: "text-x", iconName: "Zap",
    qlcPage: 0, qlcWidget: 0,
    dmxValues: { 5: 999, 0: 100, 700: 10 }, // 999 -> 255 ; canal 0 et 700 ignorés
    dmxCommands: [{ universe: 2, channel: 4, value: -20 }], // -20 -> 0
    midiNote: -1, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 0,
  };
  const clip = padToClip(pad);
  assert.deepEqual(findCmd(clip.dmxCommands, 1, 5), { universe: 1, channel: 5, value: 255 }, "clamp haut 255");
  assert.equal(findCmd(clip.dmxCommands, 1, 0), undefined, "canal 0 ignoré");
  assert.equal(findCmd(clip.dmxCommands, 1, 700), undefined, "canal 700 ignoré");
  assert.deepEqual(findCmd(clip.dmxCommands, 2, 4), { universe: 2, channel: 4, value: 0 }, "univers 2 + clamp bas 0");
}

// (b) clipToPad : dmxCommands -> dmxValues (univers 1) + conserve dmxCommands multi-univers.
{
  const clip = {
    id: "clip-1",
    track: "lights",
    name: "Sunset",
    startTime: 0,
    duration: 5000,
    color: "bg-amber-500",
    textColor: "text-amber-300",
    dmxCommands: [
      { universe: 1, channel: 3, value: 180 },
      { universe: 2, channel: 7, value: 90 },
    ],
    enabledChannels: [3, 7],
  };
  const pad = clipToPad(clip, { page: 1, slot: 4 });

  assert.deepEqual(pad.dmxValues, { 3: 180 }, "univers 1 -> dmxValues");
  assert.equal(findCmd(pad.dmxCommands, 2, 7).value, 90, "univers 2 conservé dans dmxCommands");
  assert.deepEqual(pad.enabledChannels, [3, 7], "enabledChannels reporté");
  assert.equal(pad.name, "Sunset");
  assert.equal(pad.color, "bg-amber-500");
  assert.equal(pad.textColor, "text-amber-300");
  assert.equal(pad.iconName, "Zap", "icône par défaut");
  assert.equal(pad.midiNote, -1);
  assert.equal(pad.midiChannel, 1);
  assert.equal(pad.page, 1, "page depuis opts");
  assert.equal(pad.slot, 4, "slot depuis opts");
  assert.equal((pad as Record<string, unknown>).id, undefined, "pas d'id côté convertisseur");
}

// (c) Round-trip : clipToPad(padToClip(pad)) reconstruit les valeurs univers 1 équivalentes.
{
  const pad = {
    id: 42, name: "RT", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Droplets",
    qlcPage: 1, qlcWidget: 80,
    dmxValues: { 6: 200, 2: 100, 12: 255 },
    dmxCommands: [{ universe: 1, channel: 9, value: 30 }],
    enabledChannels: [2, 6, 9, 12],
    midiNote: -1, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 0,
  };
  const clip = padToClip(pad, { startTime: 0 });
  const back = clipToPad(clip);

  // Toutes les valeurs univers 1 d'origine doivent se retrouver.
  const expected = { 6: 200, 2: 100, 12: 255, 9: 30 };
  assert.deepEqual(back.dmxValues, expected, "round-trip dmxValues univers 1");
  assert.deepEqual(back.enabledChannels, [2, 6, 9, 12], "round-trip enabledChannels");
  assert.equal(back.name, "RT");
  assert.equal(back.color, "bg-cyan-500");
  assert.equal(back.textColor, "text-cyan-400");
}

// (d) Défensif : champs absents -> pas de crash, valeurs vides.
{
  // Pad minimal (pas de dmxValues / dmxCommands / enabledChannels).
  const padMin = {
    id: 3, name: "", color: "", textColor: "", iconName: "Zap",
    qlcPage: 0, qlcWidget: 0,
    midiNote: -1, midiChannel: 1, gridCol: 0, gridRow: 0, gridW: 1, gridH: 1, page: 0, slot: 0,
  };
  const clip = padToClip(padMin);
  assert.deepEqual(clip.dmxCommands, [], "pad sans DMX -> []");
  assert.equal(clip.name, "Pad", "nom par défaut");
  assert.equal(clip.startTime, 0);
  assert.equal(clip.duration, 4000);

  // Clip minimal (pas de dmxCommands / enabledChannels).
  const clipMin = {
    id: "c", track: "lights", name: "", startTime: 0, duration: 1000, color: "", textColor: "",
  };
  const pad = clipToPad(clipMin);
  assert.deepEqual(pad.dmxValues, {}, "clip sans DMX -> {}");
  assert.deepEqual(pad.dmxCommands, [], "clip sans DMX -> dmxCommands []");
  assert.equal(pad.name, "Clip", "nom par défaut");
  assert.equal(pad.iconName, "Zap");

  // Entrées carrément vides / partielles ne crashent pas.
  assert.doesNotThrow(() => padToClip({} as never));
  assert.doesNotThrow(() => clipToPad({} as never));
  // dmxCommands non-tableau ignoré proprement.
  assert.doesNotThrow(() => clipToPad({ dmxCommands: null } as never));
  assert.doesNotThrow(() => padToClip({ dmxValues: null, dmxCommands: "nope" } as never));
}

console.log("sceneBridge tests passed");

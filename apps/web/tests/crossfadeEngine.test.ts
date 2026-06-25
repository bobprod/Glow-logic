/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  crossfadeValueAt,
  isContinuousChannel,
  CONTINUOUS_CHANNEL_TYPES,
} = require("../src/lib/crossfadeEngine");

// (a) Continu : t=0 -> from, t=1 -> to, t=0.5 -> milieu (round).
{
  assert.equal(crossfadeValueAt(0, 200, 0, true), 0, "continu t=0 -> from");
  assert.equal(crossfadeValueAt(0, 200, 1, true), 200, "continu t=1 -> to");
  assert.equal(crossfadeValueAt(0, 200, 0.5, true), 100, "continu t=0.5 -> milieu");
  // Milieu non entier -> round.
  assert.equal(crossfadeValueAt(0, 255, 0.5, true), 128, "continu t=0.5 -> round(127.5)=128");
  // from != 0.
  assert.equal(crossfadeValueAt(100, 200, 0.5, true), 150, "continu lerp depuis from=100");
  // Sens descendant.
  assert.equal(crossfadeValueAt(255, 0, 0, true), 255);
  assert.equal(crossfadeValueAt(255, 0, 1, true), 0);
  assert.equal(crossfadeValueAt(255, 0, 0.5, true), 128, "round(127.5)=128");
}

// (b) Discret : reste sur from avant 0.5, bascule sur to à >= 0.5.
{
  assert.equal(crossfadeValueAt(10, 200, 0, false), 10, "discret t=0 -> from");
  assert.equal(crossfadeValueAt(10, 200, 0.49, false), 10, "discret t<0.5 -> from");
  assert.equal(crossfadeValueAt(10, 200, 0.5, false), 200, "discret t=0.5 -> to (bascule)");
  assert.equal(crossfadeValueAt(10, 200, 0.51, false), 200, "discret t>0.5 -> to");
  assert.equal(crossfadeValueAt(10, 200, 1, false), 200, "discret t=1 -> to");
  // Valeurs non entières -> round des deux côtés.
  assert.equal(crossfadeValueAt(10.6, 200.4, 0.2, false), 11, "discret round(from)");
  assert.equal(crossfadeValueAt(10.6, 200.6, 0.8, false), 201, "discret round(to)");
}

// (c) Bornes de t : t hors [0,1] clampé.
{
  assert.equal(crossfadeValueAt(0, 200, -1, true), 0, "t<0 clampé a 0 -> from");
  assert.equal(crossfadeValueAt(0, 200, 5, true), 200, "t>1 clampé a 1 -> to");
  assert.equal(crossfadeValueAt(10, 200, -1, false), 10, "discret t<0 -> from");
  assert.equal(crossfadeValueAt(10, 200, 5, false), 200, "discret t>1 -> to");
}

// (d) isContinuousChannel : continu pour intensité/couleur/position.
{
  for (const t of ["dimmer", "intensity", "red", "green", "blue", "white", "amber", "uv", "pan", "tilt", "strobe", "zoom", "focus", "iris", "speed"]) {
    assert.equal(isContinuousChannel(t), true, `${t} doit etre continu`);
  }
  // Discret pour gobo/color wheel/mode/prisme/macro/function.
  for (const t of ["color", "gobo", "prism", "macro", "effect", "shutter", "mode", "function"]) {
    assert.equal(isContinuousChannel(t), false, `${t} doit etre discret`);
  }
  // Casse insensible.
  assert.equal(isContinuousChannel("GOBO"), false, "GOBO insensible a la casse -> discret");
  assert.equal(isContinuousChannel("Dimmer"), true, "Dimmer insensible a la casse -> continu");
  // Défaut inconnu -> true (sûr de fondre l'intensité).
  assert.equal(isContinuousChannel("inconnu_xyz"), true, "type inconnu -> continu");
  assert.equal(isContinuousChannel(undefined), true, "undefined -> continu");
}

// (e) CONTINUOUS_CHANNEL_TYPES contient les types attendus et est cohérent.
{
  assert.ok(Array.isArray(CONTINUOUS_CHANNEL_TYPES));
  assert.ok(CONTINUOUS_CHANNEL_TYPES.includes("dimmer"));
  assert.ok(CONTINUOUS_CHANNEL_TYPES.includes("pan"));
  assert.ok(CONTINUOUS_CHANNEL_TYPES.includes("tilt"));
  assert.ok(!CONTINUOUS_CHANNEL_TYPES.includes("gobo"));
}

// (f) startCrossfade : propagation de opts.source à dmxEngine.setChannel.
//     Chemin instantané (durationMs<=0 / pas de window en node) => application directe.
{
  const { startCrossfade } = require("../src/lib/crossfadeEngine");
  const { dmxEngine } = require("../src/lib/dmxEngine");

  // Capture les appels setChannel sans toucher au vrai pipeline DMX.
  const calls: Array<{ universe: number; channel: number; value: number; options: unknown }> = [];
  const origSet = dmxEngine.setChannel;
  const origGet = dmxEngine.getChannel;
  dmxEngine.setChannel = (universe: number, channel: number, value: number, options?: unknown) => {
    calls.push({ universe, channel, value, options });
  };
  dmxEngine.getChannel = () => 0;

  try {
    const target = { universe: 0, channel: 1, value: 200, continuous: true };

    // Défaut (opts absent) : aucune source transmise => options === undefined (A3/Smart inchangé).
    calls.length = 0;
    startCrossfade([target], 0);
    assert.equal(calls.length, 1, "instantane: 1 setChannel");
    assert.equal(calls[0].options, undefined, "source par defaut => options undefined (inchange)");

    // Source explicite 'timeline' : transmise telle quelle.
    calls.length = 0;
    startCrossfade([target], 0, { source: "timeline" });
    assert.equal(calls.length, 1, "instantane avec source: 1 setChannel");
    assert.deepEqual(calls[0].options, { source: "timeline" }, "source 'timeline' propagee");

    // Source 'background' : transmise telle quelle.
    calls.length = 0;
    startCrossfade([target], -5, { source: "background" });
    assert.deepEqual(calls[0].options, { source: "background" }, "source 'background' propagee");

    // opts vide ({}) sans source => options undefined.
    calls.length = 0;
    startCrossfade([target], 0, {});
    assert.equal(calls[0].options, undefined, "opts sans source => options undefined");
  } finally {
    dmxEngine.setChannel = origSet;
    dmxEngine.getChannel = origGet;
  }
}

console.log("crossfadeEngine tests passed");

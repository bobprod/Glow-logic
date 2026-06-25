/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  applyMaster,
  isDimmableChannelType,
  DIMMABLE_CHANNEL_TYPES,
} = require("../src/lib/masterScale");

const clamp = (v: number) => Math.max(0, Math.min(255, v));

// (a) INVARIANT master=255 : identique à round(clamp(v)) pour TOUT type.
{
  const types = ["dimmer", "pan", "tilt", "gobo", "color", "red", "prism", undefined];
  const values = [-50, 0, 1, 42, 127, 128, 200, 254, 255, 300];
  for (const type of types) {
    for (const v of values) {
      assert.equal(
        applyMaster(v, type, 255),
        Math.round(clamp(v)),
        `INVARIANT master=255 violé pour type=${type}, v=${v}`,
      );
    }
  }
}

// (b) Dimmable atténué : le master réduit bien l'intensité.
{
  assert.equal(applyMaster(200, "dimmer", 128), Math.round(200 * (128 / 255))); // ≈ 100
  assert.equal(applyMaster(200, "dimmer", 128), 100);
  assert.equal(applyMaster(200, "red", 0), 0);
  assert.equal(applyMaster(255, "green", 128), Math.round(255 * (128 / 255))); // 128
  assert.equal(applyMaster(255, "blue", 0), 0);
  assert.equal(applyMaster(255, "strobe", 0), 0);
}

// (c) Non-dimmable inchangé même à master bas (jamais de dérive).
{
  assert.equal(applyMaster(200, "pan", 0), 200);
  assert.equal(applyMaster(180, "gobo", 64), 180);
  assert.equal(applyMaster(255, "tilt", 0), 255);
  assert.equal(applyMaster(120, "color", 10), 120);
  assert.equal(applyMaster(90, "prism", 0), 90);
  assert.equal(applyMaster(77, undefined, 0), 77);
}

// (d) Bornes & clamp.
{
  assert.equal(applyMaster(300, "dimmer", 255), 255); // value clampée
  assert.equal(applyMaster(-10, "dimmer", 255), 0);
  assert.equal(applyMaster(300, "pan", 0), 255);
  assert.equal(applyMaster(-10, "pan", 128), 0);
  assert.equal(applyMaster(200, "dimmer", 300), 200); // master clampé à 255
  assert.equal(applyMaster(200, "dimmer", -5), 0); // master clampé à 0
  // sortie toujours entière et bornée
  for (let v = 0; v <= 255; v += 13) {
    for (let m = 0; m <= 255; m += 17) {
      const out = applyMaster(v, "dimmer", m);
      assert.ok(Number.isInteger(out) && out >= 0 && out <= 255);
    }
  }
}

// (e) isDimmableChannelType : true/false + casse-insensible.
{
  assert.equal(isDimmableChannelType("dimmer"), true);
  assert.equal(isDimmableChannelType("red"), true);
  assert.equal(isDimmableChannelType("strobe"), true);
  assert.equal(isDimmableChannelType("intensity"), true);
  assert.equal(isDimmableChannelType("pan"), false);
  assert.equal(isDimmableChannelType("tilt"), false);
  assert.equal(isDimmableChannelType("gobo"), false);
  assert.equal(isDimmableChannelType("color"), false);
  assert.equal(isDimmableChannelType(undefined), false);
  // casse-insensible
  assert.equal(isDimmableChannelType("DIMMER"), true);
  assert.equal(isDimmableChannelType("Red"), true);
  assert.equal(isDimmableChannelType("UV"), true);
  assert.equal(isDimmableChannelType("PAN"), false);
}

// (f) DIMMABLE_CHANNEL_TYPES : contenu attendu, sans pan/tilt/gobo.
{
  assert.ok(DIMMABLE_CHANNEL_TYPES.includes("dimmer"));
  assert.ok(DIMMABLE_CHANNEL_TYPES.includes("uv"));
  assert.ok(!DIMMABLE_CHANNEL_TYPES.includes("pan"));
  assert.ok(!DIMMABLE_CHANNEL_TYPES.includes("gobo"));
}

console.log("masterScale tests passed");

/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  oscillatorValue,
  DEFAULT_OSC_CONFIG,
} = require("../src/lib/oscillatorEngine");

// (a) Déterminisme : mêmes entrées -> même sortie.
const cfg = { ...DEFAULT_OSC_CONFIG, waveform: "sine", amount: 0.8, speedBars: 1, chase: 0.5, shape: 0.3, center: 128 };
const opts = { index: 2, count: 5, bpm: 120, timeMs: 1234 };
const v1 = oscillatorValue(cfg, opts);
const v2 = oscillatorValue(cfg, opts);
assert.equal(v1, v2);

// (b) Bornes 0..255 sur toutes les formes d'onde, divers temps et configs extrêmes.
const waveforms = ["sine", "square", "triangle", "sawUp", "sawDown"];
for (const waveform of waveforms) {
  for (let shape = 0; shape <= 1.0001; shape += 0.25) {
    for (let t = 0; t < 4000; t += 37) {
      const value = oscillatorValue(
        { waveform, amount: 1, speedBars: 0.5, chase: 1, shape, center: 200 },
        { index: 3, count: 8, bpm: 174, timeMs: t },
      );
      assert.ok(Number.isInteger(value), `valeur entière attendue pour ${waveform}`);
      assert.ok(value >= 0 && value <= 255, `borne dépassée: ${value} (${waveform}, shape=${shape}, t=${t})`);
    }
  }
}

// center extrême + amount max ne sort jamais des bornes (saturation haute et basse).
{
  const hi = oscillatorValue({ ...DEFAULT_OSC_CONFIG, waveform: "sawUp", amount: 1, center: 255 }, { index: 0, count: 1, bpm: 120, timeMs: 0 });
  assert.ok(hi >= 0 && hi <= 255);
  const lo = oscillatorValue({ ...DEFAULT_OSC_CONFIG, waveform: "sine", amount: 1, center: 0 }, { index: 0, count: 1, bpm: 120, timeMs: 4 * 500 });
  assert.ok(lo >= 0 && lo <= 255);
}

// (c) Chase : count>1, chase>0, à un timeMs donné deux index distincts diffèrent.
{
  const chaseCfg = { waveform: "sine", amount: 1, speedBars: 1, chase: 0.6, shape: 0, center: 128 };
  // On cherche un timeMs où la dérivée de l'onde est non nulle pour garantir la différence.
  let foundDifference = false;
  for (let t = 0; t < 2000 && !foundDifference; t += 50) {
    const a = oscillatorValue(chaseCfg, { index: 0, count: 6, bpm: 120, timeMs: t });
    const b = oscillatorValue(chaseCfg, { index: 3, count: 6, bpm: 120, timeMs: t });
    if (a !== b) foundDifference = true;
  }
  assert.ok(foundDifference, "chase doit produire des valeurs distinctes entre index sur la durée");

  // Vérifie aussi un instant précis non trivial.
  const ta = oscillatorValue(chaseCfg, { index: 1, count: 4, bpm: 120, timeMs: 250 });
  const tb = oscillatorValue(chaseCfg, { index: 2, count: 4, bpm: 120, timeMs: 250 });
  assert.notEqual(ta, tb);
}

// (d) amount=0 -> toujours = round(center), quels que soient forme/temps/index.
{
  for (const waveform of waveforms) {
    for (let t = 0; t < 3000; t += 123) {
      const value = oscillatorValue(
        { waveform, amount: 0, speedBars: 1, chase: 0.9, shape: 0.7, center: 137 },
        { index: 2, count: 5, bpm: 128, timeMs: t },
      );
      assert.equal(value, 137, `amount=0 doit donner center (${waveform}, t=${t})`);
    }
  }
  // center non entier -> round.
  const rounded = oscillatorValue({ waveform: "sine", amount: 0, speedBars: 1, chase: 0, shape: 0, center: 100.6 }, { index: 0, count: 1, bpm: 120, timeMs: 999 });
  assert.equal(rounded, 101);
}

// (e) speedMultiplier : multiplicateur global de vitesse, additif et rétro-compatible.
{
  const baseCfg = { waveform: "sine", amount: 1, speedBars: 1, chase: 0, shape: 0, center: 128 };

  // Invariant : absent === speedMultiplier 1 (sur de nombreux instants).
  for (let t = 0; t < 4000; t += 53) {
    const absent = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: t });
    const one = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: t, speedMultiplier: 1 });
    assert.equal(one, absent, `speedMultiplier=1 doit égaler l'absence (t=${t})`);
  }

  // Invariant : speedMultiplier <=0 ou non fini est traité comme 1.
  for (const bad of [0, -1, -3.5, NaN, Infinity, -Infinity]) {
    const ref = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: 777 });
    const got = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: 777, speedMultiplier: bad });
    assert.equal(got, ref, `speedMultiplier=${bad} doit retomber sur 1`);
  }

  // Accélération : speedMultiplier=2 à timeMs t === speedMultiplier=1 à timeMs 2t.
  // (cycle = (timeMs/1000) * cyclesPerSecond * mult => même phase si mult*t constant.)
  for (let t = 0; t < 3000; t += 71) {
    const fast = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: t, speedMultiplier: 2 });
    const ref = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: 2 * t });
    assert.equal(fast, ref, `mult=2 @${t} doit égaler mult=1 @${2 * t}`);
  }

  // Ralentissement : speedMultiplier=0.5 à timeMs 2t === speedMultiplier=1 à timeMs t.
  for (let t = 0; t < 3000; t += 71) {
    const slow = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: 2 * t, speedMultiplier: 0.5 });
    const ref = oscillatorValue(baseCfg, { index: 0, count: 1, bpm: 120, timeMs: t });
    assert.equal(slow, ref, `mult=0.5 @${2 * t} doit égaler mult=1 @${t}`);
  }

  // (c-bis) Bornes inchangées 0..255 avec speedMultiplier sur toutes formes et multiplicateurs extrêmes.
  for (const waveform of waveforms) {
    for (const mult of [0.01, 0.25, 4, 100]) {
      for (let t = 0; t < 4000; t += 113) {
        const value = oscillatorValue(
          { waveform, amount: 1, speedBars: 0.5, chase: 1, shape: 0.5, center: 200 },
          { index: 3, count: 8, bpm: 174, timeMs: t, speedMultiplier: mult },
        );
        assert.ok(Number.isInteger(value) && value >= 0 && value <= 255,
          `borne dépassée avec speedMultiplier=${mult}: ${value} (${waveform}, t=${t})`);
      }
    }
  }
}

// (f) phase : offset absolu 0..1 du cycle, additif et rétro-compatible.
{
  const baseCfg = { waveform: "sine", amount: 1, speedBars: 1, chase: 0, shape: 0, center: 128 };
  // bpm=120, speedBars=1 => secondsPerBar=2 => 1 cycle = 2000ms ; demi-cycle = 1000ms.

  // (f-a) Invariant : phase absent === phase 0 (sur de nombreux instants, formes, index).
  for (const waveform of waveforms) {
    for (let t = 0; t < 4000; t += 53) {
      const absent = oscillatorValue({ ...baseCfg, waveform }, { index: 1, count: 4, bpm: 132, timeMs: t });
      const zero = oscillatorValue({ ...baseCfg, waveform, phase: 0 }, { index: 1, count: 4, bpm: 132, timeMs: t });
      assert.equal(zero, absent, `phase=0 doit égaler l'absence (${waveform}, t=${t})`);
    }
  }
  // DEFAULT_OSC_CONFIG.phase doit valoir 0.
  assert.equal(DEFAULT_OSC_CONFIG.phase, 0);

  // (f-b) phase=0.5 décale d'un demi-cycle :
  //  - valeur différente de phase 0 (à un instant où l'onde varie),
  //  - et égale à la valeur du même osc à timeMs décalé d'un demi-cycle (1000ms).
  {
    // instant où la sinusoïde varie nettement (t=250 => quart de cycle).
    const at250 = oscillatorValue({ ...baseCfg, phase: 0 }, { index: 0, count: 1, bpm: 120, timeMs: 250 });
    const at250phase = oscillatorValue({ ...baseCfg, phase: 0.5 }, { index: 0, count: 1, bpm: 120, timeMs: 250 });
    assert.notEqual(at250phase, at250);

    // phase=0.5 @ timeMs t === phase=0 @ timeMs t+1000 (demi-cycle), sur plusieurs t.
    for (let t = 0; t < 3000; t += 71) {
      const withPhase = oscillatorValue({ ...baseCfg, phase: 0.5 }, { index: 0, count: 1, bpm: 120, timeMs: t });
      const shifted = oscillatorValue({ ...baseCfg, phase: 0 }, { index: 0, count: 1, bpm: 120, timeMs: t + 1000 });
      assert.equal(withPhase, shifted, `phase=0.5 @${t} doit égaler phase=0 @${t + 1000}`);
    }

    // phase=0.25 (quart de cycle) === décalage timeMs de 500ms.
    for (let t = 0; t < 3000; t += 91) {
      const withPhase = oscillatorValue({ ...baseCfg, phase: 0.25 }, { index: 0, count: 1, bpm: 120, timeMs: t });
      const shifted = oscillatorValue({ ...baseCfg, phase: 0 }, { index: 0, count: 1, bpm: 120, timeMs: t + 500 });
      assert.equal(withPhase, shifted, `phase=0.25 @${t} doit égaler phase=0 @${t + 500}`);
    }
  }

  // (f-c) Bornes 0..255 inchangées avec phase sur toutes formes et phases extrêmes.
  for (const waveform of waveforms) {
    for (let ph = 0; ph <= 1.0001; ph += 0.1) {
      for (let t = 0; t < 4000; t += 113) {
        const value = oscillatorValue(
          { waveform, amount: 1, speedBars: 0.5, chase: 1, shape: 0.5, center: 200, phase: ph },
          { index: 3, count: 8, bpm: 174, timeMs: t },
        );
        assert.ok(Number.isInteger(value) && value >= 0 && value <= 255,
          `borne dépassée avec phase=${ph}: ${value} (${waveform}, t=${t})`);
      }
    }
    // phase hors bornes (clamp01) ne casse rien.
    for (const ph of [-1, -0.3, 1.5, 2, NaN]) {
      const value = oscillatorValue(
        { waveform, amount: 1, speedBars: 1, chase: 0, shape: 0, center: 128, phase: ph },
        { index: 0, count: 1, bpm: 120, timeMs: 333 },
      );
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 255,
        `phase hors borne ${ph} doit rester clampée (${waveform})`);
    }
  }

  // phase=0 et phase=1 (clamp01) donnent le même cycle entier => valeur identique.
  for (let t = 0; t < 3000; t += 97) {
    const p0 = oscillatorValue({ ...baseCfg, phase: 0 }, { index: 0, count: 1, bpm: 120, timeMs: t });
    const p1 = oscillatorValue({ ...baseCfg, phase: 1 }, { index: 0, count: 1, bpm: 120, timeMs: t });
    assert.equal(p1, p0, `phase=1 (cycle entier) doit égaler phase=0 (t=${t})`);
  }
}

console.log("oscillatorEngine tests passed");

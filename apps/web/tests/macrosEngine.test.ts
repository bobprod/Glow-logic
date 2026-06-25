/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  NAMED_COLORS,
  colorByName,
  linearSpread,
} = require("../src/lib/macrosEngine");

// (a) linearSpread(1, ...) => [min].
{
  assert.deepEqual(linearSpread(1, 0, 255), [0]);
  assert.deepEqual(linearSpread(1, 42, 255), [42]);
  assert.deepEqual(linearSpread(0, 17, 255), [17], "count<=0 doit aussi donner [min]");
}

// (b) linearSpread(5, 0, 255) : bornes exactes 0 et 255, longueur 5, monotone croissant, entiers.
{
  const s = linearSpread(5, 0, 255);
  assert.equal(s.length, 5, "longueur attendue 5");
  assert.equal(s[0], 0, "première valeur = min (0)");
  assert.equal(s[s.length - 1], 255, "dernière valeur = max (255)");
  for (const v of s) {
    assert.ok(Number.isInteger(v), `valeur entière attendue: ${v}`);
  }
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i] > s[i - 1], `monotone croissant attendu à l'index ${i}`);
  }
}

// (c) colorByName : insensible à la casse / espaces, et inconnu => undefined.
{
  assert.deepEqual(colorByName("red"), NAMED_COLORS.red);
  assert.deepEqual(colorByName("RED"), NAMED_COLORS.red);
  assert.deepEqual(colorByName("  Amber  "), NAMED_COLORS.amber);
  assert.deepEqual(colorByName("CyAn"), NAMED_COLORS.cyan);
  assert.equal(colorByName("not-a-color"), undefined, "couleur inconnue => undefined");
  assert.equal(colorByName(""), undefined, "chaîne vide => undefined");
}

// (d) NAMED_COLORS.off = (0,0,0) ; white inclut canal w.
{
  assert.equal(NAMED_COLORS.off.r, 0);
  assert.equal(NAMED_COLORS.off.g, 0);
  assert.equal(NAMED_COLORS.off.b, 0);
  assert.equal(NAMED_COLORS.white.w, 255, "white doit inclure un canal white plein");
}

console.log("macrosEngine tests passed");

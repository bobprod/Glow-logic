import assert from "node:assert/strict";

// ============================================================
// patchTable — smoke test du moteur de RE-PATCH (CONTRAT A7)
// ------------------------------------------------------------
// Module PUR : on teste parsePatch / serializePatch / resolvePatch
// sans framework (node:assert + ts-node transpile-only), même style
// que dmxRouter-smoke.ts. Exécution : `npm run test:patch`.
//
// INVARIANT CLÉ : table vide => resolvePatch renvoie [channel]
// (1:1, 0 régression vs comportement actuel).
// ============================================================

import { parsePatch, serializePatch, resolvePatch } from "../services/patchTable";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

console.log("patchTable — smoke test\n");

// ── (a) Table vide => 1:1 pour plusieurs canaux ──────────────
check("table vide => resolvePatch renvoie [channel] (1:1)", () => {
  const map = parsePatch("");
  assert.deepEqual(resolvePatch(map, 1), [1]);
  assert.deepEqual(resolvePatch(map, 42), [42]);
  assert.deepEqual(resolvePatch(map, 512), [512]);
  assert.equal(map.size, 0);
});

// ── (b) Règle simple "F:C" ───────────────────────────────────
check('"7:54" => resolve(7)=[54], resolve(8)=[8] (non patché 1:1)', () => {
  const map = parsePatch("7:54");
  assert.deepEqual(resolvePatch(map, 7), [54]);
  assert.deepEqual(resolvePatch(map, 8), [8]);
});

// ── (c) Plage série "S/E:C" ──────────────────────────────────
check('"16/35:250" => resolve(16)=[250], resolve(35)=[269], resolve(20)=[254]', () => {
  const map = parsePatch("16/35:250");
  assert.deepEqual(resolvePatch(map, 16), [250]);
  assert.deepEqual(resolvePatch(map, 35), [269]);
  assert.deepEqual(resolvePatch(map, 20), [254]);
  // hors plage => 1:1
  assert.deepEqual(resolvePatch(map, 15), [15]);
  assert.deepEqual(resolvePatch(map, 36), [36]);
});

// ── (d) Multi-cibles "F:C1,C2,C3" ────────────────────────────
check('"5:10,11,14" => resolve(5)=[10,11,14]', () => {
  const map = parsePatch("5:10,11,14");
  assert.deepEqual(resolvePatch(map, 5), [10, 11, 14]);
});

// ── (e) Union multi-lignes pour un même F ────────────────────
check('"5:10" + "5:12" => resolve(5)=[10,12] (union triée sans doublon)', () => {
  const map = parsePatch("5:10\n5:12");
  assert.deepEqual(resolvePatch(map, 5), [10, 12]);
  // doublon ignoré
  const map2 = parsePatch("5:10;5:10;5:12");
  assert.deepEqual(resolvePatch(map2, 5), [10, 12]);
});

// ── (f) Séparateurs mixtes (\n et ';') ───────────────────────
check("séparateurs '\\n' et ';' équivalents", () => {
  const map = parsePatch("7:54;16/35:250");
  assert.deepEqual(resolvePatch(map, 7), [54]);
  assert.deepEqual(resolvePatch(map, 16), [250]);
});

// ── (g) Clamp 1..512 ─────────────────────────────────────────
check("clamp 1..512 (valeurs hors bornes ramenées)", () => {
  const map = parsePatch("0:9999\n600:5");
  // logique 0 -> clamp 1 ; physique 9999 -> clamp 512
  assert.deepEqual(resolvePatch(map, 1), [512]);
  // logique 600 -> clamp 512 ; physique 5
  assert.deepEqual(resolvePatch(map, 512), [5]);
});

// ── (h) Lignes invalides ignorées (parsing défensif) ─────────
check("lignes vides/invalides ignorées", () => {
  const map = parsePatch([
    "",
    "   ",
    "# commentaire",
    "// commentaire",
    "garbage",      // pas de ':'
    "abc:def",      // ni gauche ni droite numérique
    "5:",           // pas de cible
    ":10",          // pas de logique
    "5:xyz",        // cible non numérique
    "7:54",         // <- seule valide
  ].join("\n"));
  assert.equal(map.size, 1);
  assert.deepEqual(resolvePatch(map, 7), [54]);
  assert.deepEqual(resolvePatch(map, 5), [5]); // ignoré => 1:1
});

// ── (i) Round-trip serialize(parse(x)) stable ────────────────
check("serialize(parse(x)) reparse stable", () => {
  const spec = "7:54\n16/35:250\n5:10,11,14";
  const map1 = parsePatch(spec);
  const s1 = serializePatch(map1);
  const map2 = parsePatch(s1);
  const s2 = serializePatch(map2);
  assert.equal(s1, s2, "serialize doit être stable après re-parse");
  // équivalence sémantique : mêmes résolutions
  for (let ch = 1; ch <= 60; ch++) {
    assert.deepEqual(resolvePatch(map1, ch), resolvePatch(map2, ch), `divergence canal ${ch}`);
  }
});

// ── (j) serialize multi-cibles & union ───────────────────────
check("serialize union -> '5:10,12'", () => {
  const map = parsePatch("5:12;5:10");
  assert.equal(serializePatch(map), "5:10,12");
});

console.log("");
if (failures > 0) {
  console.error(`patchTable: ${failures} test(s) en échec.`);
  process.exit(1);
}
console.log("patchTable: tous les tests OK.");

// ─────────────────────────────────────────────────────────────────────────
// gdtfImport.test.ts — test node SANS dépendance (node:assert/strict).
// Teste UNIQUEMENT la logique pure : mapGdtfAttributeToType + toAppFixture.
// Pas de DOMParser, pas de DecompressionStream → tourne hors navigateur.
//   Exécution :  npm run test:gdtf  (depuis apps/web)
// ─────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  mapGdtfAttributeToType,
  toAppFixture,
  type ParsedGdtfFixture,
} from "../src/lib/gdtfImport";

let failures = 0;
function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${label}`);
  } catch (err) {
    failures++;
    console.log(`❌ ${label} — ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── mapGdtfAttributeToType ──────────────────────────────────────────────
test("Pan / Tilt / Dimmer de base", () => {
  assert.equal(mapGdtfAttributeToType("Pan"), "pan");
  assert.equal(mapGdtfAttributeToType("Tilt"), "tilt");
  assert.equal(mapGdtfAttributeToType("Dimmer"), "dimmer");
});

test("Les 4 couleurs additives ColorAdd_*", () => {
  assert.equal(mapGdtfAttributeToType("ColorAdd_R"), "red");
  assert.equal(mapGdtfAttributeToType("ColorAdd_G"), "green");
  assert.equal(mapGdtfAttributeToType("ColorAdd_B"), "blue");
  assert.equal(mapGdtfAttributeToType("ColorAdd_W"), "white");
});

test("Casse mixte tolérée", () => {
  assert.equal(mapGdtfAttributeToType("pAn"), "pan");
  assert.equal(mapGdtfAttributeToType("DIMMER"), "dimmer");
  assert.equal(mapGdtfAttributeToType("coloradd_b"), "blue");
});

test("Suffixes numériques (Gobo1, Color2, Shutter1)", () => {
  assert.equal(mapGdtfAttributeToType("Gobo1"), "gobo");
  assert.equal(mapGdtfAttributeToType("Color2"), "color_wheel");
  assert.equal(mapGdtfAttributeToType("Shutter1"), "shutter");
});

test("_fine distingué de coarse", () => {
  assert.equal(mapGdtfAttributeToType("Pan_fine"), "pan_fine");
  assert.equal(mapGdtfAttributeToType("Tilt_fine"), "tilt_fine");
});

test("Strobe / Zoom / Focus / Iris / Prism", () => {
  assert.equal(mapGdtfAttributeToType("StrobeRandom"), "strobe");
  assert.equal(mapGdtfAttributeToType("Zoom"), "zoom");
  assert.equal(mapGdtfAttributeToType("Focus"), "focus");
  assert.equal(mapGdtfAttributeToType("Iris"), "iris");
  assert.equal(mapGdtfAttributeToType("Prism1"), "prism");
});

test("Attribut inconnu → fallback 'other'", () => {
  assert.equal(mapGdtfAttributeToType("Frobnicator"), "other");
  assert.equal(mapGdtfAttributeToType(""), "other");
});

// ─── toAppFixture (pur, sans XML) ────────────────────────────────────────
test("toAppFixture mappe offset→channel et attribute→type", () => {
  const parsed: ParsedGdtfFixture = {
    name: "Test Mover",
    manufacturer: "Acme",
    modes: [
      {
        name: "8ch",
        channels: [
          { attribute: "Dimmer", type: "dimmer", offset: 3 },
          { attribute: "Pan", type: "pan", offset: 1 },
          { attribute: "ColorAdd_R", type: "red", offset: 2 },
        ],
      },
    ],
  };

  const payload = toAppFixture(parsed, 0, 10);

  assert.equal(payload.name, "Test Mover");
  assert.equal(payload.manufacturer, "Acme");
  assert.equal(payload.startAddress, 10);
  assert.equal(payload.total_channels, 3);

  // Réindexé 1-based dans l'ordre des offsets : Pan(1), ColorAdd_R(2), Dimmer(3).
  assert.deepEqual(
    payload.channels.map((c) => [c.channel, c.function, c.type]),
    [
      [1, "Pan", "pan"],
      [2, "ColorAdd_R", "red"],
      [3, "Dimmer", "dimmer"],
    ],
  );
});

test("toAppFixture lève si mode introuvable", () => {
  const parsed: ParsedGdtfFixture = { name: "X", manufacturer: "", modes: [] };
  assert.throws(() => toAppFixture(parsed, 0, 1));
});

// ─── Sortie ──────────────────────────────────────────────────────────────
if (failures > 0) {
  console.log(`\n${failures} test(s) en échec.`);
} else {
  console.log("\nTous les tests passent.");
}
process.exit(failures ? 1 : 0);

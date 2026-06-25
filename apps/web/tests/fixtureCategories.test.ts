// ─────────────────────────────────────────────────────────────────────────
// fixtureCategories.test.ts — test node SANS dépendance (node:assert/strict).
// Couvre l'inférence de catégorie (nom + signature canaux) et la sécurité.
//   Exécution :  npm run test:categories  (depuis apps/web)
// ─────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  inferFixtureCategory,
  getSafetyClass,
  isArmingRequired,
  isHazard,
  FIXTURE_CATEGORY_LIST,
  FIXTURE_CATEGORIES,
} from "../src/lib/fixtureCategories";

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

// ─── Inférence par NOM ───────────────────────────────────────────────────
test("Effets/dangers reconnus au nom (priorité haute)", () => {
  assert.equal(inferFixtureCategory("Laser RGB 3W"), "laser");
  assert.equal(inferFixtureCategory("Machine à fumée 1500W"), "smoke");
  assert.equal(inferFixtureCategory("Antari Hazer Z-1000"), "hazer");
  assert.equal(inferFixtureCategory("Jet CO2 Cryo"), "co2");
  assert.equal(inferFixtureCategory("Sparkular cold spark"), "pyro");
  assert.equal(inferFixtureCategory("Ventilateur DMX"), "fan");
});

test("Le mot dangereux l'emporte sur un mot générique", () => {
  // "Laser Wash" ne doit pas devenir un wash LED.
  assert.equal(inferFixtureCategory("Laser Wash Effect"), "laser");
});

test("Têtes mobiles reconnues au nom", () => {
  assert.equal(inferFixtureCategory("Showtec Moving Head Spot 60W"), "lyre_spot");
  assert.equal(inferFixtureCategory("Beam 230 7R"), "lyre_beam");
  assert.equal(inferFixtureCategory("Scanner 250"), "scanner");
});

test("Statiques reconnus au nom", () => {
  assert.equal(inferFixtureCategory("UV Bar 18x3W"), "uv"); // uv prioritaire sur 'bar'
  assert.equal(inferFixtureCategory("Stairville LED PAR 56"), "par_led");
  assert.equal(inferFixtureCategory("Pixel Bar 360"), "led_bar");
  assert.equal(inferFixtureCategory("Atomic Strobe 3000"), "strobe");
});

// ─── Inférence par SIGNATURE de canaux (nom neutre) ──────────────────────
test("Signature pan+tilt+gobo ⇒ lyre spot", () => {
  assert.equal(
    inferFixtureCategory("Projecteur X", ["dimmer", "pan", "tilt", "gobo", "color_wheel"]),
    "lyre_spot",
  );
});

test("Signature pan+tilt sans gobo mais couleur ⇒ lyre wash", () => {
  assert.equal(
    inferFixtureCategory("Engin Y", ["dimmer", "pan", "tilt", "red", "green", "blue"]),
    "lyre_wash",
  );
});

test("Signature RGB sans mouvement ⇒ PAR LED", () => {
  assert.equal(inferFixtureCategory("Appareil Z", ["red", "green", "blue", "white"]), "par_led");
});

test("Dimmer seul ⇒ projecteur trad.", () => {
  assert.equal(inferFixtureCategory("Lampe", ["dimmer"]), "conventional");
});

test("Inconnu total ⇒ generic", () => {
  assert.equal(inferFixtureCategory("Truc bidule", []), "generic");
});

// ─── Sécurité par catégorie ──────────────────────────────────────────────
test("Classes de sécurité correctes", () => {
  assert.equal(getSafetyClass("laser"), "hazard");
  assert.equal(getSafetyClass("pyro"), "hazard");
  assert.equal(getSafetyClass("smoke"), "effect");
  assert.equal(getSafetyClass("hazer"), "effect");
  assert.equal(getSafetyClass("co2"), "effect");
  assert.equal(getSafetyClass("par_led"), "normal");
  assert.equal(getSafetyClass("lyre_spot"), "normal");
});

test("Armement requis pour effets et dangers, pas pour le reste", () => {
  assert.equal(isArmingRequired("laser"), true);
  assert.equal(isArmingRequired("smoke"), true);
  assert.equal(isArmingRequired("fan"), false); // effet mais inoffensif
  assert.equal(isArmingRequired("par_led"), false);
  assert.equal(isHazard("laser"), true);
  assert.equal(isHazard("smoke"), false); // effet à armer mais non dangereux
});

// ─── Cohérence du registre ───────────────────────────────────────────────
test("Le registre est cohérent (id == clé, generic présent)", () => {
  for (const cat of FIXTURE_CATEGORY_LIST) {
    assert.equal(FIXTURE_CATEGORIES[cat.id].id, cat.id, `id incohérent: ${cat.id}`);
  }
  assert.ok(FIXTURE_CATEGORIES.generic, "famille generic absente");
});

// ─── Sortie ──────────────────────────────────────────────────────────────
if (failures > 0) {
  console.log(`\n${failures} test(s) en échec.`);
} else {
  console.log("\nTous les tests passent.");
}
process.exit(failures ? 1 : 0);

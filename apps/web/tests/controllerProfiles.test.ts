// ─────────────────────────────────────────────────────────────────────────
// controllerProfiles.test.ts — test node SANS dépendance (node:assert/strict).
// Couvre la classification de couleur et le mapping couleur → vélocité LED.
//   Exécution :  npm run test:controllers  (depuis apps/web)
// ─────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  classifyColor,
  classifyRgb,
  colorToVelocity,
  ledNoteMessage,
  matchControllerByPortName,
  getControllerProfile,
} from "../src/lib/controllerProfiles";

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

// ─── classifyColor (Tailwind + hex) ──────────────────────────────────────
test("Classes Tailwind reconnues", () => {
  assert.equal(classifyColor("bg-cyan-500"), "cyan");
  assert.equal(classifyColor("bg-red-600"), "red");
  assert.equal(classifyColor("text-amber-400"), "amber");
  assert.equal(classifyColor("bg-emerald-500"), "green");
  assert.equal(classifyColor("bg-slate-700"), "off");
});

test("Hex classés par teinte", () => {
  assert.equal(classifyColor("#ff0000"), "red");
  assert.equal(classifyColor("#00ff00"), "green");
  assert.equal(classifyColor("#0000ff"), "blue");
  assert.equal(classifyColor("#22d3ee"), "cyan");
  assert.equal(classifyColor("#000000"), "off");
  assert.equal(classifyColor("#ffffff"), "white");
});

test("Hex court #rgb supporté", () => {
  assert.equal(classifyColor("#f00"), "red");
  assert.equal(classifyColor("#0f0"), "green");
});

test("classifyRgb directe", () => {
  assert.equal(classifyRgb(255, 180, 0), "amber");
  assert.equal(classifyRgb(10, 10, 10), "off");
  assert.equal(classifyRgb(200, 200, 200), "white");
});

// ─── colorToVelocity : APC mini (velocity3) ──────────────────────────────
test("APC mini réduit aux 3 couleurs", () => {
  assert.equal(colorToVelocity("apc_mini", "bg-green-500"), 1);  // vert
  assert.equal(colorToVelocity("apc_mini", "bg-red-500"), 3);    // rouge
  assert.equal(colorToVelocity("apc_mini", "bg-amber-500"), 5);  // jaune
  assert.equal(colorToVelocity("apc_mini", "bg-cyan-500"), 1);   // cyan → vert
  assert.equal(colorToVelocity("apc_mini", "bg-purple-500"), 3); // violet → rouge
});

test("APC mini : pad actif = variante clignotante", () => {
  assert.equal(colorToVelocity("apc_mini", "bg-green-500", true), 2);
  assert.equal(colorToVelocity("apc_mini", "bg-red-500", true), 4);
  assert.equal(colorToVelocity("apc_mini", "bg-amber-500", true), 6);
});

test("Couleur éteinte/neutre = 0 (off)", () => {
  assert.equal(colorToVelocity("apc_mini", "bg-slate-800"), 0);
  assert.equal(colorToVelocity("apc_mini", ""), 0);
  assert.equal(colorToVelocity("apc_mini", "#000000"), 0);
});

// ─── colorToVelocity : contrôleur RGB ────────────────────────────────────
test("Launchpad (rgb) renvoie des vélocités de palette distinctes", () => {
  const red = colorToVelocity("launchpad_mk3", "#ff0000");
  const green = colorToVelocity("launchpad_mk3", "#00ff00");
  const blue = colorToVelocity("launchpad_mk3", "#0000ff");
  assert.ok(red > 0 && green > 0 && blue > 0, "vélocités non nulles");
  assert.notEqual(red, green);
  assert.notEqual(green, blue);
  assert.equal(colorToVelocity("launchpad_mk3", "#000000"), 0);
});

// ─── ledNoteMessage : message MIDI complet ───────────────────────────────
test("APC mini mk2 : couleur en vélocité, comportement via le canal", () => {
  // Pad fixe rouge : canal 6 (0x96=150), vélocité = palette rouge (5).
  assert.deepEqual(ledNoteMessage("apc_mini_mk2", 12, "#ff0000", false), [0x96, 12, 5]);
  // Pad ACTIF rouge : canal pulse 10 (0x9A=154), même couleur.
  assert.deepEqual(ledNoteMessage("apc_mini_mk2", 12, "#ff0000", true), [0x9a, 12, 5]);
  // Couleur éteinte : note off canal 0, vélocité 0.
  assert.deepEqual(ledNoteMessage("apc_mini_mk2", 12, "", false), [0x90, 12, 0]);
});

test("Launchpad mk3 : canal statique vs pulse", () => {
  const solid = ledNoteMessage("launchpad_mk3", 30, "#00ff00", false);
  const pulse = ledNoteMessage("launchpad_mk3", 30, "#00ff00", true);
  assert.equal(solid[0], 0x90); // statique
  assert.equal(pulse[0], 0x92); // pulse
  assert.equal(solid[2], pulse[2]); // même couleur
  assert.ok(solid[2] > 0);
});

test("APC mini d'origine (velocity3) : canal 0, clignotement dans la vélocité", () => {
  assert.deepEqual(ledNoteMessage("apc_mini", 5, "bg-green-500", false), [0x90, 5, 1]);
  assert.deepEqual(ledNoteMessage("apc_mini", 5, "bg-green-500", true), [0x90, 5, 2]); // clignotant
});

// ─── Détection de profil par nom de port ─────────────────────────────────
test("Reconnaissance du contrôleur par nom de port", () => {
  assert.equal(matchControllerByPortName("APC mini MIDI 1")?.id, "apc_mini");
  assert.equal(matchControllerByPortName("APC mini mk2")?.id, "apc_mini_mk2");
  assert.equal(matchControllerByPortName("Launchpad Mini MK3 LPX")?.id, "launchpad_mk3");
  assert.equal(matchControllerByPortName("Clavier random"), null);
});

test("getControllerProfile retombe sur generic", () => {
  assert.equal(getControllerProfile(undefined).id, "generic");
  assert.equal(getControllerProfile("inexistant").id, "generic");
  assert.equal(getControllerProfile("apc_mini").id, "apc_mini");
});

// ─── Sortie ──────────────────────────────────────────────────────────────
if (failures > 0) {
  console.log(`\n${failures} test(s) en échec.`);
} else {
  console.log("\nTous les tests passent.");
}
process.exit(failures ? 1 : 0);

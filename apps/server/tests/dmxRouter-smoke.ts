import assert from "node:assert/strict";

// ============================================================
// dmxRouter — smoke test de la boucle de refresh 40Hz (P0-ENGINE)
// ------------------------------------------------------------
// Vérifie le comportement de batching central introduit pour
// corriger le risque #1 de l'audit (fan-out immédiat par canal).
//
// Stratégie : on ne mock pas les imports ESM. On remplace les
// méthodes des sorties singleton (usbDmx / qlcWs / pythonDmx) par
// des compteurs, puis on observe combien de fois le router émet
// par flush. Pas de framework : node:assert + ts-node, comme
// api-smoke.ts. Exécution : `npm run test:dmx`.
// ============================================================

process.env.NODE_ENV = process.env.NODE_ENV || "test"; // désactive le port OSC réel (cf. qlc.ts)

import { dmxRouter } from "../services/dmxRouter";
import { usbDmx } from "../services/usbDmx";
import { qlcWs } from "../services/qlcWsService";
import { pythonDmx } from "../services/pythonDmx";
import { outputHealth } from "../services/outputHealth";

// ── Compteurs de sortie (monkey-patch additif, non destructif) ──
let usbCount = 0;
let wsCount = 0;
let pyCount = 0;
const lastWs: { universe: number; channel: number; value: number } = { universe: 0, channel: 0, value: 0 };

(usbDmx as any).setChannel = (_channel: number, _value: number) => { usbCount += 1; };
(usbDmx as any).flushNow = async () => { /* no-op : pas de port série en test */ };
(usbDmx as any).setExternalFlush = (_enabled: boolean) => { /* no-op */ };
(qlcWs as any).setChannel = (universe: number, channel: number, value: number) => {
  wsCount += 1;
  lastWs.universe = universe; lastWs.channel = channel; lastWs.value = value;
};
(pythonDmx as any).setChannel = (_u: number, _c: number, _v: number) => { pyCount += 1; };

// Compte les émissions réussies par sortie via le hook de santé du router
// (utilisé pour Art-Net, dont la fonction d'émission est un module non patchable ici).
const emits: Record<string, number> = {};
const realReportOk = outputHealth.reportOk.bind(outputHealth);
(outputHealth as any).reportOk = (id: string) => { emits[id] = (emits[id] || 0) + 1; realReportOk(id as any); };

function resetCounters() { usbCount = 0; wsCount = 0; pyCount = 0; for (const k of Object.keys(emits)) emits[k] = 0; }

// On ne garde que les sorties observables, et on coupe artNet/qlcOsc
// (fonctions de module, non patchables proprement ici).
dmxRouter.setOutputs({ usbDmx: true, qlcWs: true, python: true, artNet: false, qlcOsc: false });

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

let failures = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (err) { failures += 1; console.error(`  ❌ ${name}\n     ${(err as Error).message}`); }
}

async function main() {
  console.log("dmxRouter-smoke — boucle de refresh 40Hz\n");

  // (a) N écritures sur le même canal entre 2 flushs = 1 seul envoi par sortie.
  check("(a) batching : 10 writes sur 1 canal = 1 emit/flush", () => {
    resetCounters();
    const U = 90, CH = 10;
    for (let v = 1; v <= 10; v += 1) dmxRouter.setChannel(U, CH, v);
    dmxRouter.flushNow();
    assert.equal(wsCount, 1, `qlcWs émis ${wsCount} fois (attendu 1)`);
    assert.equal(usbCount, 1, `usbDmx émis ${usbCount} fois (attendu 1)`);
    assert.equal(pyCount, 1, `python émis ${pyCount} fois (attendu 1)`);
    assert.equal(lastWs.value, 10, `dernière valeur envoyée ${lastWs.value} (attendu 10)`);
  });

  // (b) Émission différentielle : ré-écrire la même valeur ne ré-émet rien.
  check("(b) différentiel : ré-écrire la valeur courante = 0 emit", () => {
    const U = 91, CH = 5;
    dmxRouter.setChannel(U, CH, 200);
    dmxRouter.flushNow();
    resetCounters();
    dmxRouter.setChannel(U, CH, 200); // identique à l'état committé
    dmxRouter.flushNow();
    assert.equal(wsCount, 0, `qlcWs émis ${wsCount} fois (attendu 0)`);
    assert.equal(usbCount, 0, `usbDmx émis ${usbCount} fois (attendu 0)`);
  });

  // (c) Plusieurs canaux distincts dirty = un emit par canal.
  check("(c) 5 canaux distincts = 5 emits", () => {
    resetCounters();
    const U = 92;
    for (let ch = 1; ch <= 5; ch += 1) dmxRouter.setChannel(U, ch, ch * 10);
    dmxRouter.flushNow();
    assert.equal(wsCount, 5, `qlcWs émis ${wsCount} fois (attendu 5)`);
  });

  // (d) getLiveUniverse reflète l'état committé après flush.
  check("(d) getLiveUniverse reflète l'état committé", () => {
    const U = 93;
    dmxRouter.setChannel(U, 42, 123);
    dmxRouter.flushNow();
    const live = dmxRouter.getLiveUniverse(U);
    assert.equal(live[42], 123, `getLiveUniverse[42] = ${live[42]} (attendu 123)`);
    assert.equal(live[1], undefined, "les canaux à 0 ne sont pas listés");
  });

  // (e) Clamp 0-255 appliqué à l'écriture.
  check("(e) clamp 0-255", () => {
    const U = 94;
    dmxRouter.setChannel(U, 1, 999);
    dmxRouter.setChannel(U, 2, -50);
    dmxRouter.flushNow();
    const live = dmxRouter.getLiveUniverse(U);
    assert.equal(live[1], 255, `valeur sur-bornée = ${live[1]} (attendu 255)`);
    assert.equal(live[2], undefined, `valeur négative = ${live[2]} (attendu 0/absent)`);
  });

  // (f) La boucle de refresh tourne d'elle-même (~40Hz) sans flushNow manuel.
  await check2("(f) flush automatique par la boucle 40Hz", async () => {
    resetCounters();
    dmxRouter.setChannel(95, 7, 88);
    await sleep(120); // ≥ 4 ticks à 25ms
    assert.ok(wsCount >= 1, `aucun flush automatique observé (wsCount=${wsCount})`);
  });

  // (g) Art-Net : UN seul paquet par univers dirty, quel que soit le nb de canaux (anti-flood réseau).
  check("(g) Art-Net : 5 canaux dirty = 1 seul envoi d'univers", () => {
    dmxRouter.setOutputs({ artNet: true, usbDmx: false, qlcWs: false, python: false, qlcOsc: false });
    resetCounters();
    const U = 96;
    for (let ch = 1; ch <= 5; ch += 1) dmxRouter.setChannel(U, ch, ch * 7);
    dmxRouter.flushNow();
    assert.equal(emits.artNet || 0, 1, `artNet émis ${emits.artNet || 0} fois (attendu 1 paquet/univers)`);
    // restaure la config des autres checks
    dmxRouter.setOutputs({ usbDmx: true, qlcWs: true, python: true, artNet: false, qlcOsc: false });
  });

  console.log(failures === 0 ? "\n✅ dmxRouter-smoke : tous les checks passent" : `\n❌ dmxRouter-smoke : ${failures} échec(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

// variante async de check()
async function check2(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`  ✅ ${name}`); }
  catch (err) { failures += 1; console.error(`  ❌ ${name}\n     ${(err as Error).message}`); }
}

main().catch((err) => { console.error(err); process.exit(1); });

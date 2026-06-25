/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  validateOrchestratorAction,
  validateOrchestratorActions,
} = require("../src/lib/orchestratorSafety");

// Contexte de base : canaux 10 et 20 dangereux, désarmés.
const ctxDisarmed = { dangerousChannels: new Set([10, 20]), dangerousArmed: false };
const ctxArmed = { dangerousChannels: new Set([10, 20]), dangerousArmed: true };

// (a) Action normale => allowed + clamp identité.
{
  const r = validateOrchestratorAction({ universe: 1, channel: 5, value: 128 }, ctxDisarmed);
  assert.equal(r.allowed, true, "action normale doit être autorisée");
  assert.equal(r.clampedValue, 128, "clamp identité attendu pour 128");
  assert.equal(r.reason, undefined);
}

// (b) value 999 => clampedValue 255.
{
  const r = validateOrchestratorAction({ universe: 1, channel: 5, value: 999 }, ctxDisarmed);
  assert.equal(r.allowed, true);
  assert.equal(r.clampedValue, 255, "value 999 doit être bornée à 255");
}

// (b-bis) value négative => 0 ; value non finie => 0.
{
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 5, value: -50 }, ctxDisarmed).clampedValue, 0);
  // Non finie (NaN/Infinity) => 0 par défaut défensif (jamais une sortie pleine inattendue).
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 5, value: NaN }, ctxDisarmed).clampedValue, 0);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 5, value: Infinity }, ctxDisarmed).clampedValue, 0);
  // value décimale => arrondie.
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 5, value: 127.6 }, ctxDisarmed).clampedValue, 128);
}

// (c) Channel dangereux non armé => allowed=false avec reason.
{
  const r = validateOrchestratorAction({ universe: 1, channel: 10, value: 200 }, ctxDisarmed);
  assert.equal(r.allowed, false, "canal dangereux non armé doit être bloqué");
  assert.equal(r.reason, "canal dangereux non armé");
  assert.equal(r.clampedValue, undefined);
}

// (d) Channel dangereux armé => allowed.
{
  const r = validateOrchestratorAction({ universe: 1, channel: 10, value: 200 }, ctxArmed);
  assert.equal(r.allowed, true, "canal dangereux armé doit passer");
  assert.equal(r.clampedValue, 200);
}

// (e) Channel hors 1..512 => bloqué (bas et haut), value n'est pas pertinente.
{
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 0, value: 100 }, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 513, value: 100 }, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: -3, value: 100 }, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: NaN, value: 100 }, ctxArmed).allowed, false);
  // Bornes inclusives 1 et 512 acceptées.
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 1, value: 100 }, ctxArmed).allowed, true);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 512, value: 100 }, ctxArmed).allowed, true);
}

// (e-bis) Universe < 1 => bloqué.
{
  assert.equal(validateOrchestratorAction({ universe: 0, channel: 5, value: 100 }, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: -1, channel: 5, value: 100 }, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 5, value: 100 }, ctxArmed).allowed, true);
}

// (e-ter) dangerousChannels accepté en tableau aussi.
{
  const ctxArr = { dangerousChannels: [10, 20], dangerousArmed: false };
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 10, value: 50 }, ctxArr).allowed, false);
  assert.equal(validateOrchestratorAction({ universe: 1, channel: 7, value: 50 }, ctxArr).allowed, true);
}

// (e-quater) Action malformée => bloquée proprement.
{
  assert.equal(validateOrchestratorAction(null, ctxArmed).allowed, false);
  assert.equal(validateOrchestratorAction({}, ctxArmed).allowed, false);
}

// (f) validateOrchestratorActions sépare applied/blocked correctement.
{
  const actions = [
    { universe: 1, channel: 5, value: 128 },   // ok
    { universe: 1, channel: 10, value: 999 },  // dangereux non armé -> blocked
    { universe: 1, channel: 600, value: 50 },  // hors borne -> blocked
    { universe: 1, channel: 7, value: 300 },   // ok, clamp 255
  ];
  const { applied, blocked } = validateOrchestratorActions(actions, ctxDisarmed);
  assert.equal(applied.length, 2, "2 actions appliquées attendues");
  assert.equal(blocked.length, 2, "2 actions bloquées attendues");

  // applied porte les valeurs bornées et normalisées.
  assert.deepEqual(applied[0], { universe: 1, channel: 5, value: 128 });
  assert.deepEqual(applied[1], { universe: 1, channel: 7, value: 255 });

  // blocked porte une raison.
  assert.equal(blocked[0].reason, "canal dangereux non armé");
  assert.ok(typeof blocked[1].reason === "string" && blocked[1].reason.length > 0);
}

// (f-bis) Mêmes actions, contexte armé : seul le hors-borne reste bloqué.
{
  const actions = [
    { universe: 1, channel: 10, value: 200 },  // dangereux mais armé -> applied
    { universe: 1, channel: 600, value: 50 },  // hors borne -> blocked
  ];
  const { applied, blocked } = validateOrchestratorActions(actions, ctxArmed);
  assert.equal(applied.length, 1);
  assert.equal(blocked.length, 1);
  assert.deepEqual(applied[0], { universe: 1, channel: 10, value: 200 });
}

// (f-ter) Entrée non-tableau => résultat vide, pas de crash.
{
  const { applied, blocked } = validateOrchestratorActions(null, ctxArmed);
  assert.equal(applied.length, 0);
  assert.equal(blocked.length, 0);
}

// (g) Déterminisme : mêmes entrées => même sortie.
{
  const a = { universe: 1, channel: 10, value: 77 };
  const r1 = validateOrchestratorAction(a, ctxDisarmed);
  const r2 = validateOrchestratorAction(a, ctxDisarmed);
  assert.deepEqual(r1, r2);
}

console.log("orchestratorSafety tests passed");

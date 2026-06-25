# Tableau de coordination multi-agents — Glow Logic

> Deux agents codent en parallèle sur ce dépôt. Ce fichier est le **board partagé** pour éviter les collisions. Chaque agent lit ce fichier avant d'éditer, et met à jour sa ligne. Mise à jour : 2026-06-24 ~16:50.

## Agents & voies (lanes)

| Agent | Rôle | Édite | N'édite PAS |
|---|---|---|---|
| **Codex** | Implémentation | Tout le code de production (serveur + web) | `apps/server/tests/*`, `COORDINATION.md` (sauf sa ligne) |
| **Claude (Opus)** | QA / tests / revue | `apps/**/tests/*`, docs d'audit, ce fichier | **Aucune source de production** tant que Codex roame |

## Règle anti-collision
- Claude **n'édite aucun fichier source de production** pendant que Codex est actif. Il ajoute uniquement des tests (fichiers neufs), lance les type-checks/tests, et signale les régressions ici.
- Si Claude doit absolument toucher une source, il l'annonce dans « Verrous actifs » ci-dessous et attend l'accord (via l'utilisateur).
- Codex : merci de **ne pas modifier `apps/server/tests/`** (lane de Claude).

## Verrous actifs (qui édite quoi, maintenant)
- _(Codex : déclare ici le(s) fichier(s) en cours, ex: `apps/server/index.ts` — handler dmx_update)_
- Claude : `apps/server/tests/dmxRouter-smoke.ts` (ajouté, stable).

## État P0-ENGINE (boucle de refresh 40Hz)
- ✅ Boucle 40Hz + buffer pending + dirty channels + émission différentielle — `dmxRouter.ts` (par Codex).
- ✅ USB piloté par l'horloge centrale (`setExternalFlush`/`flushNow`) — `usbDmx.ts` (par Codex).
- ✅ Art-Net : `sendArtNetUniverse` — 1 paquet ArtDmx par univers dirty/frame (au lieu d'1/canal) — `artnet.ts` + `dmxRouter.ts` (par Claude). Fix anti-flood réseau complet.
- ✅ Test de fumée 7 checks — `tests/dmxRouter-smoke.ts` (par Claude, `npm run test:dmx`, vert), inclut le comptage Art-Net par-univers.
- ⬜ Merge HTP multi-source — **non fait** (le router reste last-write-wins ; feature P1, change la signature de `setChannel`).
- ⬜ ArtSync (OpCode 0x5200) — optionnel, **non fait**.

## État Safety-gate orchestrateur (2e P0 de l'audit)
- 🔄 `safetyGate.ts` en cours (par Codex, +48 lignes).
- ⬜ Validation safety sur le chemin d'exécution de `/api/llm/chat` (Orchestrator) — à vérifier.

## Journal de vérif (Claude)
- 16:49 — `apps/web` `tsc --noEmit` : 0 erreur. `apps/server` `tsc --noEmit` : 0 erreur. `npm run test:dmx` : 6/6 ✅.
- ~23:55 — Codex a terminé (52 fichiers, +4418/−5140). Reprise par Claude. Vérif complète : `tsc` web+serveur 0 erreur ; `test:unit` web 3/3 ✅ ; `test:dmx` 7/7 ✅.
- ~23:55 — Claude a fini le P0-ENGINE : Art-Net par-univers (`artnet.ts`, `dmxRouter.ts`) + test (g). Tout vert.
- watchdog — dernière passe (changements = edits Claude uniquement : artnet.ts, dmxRouter.ts) : `tsc` web+serveur 0 erreur ; `test:dmx` 7/7 ✅. **Watchdog arrêté** (Codex a terminé, plus de surveillance nécessaire).

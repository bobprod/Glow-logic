# 04 — Revue d'expertise post-implémentation (Codex) — 2026-06-12

> Revue frontend + backend du code livré par Codex contre les specs C1-C10 (+ extras C11-C13 auto-attribués par Codex). Méthode : 3 revues parallèles (frontend, backend, intégration/qualité) + contre-vérification manuelle de chaque bug « critique » signalé. Build `next build` + typecheck : **PASS (exit 0)**.

## 1. Verdict global

**Conformité remarquable : les 10 chantiers sont implémentés**, plus des extras pertinents non demandés mais alignés avec l'audit (file offline DMX = C12, scripts TTFL/field-validation = discipline §2-3, CI GitHub Actions = C11). Les migrations (pads paginés, clés MIDI, groupes, blackout unifié, schéma projet v5) sont réelles et appelées aux deux endroits requis (hydratation + chargement projet). Le lexique FR est appliqué. Les flags transitoires ne sont pas persistés.

**Note : B+.** Ce qui sépare de A : du code mort laissé derrière, une fusion C8c incomplète (PatchPanel survit), 2 vrais défauts backend, et 3 étapes du scénario de référence non automatisées.

## 2. Fausses alertes écartées (contre-vérifiées à la main — ne PAS « corriger »)

| Alerte agent | Réalité |
|---|---|
| « 15+ fetch() bruts → 401 » | **Faux.** `installAuthFetch()` (`lib/config.ts:99-116`) patche `window.fetch` au chargement du module et injecte le Bearer sur toute URL `/api/` (avec bootstrap automatique du token). Les fetch bruts sont couverts. |
| « Migration clés MIDI pad_<id> non faite » | **Faux.** `migratePadMidiMappings` (`smartModeSlice.ts:154`) est appelée dans `useStore.ts:96` (réhydratation) ET `projectMigration.ts:69` (chargement projet). |
| « simplifyKeyframes.ts orphelin » | **Faux.** Importé par `FixtureInspectorPanel.tsx:10` (REC C4) et `trajectoryGenerator.ts:1` (C7). |

## 3. Défauts réels confirmés (par priorité)

> **Mise à jour 2026-06-12 (même session)** : le « lot finitions » est appliqué et validé (typecheck + build + test:unit + test:api verts). Corrigés : **P1-1** (flag `python` séparé dans OutputConfig, exposé via `/api/dmx/router`, toggle + avertissement de conflit COM dans SettingsModal, assertion d'indépendance ajoutée au smoke test ; comportement existant préservé — les deux flags suivent la connexion du dongle, mais sont désormais indépendamment désactivables et leur santé n'est plus confondue), **P1-3** (283 lignes mortes supprimées de SmartDashboard — désormais 1 688 lignes — et `three/FixtureInspector.tsx` supprimé), **P2-4** (CORS : header émis uniquement si Origin présent et autorisé, `Vary: Origin` systématique), **P2-5** (stub `/api/dmx/output-status` ajouté à stubBackend). Restent ouverts : **P1-2** (fusion C8c / mort de PatchPanel), **P2-6** (migration progressive vers `apiFetch`), et les manques §4 (E2E jamais exécutés, étapes 5/8 du scénario, rituel humain).
1. **Conflation python/usbDmx dans `dmxRouter.ts`** (lignes 89 et 125) : les DEUX écritures série (bridge Python `pythonDmx` ET port série direct `usbDmx`) sont gardées par le même flag `config.usbDmx`. Conséquences : (a) double écriture potentielle vers le même port COM — un seul process peut le tenir, l'autre tombera en erreur permanente → bruit `error` constant dans le badge C9 ; (b) impossible d'activer l'un sans l'autre. *Défaut hérité du code d'origine, rendu visible par C9.* **Fix : ajouter `python: boolean` à `OutputConfig`, séparer les deux blocs, exposer les deux toggles dans `/api/dmx/router` et l'UI Sorties DMX.*
2. **Fusion C8c incomplète** : `PatchPanel.tsx` (2 722 lignes) est toujours rendu pour `proView === 'patch'` ; `StagePlan capabilities='build'` existe en parallèle. Deux éditeurs de patch coexistent à nouveau — exactement l'anti-pattern que C8 devait tuer. **Fix : terminer C8c** (migrer le panneau de patch d'adresses/profils/venues dans `smart/patch/*`, supprimer le plan 2D de PatchPanel, puis le fichier).
3. **~300 lignes de code mort dans `SmartDashboard.tsx`** : `renderGroupStrips()` et `renderStagePlan()` font `return <Composant />` suivi de tout l'ancien corps inatteignable (lignes ~655+ et ~747+). Plus `three/FixtureInspector.tsx` orphelin (plus aucun import). **Fix : suppression simple.**

### P2 — À corriger rapidement
4. **CORS : fallback si `Origin` absent** (`index.ts` ~135-146) : une requête sans header Origin reçoit `Access-Control-Allow-Origin: http://localhost:3000`. Risque faible (le Bearer reste exigé) mais contraire à C10-S6. **Fix : ne poser le header que si origin présent ET autorisé, + `Vary: Origin`.**
5. **Stub Playwright manquant** : `tests/helpers/stubBackend.ts` ne stubbe pas `/api/dmx/output-status` → tout futur test touchant le badge C9 échouera en silence. **Fix : 10 lignes.**
6. **Monkey-patch `window.fetch` comme stratégie d'auth** : ça marche, mais c'est fragile (ordre d'évaluation des modules, autres libs qui re-patchent, web workers non couverts). **Piste : migration progressive des appels vers `apiFetch()` explicite, garder le patch comme filet.**

## 4. Ce qui manque (vs specs et discipline)

| Manque | Réf | Impact |
|---|---|---|
| Scénario de référence : étapes 5 (REC 10 s), 8 (débrancher sortie → badge ≤ 5 s) non automatisées dans `show-from-scratch.spec.ts` (étape 4 MIDI hors-scope Playwright, OK) | 03-DISCIPLINE §2 | Les deux features les plus différenciantes (C4, C9) n'ont aucune couverture E2E |
| Exécution Playwright bloquée dans l'environnement Codex (spawn EPERM Windows, documenté par Codex) — les specs E2E n'ont donc **jamais tourné** | C11 | Confiance zéro tant qu'un run réel (CI Linux ou poste dev) n'est pas vert |
| Toast frontend à l'expiration d'armement 30 min non vérifié | C10-S9 | Mineur |
| Re-test de l'automation après rechargement projet (étape 7 partielle) | 03 §2 | Moyen |
| `groupColors` conservé en doublon de `DmxGroup.color` (compat assumée) | C5 | Dette acceptée, à purger en C8c |

## 5. Pistes d'amélioration (prochaine itération, dans l'ordre)

1. **Lot « finitions » (1 session Codex)** : défauts P1-1, P1-3, P2-4, P2-5 — petits, mécaniques, spec ci-dessus suffit.
2. **Faire tourner la CI pour de vrai** : pousser sur GitHub, vérifier que `.github/workflows/ci.yml` passe (Linux élimine le spawn EPERM) ; ajouter les étapes 5 et 8 au spec Playwright avec le stub output-status.
3. **Terminer C8c** (mort de PatchPanel) — dernier gros morceau de convergence.
4. **Le rituel humain reste dû** : aucune validation manuelle « Show de zéro » n'a encore eu lieu sur ce code. C'est LE prochain geste — 15 minutes, scénario 03-DISCIPLINE §2, TTFL chronométré (`npm run field:ttfl` existe désormais). Aucun agent ne peut le faire à la place du PO.
5. Ensuite seulement : lever le moratoire au cas par cas (backlog).

## 6. État des extras livrés hors spec (audités, conservés)

- `lib/dmxOfflineQueue.ts` + tests : file DMX hors-ligne, branchée dans `dmxEngine` + badge TopBar — correspond à C12 de l'audit, bienvenu.
- `lib/offlineProjectBackup.ts` + `hooks/useOfflineProjectBackup` : snapshot projet 15 s, branché dans AppShell — bienvenu.
- `scripts/Measure-TTFL.ps1`, `New-FieldValidationReport.ps1`, `Run-ReleaseCandidateChecks.ps1` (+ npm scripts `field:*`, `release:check`) : outillage discipline §2-3 — bienvenu.
- `.github/workflows/ci.yml` : verify → unit → api → build → visual → show + rapport HTML — jamais exécuté à ce jour.

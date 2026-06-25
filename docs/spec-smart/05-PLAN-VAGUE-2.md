# 05 — Plan Vague 2 : dettes + améliorations prioritaires (pour agents codeurs)

> Plan d'exécution détaillé de la vague suivante. Même règles que la vague 1 : un chantier = une session agent = une PR ; charger UNIQUEMENT le fichier chantier + les fichiers listés dans son en-tête ; `03-DISCIPLINE.md` reste contraignant (lexique, DoD, rituel post-chantier).
> Numérotation : C11-C13 ont été utilisés informellement par l'agent de la vague 1 (CI, offline, field-validation) — la vague 2 commence donc à **C14** pour éviter toute collision.

## Ordre d'exécution impératif

```
PORTE 1 (dettes, bloquantes) : D2 → D4 → D5 → C8c(D1)
PORTE 2 (validation humaine) : D3 — rituel PO, AUCUN agent ne peut la franchir à sa place
VAGUE 2 (features)           : C14 → C15 → C16 → (C17, C18 sur décision PO)
```

Un agent ne commence PAS C14 tant que la Porte 1 n'est pas mergée. La Porte 2 (rituel humain) peut se faire en parallèle de C14 mais conditionne toute release.

---

## PORTE 1 — Dettes (instructions agent, pas de fichier chantier dédié)

### D2 — Premier run CI réel
**Fichiers** : `.github/workflows/ci.yml`, `package.json` (racine + workspaces).
1. Pousser la branche sur GitHub, déclencher le workflow, lire les logs réels.
2. QUAND une étape échoue ALORS corriger la cause (pas de `continue-on-error`, pas de skip). Vérifier en particulier : `npm run verify` (ESLint tourne-t-il vraiment ? si « Premature close » ESLint v9 → downgrade ESLint 8 + `.eslintrc.json`), installation Playwright chromium, `test:visual` et `test:show` verts sous Linux.
3. AC : badge CI vert sur le commit de tête ; le rapport HTML Playwright est uploadé en artifact ; aucune étape skippée.

### D4 — Compléter le test E2E de référence
**Fichiers** : `apps/web/tests/show-from-scratch.spec.ts`, `apps/web/tests/helpers/stubBackend.ts`, `docs/spec-smart/03-DISCIPLINE.md §2` (lire).
1. Étape 5 du scénario : sélectionner une lyre sur le plan → inspecteur sidebar → simuler un drag sur le XY pad (pointer events) avec REC armé pendant ~2 s de lecture timeline → assert : 2 `automationTracks` (pan, tilt) avec ≥ 2 keyframes chacune, toast affiché.
2. Étape 8 : pousser via le stub un snapshot `dmx_output_status` avec `usbDmx.state='error'` (socket simulé ou refetch) → assert : badge DMX rouge + popover liste l'erreur.
3. AC : `npm run test:show` vert localement (hors sandbox) et en CI.

### D5 — Migration `fetch()` → `apiFetch()`
**Fichiers** : tout `apps/web/src` (grep `fetch(\`${API_BASE}`), `lib/config.ts`.
1. Remplacer mécaniquement chaque `fetch(\`${API_BASE}/api/...\`)` par `apiFetch(...)` importé de `lib/config` (~30 occurrences : PatchPanel, FixturesPage, SettingsModal, OrchestratorController, smart/*).
2. Conserver `installAuthFetch()` comme filet (ne pas le retirer).
3. AC : `grep "fetch(\`\${API_BASE}" apps/web/src` ne retourne plus que `lib/config.ts` ; build + tests verts.

### D1 — Achever C8c (mort de PatchPanel)
**Spec existante** : `C8-convergence.md §C8c` (S6-S7). Résumé exécutoire :
1. Extraire de `PatchPanel.tsx` vers `smart/patch/` : table de patch (universe/adresse/profil), import de profils, templates de venues, gestion licence — en sous-composants consommés par `StagePlan capabilities='build'`.
2. Supprimer le plan 2D interne de PatchPanel puis le fichier ; `proView 'patch'` rend `<StagePlan capabilities='build' />`.
3. Supprimer lecture/écriture de `data.x3d/y3d/z3d` (grep vide).
4. AC : ceux de C8-AC-c + le scénario de référence étapes 2-3 passent.

---

## VAGUE 2 — Chantiers features

| # | Fichier | Titre | Priorité | Dépend de |
|---|---------|-------|----------|-----------|
| C14 | `C14-live-performance.md` | Mode Live Performance plein écran | 🔴 P0 vague 2 | Porte 1 |
| C15 | `C15-import-ofl.md` | Import de profils Open Fixture Library | 🔴 P0 vague 2 | Porte 1 |
| C16 | `C16-crossfade-scenes.md` | Crossfade entre scènes (fade par pad) | 🟡 P1 vague 2 | Porte 1 |
| C17 | *(à spécifier sur décision PO)* | Autopilot audio-réactif (spectro → pads tagués) | 🟡 | C14, C16 |
| C18 | *(à spécifier sur décision PO)* | ArtPoll/ArtPollReply (présence des nodes dans le badge C9) | 🟡 | — |

Justification d'ordre : C14 sert le show immédiatement (idée d'origine du PO jamais traitée) ; C15 est le plus gros levier TTFL ; C16 est quasi gratuit (moteur existant) et complète C14 ; C17/C18 attendent l'adoption réelle des précédents.

## Rappels transverses pour tout agent de la vague 2

- Lexique `01-CONVENTIONS.md §6bis` (labels FR grand public en Perform).
- Tout nouvel état : décider persisté/transitoire et mettre à jour `partialize` + `projectMigration.ts` si persisté.
- Toute action destructive nouvelle passe par `store/history.ts` (undo C8e).
- Aucune nouvelle dépendance npm sans mention dans le chantier.
- DoD : AC + build + `test:unit` + `test:api` + scénario de référence sans régression.

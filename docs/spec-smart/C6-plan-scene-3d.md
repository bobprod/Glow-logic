# C6 — Plan de scène éditable, sync plan↔groupes↔3D, mode Preview

**Dépend de :** C3, C5 | **Bloque :** C7 | **Priorité :** 🟡 P1
**Fichiers à charger en contexte :**
- `apps/web/src/components/SmartDashboard.tsx` (uniquement `renderStagePlan` lignes ~1120-1380)
- `apps/web/src/components/smart/GroupInspectorPanel.tsx` (C3)
- `apps/web/src/store/slices/smartModeSlice.ts`
- `apps/web/src/store/slices/showPlayerSlice.ts` (dmxGroups, C5)
- `apps/web/src/components/VisualizerView.tsx`
- `apps/web/src/lib/dmxEngine.ts` (LECTURE SEULE — `setOutputGate`/`getOutputGate` lignes ~256-261)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Le Plan de Scène est aujourd'hui un visuel figé (positions codées en dur : lyres en haut, douches au centre, face en bas). Le PO veut : un plan **éditable** (déplacer/ajouter/retirer des fixtures) sans risque en live, une synchronisation visible plan↔faders de groupes↔3D, et un mode **Preview** où la timeline joue dans le visualiseur 3D **sans émettre de DMX physique** — pour valider un show avant de le passer en live.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/StagePlan.tsx` (extraction + édition) |
| Modifier | `apps/web/src/components/SmartDashboard.tsx` (remplacer `renderStagePlan` par `<StagePlan />`) |
| Modifier | `apps/web/src/store/slices/smartModeSlice.ts` (`setFixtureGridPosition`, `stagePlanHidden`, `stagePlanEditMode`, `previewMode`) |
| Modifier | `apps/web/src/store/slices/projectSlice.ts` (sérialiser `stagePlanHidden`) |
| Créer | `apps/web/src/lib/stagePlanMapping.ts` (`stagePlanToWorld`) |
| Modifier | `apps/web/src/components/three/FixtureRenderer.tsx` (positions depuis `gridPosition`, suppression du fallback codé en dur) |
| Modifier | `apps/web/src/components/VisualizerView.tsx` (toggle PREVIEW/LIVE) |

## 3. État existant (réfs vérifiées)

- `renderStagePlan` (SmartDashboard.tsx 1120-1380) : layout en dur (rangée LYRE en haut, DCH 1-3 au centre, LAT gauche/droite, FACE en bas), cercles cliquables, halo = couleur/intensité du groupe ; clic → sélection (redirigée vers la sidebar par C3).
- `smartModeSlice.ts` : `fixtures: PatchedFixture[]` (fetch `/api/fixtures`), chaque fixture a `gridPosition: { x, y, z }` (utilisé par la 3D).
- `dmxEngine.ts` : `setOutputGate(outputs)` ligne 256, `getOutputGate()` ligne 260, gate `{ qlcOsc, qlcWs, artNet, usbDmx }` ligne 41 — si tous false, rien ne sort (vérifié ligne 265).
- `VisualizerView.tsx` : visualiseur 3D Three.js, lit les fixtures et les valeurs DMX pour le rendu des faisceaux.

## 4. Spécification comportementale

### Édition du plan

> **Amendement audit global (`02-AUDIT-GLOBAL.md §5-A2`)** : la position des fixtures existe déjà en 3 encodages (ReactFlow `position`, `data.x3d/y3d/z3d`, `gridPosition` de la table `fixtures`). `stagePlanLayout` ne doit PAS devenir un 4e — il est défini comme une **vue dérivée de `gridPosition`** : le plan lit/écrit `gridPosition.x/y` (normalisés 0-100), persistés côté backend via `POST /api/fixtures` (champ existant). La 3D lit `gridPosition` aussi (S6), ce qui supprime la transformation codée en dur `(x-400)*0.025` de `FixtureRenderer.tsx:37`.

- **S1** — QUAND `StagePlan` est rendu ALORS les positions des fixtures viennent de `gridPosition.x/y` (normalisées 0-100 = % du conteneur) des fixtures du store (`smartModeSlice.fixtures`). Migration : au premier rendu, toute fixture dont `gridPosition` est absent/nul reçoit une position générée depuis le layout par défaut actuel (rangées LYRE/DCH/LAT/FACE) et celle-ci est persistée via `POST /api/fixtures`.
- **S2** — QUAND l'utilisateur clique le toggle `[Live | Édition]` dans le header du plan ALORS `stagePlanEditMode` bascule. En mode **Live** (défaut) : drag désactivé, clic = sélection/inspecteur (comportement C3). En mode **Édition** : fond quadrillé + bordure ambre `#f59e0b` autour du plan, drag des fixtures activé (snap sur grille 2%), clic = sélection sans déclencher d'inspecteur de contrôle.
- **S3** — QUAND une fixture est déplacée en mode Édition ALORS `gridPosition.x/y` est mis à jour au drop (pas à chaque pixel), persisté via `POST /api/fixtures` (debounce 500ms), et la position 3D correspondante est recalculée (S6).
- **S4** — QUAND l'utilisateur clique `+ Fixture` (header, mode Édition seulement) ALORS une liste des fixtures patchées absentes du plan s'ouvre ; en choisir une l'ajoute au centre du plan. Clic droit sur une fixture en mode Édition → `Retirer du plan` (la fixture reste patchée, elle n'est plus affichée).

### Synchronisation

- **S5** — QUAND un fader de groupe change (C5) ALORS les halos des fixtures de ce groupe sur le plan reflètent le niveau (opacité du halo = niveau %) et la couleur du groupe — déjà partiellement le cas, garantir le re-render via les selectors `dmxGroups`/`groupLevels`. Inversement, sélectionner un groupe via le plan met en évidence son strip dans GroupStrips (bordure cyan 2px pendant la sélection).
- **S6** — QUAND `gridPosition` change ALORS les positions 3D sont synchronisées : `x3d = (gridPosition.x - 50) * largeurScène / 100`, `z3d = (gridPosition.y - 50) * profondeurScène / 100`, hauteur = `gridPosition.z` (conservée). Le mapping vit dans une fonction pure exportée `stagePlanToWorld(gridPosition, stageSize)` utilisée par `FixtureRenderer` (`components/three/FixtureRenderer.tsx`), qui REMPLACE le fallback codé en dur `(position.x - 400) * 0.025` ligne ~37. Les champs `data.x3d/y3d/z3d` des nœuds ReactFlow ne sont plus lus par le rendu 3D (les laisser en place, leur suppression complète = chantier C8).

### Mode Preview

- **S7** — QUAND l'utilisateur clique le toggle `[● LIVE | ◌ PREVIEW]` (header du visualiseur 3D ET header du plan — même état) ALORS `previewMode` bascule. Passage en PREVIEW : sauvegarder `getOutputGate()` dans un champ mémoire du slice, puis `setOutputGate({ qlcOsc: false, qlcWs: false, artNet: false, usbDmx: false })`. Retour LIVE : restaurer le gate sauvegardé. Le moteur 44 Hz continue de tourner : le rendu 3D et les halos du plan restent alimentés par les valeurs internes du dmxEngine.
- **S8** — QUAND `previewMode === true` ALORS un bandeau non-intrusif `◌ PREVIEW — aucune sortie DMX physique` (fond purple translucide) est affiché en haut du visualiseur 3D et du plan ; le badge `DMX` de la TopBar passe en style éteint avec tooltip `Preview : sorties coupées`.
- **S9** — QUAND `previewMode === true` et que l'utilisateur déclenche un BLACKOUT ou arme laser/pyro ALORS ces actions restent fonctionnelles dans l'état interne mais n'émettent rien physiquement (conséquence du gate — aucune logique spéciale à coder, le vérifier en AC).
- **S10** — QUAND l'application démarre ALORS `previewMode` est TOUJOURS `false` (ne jamais persister ce flag — un retour en session ne doit pas surprendre l'opérateur avec des sorties coupées).

## 5. Modèle de données

```ts
// smartModeSlice.ts — ajouts
// PAS de nouveau tableau de positions : la source canonique est fixtures[].gridPosition (cf. amendement §4)
setFixtureGridPosition: (fixtureId: string, pos: { x: number; y: number; z?: number }) => void;
  // met à jour le store + POST /api/fixtures (debounce 500ms)
stagePlanHidden: string[];         // fixtureIds retirés du plan (affichage seulement) — persisté + projet
addFixtureToPlan: (fixtureId: string) => void;      // retire de stagePlanHidden
removeFixtureFromPlan: (fixtureId: string) => void; // ajoute à stagePlanHidden
stagePlanEditMode: boolean;        // défaut false — NON persisté
setStagePlanEditMode: (on: boolean) => void;
previewMode: boolean;              // défaut false — JAMAIS persisté
setPreviewMode: (on: boolean) => void;  // gère la sauvegarde/restauration du gate (S7)
```

```ts
// fonction pure (lib/stagePlanMapping.ts)
export function stagePlanToWorld(
  gridPosition: { x: number; y: number; z?: number },
  stageSize: { width: number; depth: number }
): { x: number; y: number; z: number };
```

## 6. Wireframe textuel

```
PLAN DE SCÈNE INTERACTIF
┌──────────────────────────────────────────────────────────────┐
│ PLAN DE SCÈNE   [Live|Édition]   [● LIVE|◌ PREVIEW]  [+ Fixture]│
├──────────────────────────────────────────────────────────────┤
│   (mode Édition : fond quadrillé, bordure ambre)             │
│        LYRE                                                  │
│   (LY1) (LY2) (LY3) (LY4)   ← drag avec snap 2%              │
│ (LAT1)  DCH1  DCH2  DCH3  (LAT2)                             │
│         (D1)(D1) (D2)(D2) (D3)(D3)                           │
│        FACE                                                  │
│   (FC1) (FC2) (FC3) (FC4)                                    │
└──────────────────────────────────────────────────────────────┘
3D LIVE VISUALIZER
┌──────────────────────────────────────────────┐
│ 3D LIVE VISUALIZER   [3D|2D]  [● LIVE|◌ PREVIEW]│
│ ░░ ◌ PREVIEW — aucune sortie DMX physique ░░ │ ← bandeau si preview
│            (faisceaux animés)                │
└──────────────────────────────────────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1) : au premier lancement post-C6, le plan est identique visuellement à l'actuel ; les positions vivent dans `fixtures[].gridPosition` et sont persistées côté backend (rechargement navigateur = mêmes positions).
- **AC2** (S2, S3) : en mode Édition, drag d'une fixture avec snap ; en mode Live, aucun drag possible.
- **AC3** (S4) : ajout d'une fixture patchée au plan, retrait par clic droit.
- **AC4** (S5) : bouger un fader de groupe change les halos ; sélectionner un groupe sur le plan surligne son strip.
- **AC5** (S6) : déplacer une fixture sur le plan déplace son spot dans le visualiseur 3D.
- **AC6** (S7-S10) : en PREVIEW, la timeline joue, le 3D s'anime, et AUCUN paquet ne sort (vérifiable : `dmxEngine.getOutputGate()` tout false + aucune trame côté backend) ; retour LIVE restaure le gate exact ; `previewMode` false au reload.
- **AC7** : `npm run build` passe.

## 8. Hors scope

- Ne pas modifier `lib/dmxEngine.ts` (le gate existe).
- Pas de redimensionnement de la scène ni d'étages/trusses multiples.
- Pas d'édition de position depuis la vue top-down 3D (sens unique plan → 3D dans ce chantier).
- Pas de zones MIDI-mappables sur le plan (itération ultérieure).
- Ne pas toucher : SceneController, GroupStrips hors surlignage S5, MacroTimeline, `SafetySimulationLayer.tsx`.

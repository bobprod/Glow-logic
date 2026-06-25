# 02 — Audit global du logiciel (hors vue SMART)

> Cartographie complète de Glow Logic (frontend + backend) réalisée le 2026-06-11 pour ancrer la refonte SMART dans la réalité de TOUT le logiciel. Ce document liste les problèmes structurels transversaux et les **amendements appliqués aux chantiers C1-C7** en conséquence.

## 1. Cartographie générale

### Frontend (apps/web, ~15 000 lignes)

| Surface | Fichiers clés | Taille |
|---------|--------------|--------|
| Routes | `/` (hub 2 modes), `/smart`, `/timeline` (générateur IA), `/fixtures`, `/visualizer`, `/setup` | 6 pages |
| Mode SMART | `SmartDashboard.tsx` | 3 426 lignes |
| Mode CREATOR | `page.tsx` (549) : canvas ReactFlow (8 types de nœuds, ~975 lignes), `PatchPanel.tsx` (2 722), `VisualizerView` + `three/*` (1 821), `FixtureController.tsx` (785) bottom panel, panneau droit AI/Scenes/Cues | ~6 850 lignes |
| Timeline partagée | `MacroTimeline.tsx` | 1 230 lignes |
| Modals/UI | `SettingsModal` (2 396, 8 onglets), `DmxSetupWizard` (792, 4 étapes), `LibraryModal` (506), `GuidedTour` (292, 12 étapes), `HelpCenter`, `SupportCenter` | ~4 400 lignes |
| Store | 8 slices Zustand, ~40 clés persistées localStorage (`glow-logic-storage`) | |

### Backend (apps/server, Express port 3005)

- **76 routes API** : settings, diagnose, safety (rôles + armement laser/pyro), projects (CRUD + export/import `.glowproject` + health/repair), fixtures (CRUD + scan OCR/LLM + import `.qxf`), **fixture-groups (CRUD)**, venue-profiles, library, scenes, cues, dmx (ports/usb/router/live/flush), qlc (engine/ws/workspace), network, sync (BPM multi-sources), resolume, llm.
- **SQLite 8 tables** : `app_settings`, `projects` (data JSON), `fixtures`, `scenes`, `cue_lists`, `fixture_groups`, `venue_profiles`, `library_items`.
- **Chaîne DMX** : frontend `dmxEngine` 44 Hz → socket `dmx_update` → `dmxRouter` → dispatch simultané vers 5 sorties (Python bridge COM série, QLC+ OSC :7700, QLC+ WS legacy, Art-Net UDP :6454, USB serial direct) → broadcast `dmx_sync` retour.
- **Python** : `dmx_bridge.py` (Kernel32 SetCommBreak, COM5 par défaut, auto-restart, chemin Python codé en dur).

## 2. Problème structurel n°1 : la « fixture » est fragmentée en 4 sources de vérité

| Source | Où | Contenu |
|--------|-----|---------|
| 1. Nœuds ReactFlow | `reactFlowSlice.nodes` | `position.x/y` (canvas) + `data.x3d/y3d/z3d` + channels dupliqués |
| 2. PatchPanel | `PatchPanel.tsx` (PatchedFixture) | `nodeId`, universe, startAddress, couleur, position plan 2D |
| 3. smartModeSlice | `fixtures[]` (fetch `/api/fixtures`) | `gridPosition {x,y,z}`, channels re-normalisés à chaque accès |
| 4. Backend SQLite | table `fixtures` | source persistée, `start_address`, `modes` |

**Conséquences mesurées :**
- La **position** vit en 3 encodages (ReactFlow `position`, `x3d/y3d/z3d`, `gridPosition`) avec une transformation 2D→3D codée en dur (`x3d = (x-400)*0.025` dans `FixtureRenderer.tsx:37`) qui casse si le canvas change de taille. Pas de sync bidirectionnelle (bouger en 3D ne met pas à jour le plan).
- **Deux plans de feu** : `PatchPanel` (Creator, drag libre, groupes, templates de venues) et `stagePlan` SMART (layout codé en dur) — modèles de données non réconciliés.
- **Deux paradigmes de sélection** : Creator = `selectedNode` + `selectedFixtureId` + raycaster 3D ; Smart = sélection de groupe/zone.
- Groupes en double : table backend `fixture_groups` (id, role, color, fixture_ids) **ET** `groupLevels/Mutes/Colors` frontend (clés = noms FR en dur) — aucun lien entre les deux.

## 3. Autres faiblesses transversales (par sévérité)

### Critiques
1. **Aucune authentification API** : CORS `*`, pas de token — n'importe qui sur le réseau peut armer le laser, exporter les projets, consommer les clés LLM. (Hors scope spec-smart, à traiter avant production.)
2. **Échecs DMX silencieux** : `dmxRouter.setChannel()` avale toutes les exceptions des 5 sorties ; l'UI ne sait jamais si une trame est réellement sortie. Le badge « DMX » de la TopBar est donc partiellement aveugle.
3. **Safety gate consultatif** : `validateSafetyAction()` retourne `allowed: false` mais ne **bloque** pas — chaque appelant doit vérifier.

### Élevées
4. **Doublon clés LLM** : localStorage (`glowlogic_llm`) ET SQLite `app_settings`, chemins de mise à jour différents → divergence (déjà constatée lors du scan fixtures, contourné en envoyant les clés en FormData).
5. **`blackout` vs `smartBlackout`** : deux flags pour le même concept, resynchronisés à l'hydratation.
6. **Undo/redo uniquement sur le canvas ReactFlow** : rien sur timeline, pads, patch, groupes.
7. **ESLint v9 cassé** (« Premature close ») : pas de lint en CI ; Playwright (`tests/visual.spec.ts`, 4 tests) non exécuté en CI.

### Moyennes
8. Offline incomplet : badge OK, état localStorage OK, mais pas de file d'attente DMX ni de sauvegarde projet hors-ligne.
9. `normalizeFixtureRecord()` non mémoïsé (re-normalisation à chaque accès).
10. Migrations SQLite par `ALTER TABLE` try-catch silencieux, sans version de schéma.

## 4. Forces à préserver (ne pas casser)

- Moteur DMX 44 Hz avec locks de priorité — solide, réutilisé partout.
- Timeline partagée Smart/Creator (un seul `timelineSlice`) — bonne décision, le REC (C4) s'y branche naturellement.
- Backend riche : export/import `.glowproject` avec checksums, scan fixture OCR+LLM multi-providers, sync BPM multi-sources (Ableton Link, OS2L, VirtualDJ, Serato, rekordbox), diagnostic IA.
- Onboarding complet (tour 12 étapes, wizard DMX 4 étapes, help center) et PWA fonctionnelle.
- TypeScript strict, 0 erreur.

## 5. Amendements appliqués aux chantiers C1-C7

L'audit a révélé deux corrections **obligatoires** (sinon les chantiers aggraveraient la fragmentation) :

### A1 — C5 : ne PAS créer un modèle de groupes client-only
La table backend `fixture_groups` + l'API `/api/fixture-groups` (CRUD complet) existent déjà. Le `DmxGroup` de C5 doit être **adossé à cette API** : `id` = id DB, CRUD synchronisé (optimistic update + POST/DELETE), `role` DB ↔ `backendZone`. Sinon on aurait eu un 3e modèle de groupes. → **Amendement intégré dans C5 §4-S10 et §5.**

### A2 — C6 : `stagePlanLayout` ne doit pas devenir une 4e source de position
Au lieu d'un nouveau tableau de positions, C6 doit faire de `gridPosition` (déjà dans la table `fixtures` et `smartModeSlice.fixtures`) **la source canonique 2D/3D** : le plan SMART lit/écrit `gridPosition.x/y` (persistées via `POST /api/fixtures`), la 3D lit `gridPosition` (suppression progressive de `x3d/y3d/z3d` et de la transformation codée en dur). → **Amendement intégré dans C6 §4-S1/S3/S6 et §5.**

### Recommandations hors périmètre spec-smart (chantiers futurs C8+, à prioriser après C1-C7)
| Id | Sujet | Effort |
|----|-------|--------|
| C8 | Convergence Smart/Creator + undo global — **spécifié** (`C8-convergence.md`, 5 lots C8a-e : coque commune, sidebar 3 rôles, fusion plans de feu, sélection unique, historique central) | Élevé |
| C9 | Fiabilité sorties DMX — **spécifié et intégré au plan** (voir `C9-fiabilite-dmx.md`, inséré après C4 dans l'ordre d'exécution) | Moyen |
| C10 | Sécurité — **spécifié** (`C10-securite.md` : token de pairing local, CORS restreint, auth Socket.IO, safety gate bloquant centralisé, expiration d'armement 30 min) | Moyen |
| C11 | Qualité : réparer ESLint (downgrade v8), Playwright en CI, consolider `blackout`/`smartBlackout`, undo/redo timeline | Moyen |
| C12 | Offline : file d'attente DMX + snapshot projet hors-ligne | Moyen |

## 6. Leçon UX transversale (pour guider toutes les itérations)

Le logiciel a **deux applications dans une** (Smart = console live, Creator = atelier de construction) qui ont divergé : 2 plans de feu, 2 inspecteurs, 2 sélections, 2 modèles de groupes. La refonte SMART (C1-C7) va dans le bon sens en réutilisant les briques (FixtureInspectorPanel partagé, timeline commune, groupes adossés au backend). La règle pour la suite : **toute nouvelle fonctionnalité doit désigner sa source de vérité unique** (store slice OU table SQLite, jamais les deux sans sync explicite) et **réutiliser le composant existant** plutôt que créer un jumeau par mode.

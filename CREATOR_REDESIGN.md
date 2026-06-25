# 
---

# REFONTE MODE CREATOR & NAVIGATION — GLOW LOGIC

## 1. DIAGNOSTIC : pourquoi Creator est mal compris

Trois causes structurelles, toutes étayées par l'audit.

**a) Noms d'ingénieur, pas de métier.** `proView`, `appMode`, `reactFlowSlice`, `canvas` : ce sont des noms de implémentation, pas de tâche. L'audit le pointe explicitement (« renommer proView → creatorViewport », « ReactFlow est une lib JS »). Un éclairagiste ne sait pas ce qu'est un « proView ». Il sait ce qu'est *patcher*, *programmer*, *jouer*.

**b) Mélange de métiers dans un seul mode.** Creator empile trois activités hétérogènes derrière un cycle `Tab` opaque :
- CANVAS = routage signal/FX (métier VJ avancé)
- PATCH = placement spatial fixtures (StagePlan)
- 3D = prévisualisation rendu

Ces trois vues ne sont pas des « onglets » du même travail : ce sont *un outil avancé*, *une étape de setup*, et *un moniteur*. Les empiler au même niveau de navigation force l'utilisateur à comprendre l'architecture interne pour s'en servir.

**c) Le défaut nodal : puissant mais orphelin.** Le canvas est load-bearing (cf. §2) mais : zéro doc, lien `nodes → dmxEngine` implicite (`reactFlowSlice.ts:137-147`), courbe d'apprentissage ReactFlow brute, handles abstraits. Résultat : la fonctionnalité la plus complexe est aussi la plus exposée (mise au même rang que PATCH dans le cycle `Tab`). Inversion de la charge cognitive.

**d) Panneaux fantômes.** Le panneau droit Scenes/Cues en Creator est un placeholder (`AppShell.tsx:603-606` : « Le refactoring centralise les scenes dans la MacroTimeline »). Cliquer dessus ne fait rien d'utile. La SmartSidebar (onglets pensés SMART : widgets/inspector/library/AI) s'affiche aussi en Creator où elle est inadaptée. L'utilisateur voit des contrôles qui ne correspondent pas à son métier courant.

**Preuve de l'impact workflow :** un look live coûte 10-14 clics (Smart), un clip 17-20 (Creator), mais passer de l'un à l'autre = 25-35 clics + saisie DMX manuelle (aucun export pad↔clip). La fragmentation n'est pas cosmétique, elle est mesurable.

---

## 2. VERDICT SUR LE CANVAS NODAL : **AMÉLIORER + RELÉGUER** (ne pas supprimer)

**Est-il load-bearing ? OUI, sans ambiguïté.**
- `reactFlowSlice.updateNodeData()` interroge directement `dmxEngine.setChannel()` (`reactFlowSlice.ts:137-147`) — c'est du routage DMX live, pas cosmétique.
- LFO 44 FPS, AudioIn 30 FPS FFT : output mesuré et réel.
- Persisté en localStorage ET dans chaque projet (`projectSlice.ts:58-59`).
- `VisualizerView` consomme `nodes` pour le rendu 3D — supprimer le canvas casserait aussi la 3D.

**Donc : SUPPRIMER est exclu.** On casserait le routage signal-réactif (audio→couleur, LFO→fixture), seul endroit de l'app qui le fait.

**Mais GARDER tel quel est faux aussi** : c'est un outil avancé exposé comme une étape de base. Décision tranchée :

| Action | Détail |
|--------|--------|
| **RELÉGUER** | Sortir le canvas du cycle de navigation principal `Tab`. Il devient un outil **« Signal / FX »** accessible à la demande, pas une vue de premier rang. |
| **RENOMMER** | « Canvas » → **« Signal Graph »** (ou « FX Routing ») en UI ; `reactFlowSlice` → `signalGraphSlice` en code. Le nom dit le métier. |
| **DOCUMENTER + DURCIR** | Extraire `routeSignal(nodeId, value)` comme fonction publique testable hors de `updateNodeData`. JSDoc sur le flux `node → dmxEngine`. Type guards sur les cascades `if/forEach`. |

C'est un outil de niche à fort levier (VJ audio-réactif). Sa place : derrière un bouton « Avancé », pas dans le flux que tout débutant traverse.

---

## 3. MODÈLE CIBLE : navigation par tâche

Remplacer les deux axes orthogonaux confus (`appMode` × `proView`) par **un seul axe de tâche** à 3 entrées, alignées sur le workflow réel *patch → program → play*.

```
┌─────────────────────────────────────────────────────────┐
│  TopBar : [ DESIGN ]  [ PERFORM ]        [ ◉ LIVE ]      │
└─────────────────────────────────────────────────────────┘
```

### DESIGN — « je prépare le show » (= ex-Creator, réorganisé)
Une seule tâche cohérente : *poser mes lumières et programmer mes looks*. Sous-vues présentées comme **étapes**, pas comme onglets opaques :

| Sous-vue cible | Provenance | Sort |
|----------------|-----------|------|
| **Patch & Plan** (vue par défaut) | `StagePlan` (build) + `FixtureController` bas | **GARDER**, devient l'entrée par défaut de DESIGN |
| **Programmation** | `MacroTimeline` + `SceneClipPanel` | **GARDER**, promu au premier plan (plus de placeholder droit) |
| **Aperçu 3D** | `VisualizerView` | **GARDER** comme moniteur, accessible en split/toggle (pas un mode plein écran isolé) |
| **Signal Graph** (Avancé) | `FlowCanvas` / ex-canvas | **RELÉGUER** derrière bouton « Avancé / FX » |

→ `proView` est remplacé par `designStep` avec 2 valeurs visibles (`plan` \| `program`) + 1 outil à la demande (`signal`) + un toggle moniteur 3D. Le cycle `Tab` reste mais ne traverse plus que `plan ↔ program`.

### PERFORM — « je joue le show » (= ex-Smart Dashboard)
Le `SmartDashboard` et ses 8 widgets, **inchangés sur le fond** (ils marchent : 10-14 clics/look). Renommage `SMART` → `PERFORM` pour dire le métier.

| Sous-vue Smart actuelle | Sort |
|-------------------------|------|
| scenePads (SceneController), groupStrips, zoneControls, vjDeck | **GARDER** |
| stagePlan (widget) | **GARDER** (lecture seule ici ; l'édition est en DESIGN) |
| miniPlaylist, spectro, outputHealth | **GARDER** (collapsibles) |
| SmartSidebar (5 onglets) | **GARDER en PERFORM**, **RETIRER de DESIGN** (inadaptée, cf. §1d) |

### LIVE — overlay global (voir §4)
`LivePerformanceView` **GARDÉ**, mais promu d'« exclusif Smart » à **global** (accessible depuis DESIGN comme PERFORM).

**Sort des concepts redondants** (audit §5-6 navigation) :
- `appMode` (smart/creator) → renommé `workspace` (design/perform), même mécanique.
- `proView` → `designStep` (clarté).
- Trois flags performance (`livePerformanceMode`, `variant="performance"`, `performanceMode`, `readonly`) → **un seul** `isLive` composite dérivé. C'est la confusion n°3 de l'audit, à éliminer.
- Panneau droit Scenes/Cues placeholder → **supprimé** ; la programmation vit dans la timeline (déjà le cas de facto).

---

## 4. LIVE : accessible partout, proprement

**Constat :** aujourd'hui le bouton LIVE n'apparaît qu'en SMART (`TopBar.tsx:435-443`), alors que le besoin « passer en mode scène, lecture seule, gros boutons » existe aussi quand on vient de DESIGN. Et trois flags concurrents décrivent « je suis en live ».

**Décision : LIVE reste un OVERLAY plein écran global, pas un 3ᵉ workspace ni un panneau.**

Justification tranchée :
- **Overlay, pas panneau** : le live exige le plein écran, le verrouillage des éditions (anti fausse-manip scène), de gros contrôles. Un panneau cohabitant avec des outils d'édition irait à l'encontre de ces trois exigences. L'audit confirme le besoin lecture seule (`readonly`, hold-Escape 800 ms anti-sortie accidentelle).
- **Global, pas Smart-only** : bouton LIVE + `F10` visibles dans DESIGN et PERFORM. Entrer en LIVE depuis DESIGN bascule simplement l'affichage overlay sans changer le workspace sous-jacent (on y revient en sortant).

**Corrections de propreté (gardes manquantes, audit §7) :**
1. Au montage de `LivePerformanceView`, mémoriser `smartEditMode` puis le forcer `false` ; **le restaurer au démontage** (bug actuel : il reste `false` après sortie → session bloquée en lecture seule).
2. Dériver un unique `isLive` ; `SceneController`/`GroupStrips` lisent ce flag au lieu de 3 props parallèles.
3. Garde scène : si `smartActiveScene` pointe une scène supprimée → reset `null` (évite pad fantôme).

---

## 5. PLAN DE MISE EN ŒUVRE PAR PHASES

### PHASE 1 — Quick wins sûrs (100 % additif, zéro changement de modèle de données)
**Objectif :** clarté de nommage + LIVE global. Risque **faible**.

| Action | Fichiers | Risque |
|--------|----------|--------|
| LIVE global : afficher bouton LIVE + `F10` aussi en Creator/DESIGN | `TopBar.tsx:435-443`, `AppShell.tsx:270-279` | Faible (additif) |
| Fix garde `smartEditMode` restauré à la sortie LIVE | `LivePerformanceView.tsx:50`, `uiSlice.ts:143-151` | Faible (corrige un bug) |
| Renommage **UI uniquement** : `SMART→PERFORM`, `CREATOR→DESIGN`, `CANVAS→Signal Graph` (labels, pas les clés d'état) | `TopBar.tsx:410-431`, libellés `AppShell.tsx` | Faible (cosmétique) |
| Retirer SmartSidebar du rendu DESIGN (ou la vider d'onglets SMART) | `AppShell.tsx:508` | Faible-moyen |
| Supprimer le placeholder Scenes/Cues du panneau droit Creator | `AppShell.tsx:560-619` | Faible (retrait de mort) |

→ Livrable : l'app *paraît* refondue et LIVE marche partout, **sans toucher au cœur**.

### PHASE 2 — Restructuration DESIGN (modéré, additif sur l'état)
**Objectif :** transformer le cycle `proView` opaque en parcours `plan → program` + Signal Graph relégué. Risque **moyen**.

| Action | Fichiers | Risque |
|--------|----------|--------|
| Renommer état `proView → designStep`, valeurs `plan`/`program`, garder alias rétro-compat à la rehydratation | `uiSlice.ts:21-50`, `AppShell.tsx:512-525`, `projectMigration.ts` | Moyen (migration localStorage) |
| Sortir le canvas du cycle `Tab` ; l'exposer via bouton « Avancé / FX » | `AppShell.tsx:413-425, 522-524` | Moyen |
| 3D en moniteur toggle/split au lieu de mode exclusif | `AppShell.tsx:513-520`, `VisualizerView.tsx` | Moyen |
| Unifier les flags performance en un `isLive` dérivé | `SceneController.tsx:124`, `GroupStrips`, `uiSlice.ts` | Moyen (toucher composants partagés) |
| Renommer `reactFlowSlice → signalGraphSlice`, extraire `routeSignal()`, JSDoc + type guards | `reactFlowSlice.ts` (entier) | Moyen (refactor isolé, testable) |

→ Garde-fou : migration avec alias d'anciennes clés pour ne pas casser les projets/localStorage existants.

### PHASE 3 — Unification du modèle de scène (structurant, à valider d'abord)
**Objectif :** résoudre la triple duplication SmartPad / TimelineClip / (Canvas). Risque **élevé** — à n'engager que si le besoin design↔live réutilisable est confirmé.

| Action | Fichiers | Risque |
|--------|----------|--------|
| Bridge **pad ↔ clip** : export/import automatique d'un SmartPad en TimelineClip et inverse (résout les 25-35 clics + saisie manuelle) | `smartModeSlice.ts:760-887`, `timelineSlice.ts:5-23`, `SceneClipPanel.tsx` | Élevé |
| Appliquer `clip.dmxCommands` côté client (aujourd'hui ignoré, seul le serveur traite — `MacroTimeline.tsx:484-550`) pour feedback 3D temps réel | `MacroTimeline.tsx` | Élevé |
| Exécuter réellement le crossfade A3 `fadeSeconds` (stocké, jamais appliqué) via `DmxFader.ts` (présent, inutilisé) | `DmxFader.ts`, `smartModeSlice.ts`, `timelineSlice.ts` | Élevé |
| Centraliser `channelType()` (dupliqué 2×) en util partagé + cache | `smartModeSlice.ts:766-774, 571-580` | Moyen |

**Hors-scope mais à acter :** nettoyer les mocks affichés comme réels — MediaGenerator (stub `configured:false`), Autopilot (réticule random `SmartSyncHub.tsx:78-88`), AI Inspector (faux logs `setTimeout`). Ils ne sont pas de la navigation, mais ils minent la confiance dans Creator/Smart. À masquer derrière un flag « expérimental » ou retirer.

---

## 6. TOP 5 DÉCISIONS (par ratio impact / effort)

1. **LIVE global + fix de la garde `smartEditMode`** — *Impact énorme / effort minime.* Le besoin n°1 (jouer depuis n'importe où) résolu en déplaçant un bouton et corrigeant un bug de restauration d'état. Phase 1. *(TopBar.tsx:435-443, LivePerformanceView.tsx:50)*

2. **Renommer par métier : Creator→DESIGN, Smart→PERFORM, Canvas→Signal Graph** — *Impact fort / effort faible.* Supprime 80 % de l'incompréhension décrite au diagnostic sans toucher au code métier. Labels d'abord (Phase 1), clés d'état ensuite (Phase 2).

3. **Reléguer le Signal Graph hors du cycle `Tab`** — *Impact fort / effort moyen.* L'outil le plus complexe cesse d'être une étape obligatoire ; DESIGN devient un parcours linéaire `plan→program` lisible. On garde toute la puissance, on retire la charge cognitive. *(AppShell.tsx:413-425)*

4. **Unifier les flags performance en un seul `isLive`** — *Impact fort / effort moyen.* Élimine la confusion n°3 (4 props pour un concept), fiabilise tout passage en live et simplifie les composants partagés. *(SceneController, GroupStrips, uiSlice)*

5. **Bridge pad ↔ clip (Phase 3)** — *Impact maximal / effort élevé, mais le seul qui débloque le workflow design↔live.* Fait passer la collaboration des deux mondes de 25-35 clics manuels à un export en 1 clic. C'est la vraie valeur produit à terme ; à planifier dès que Phases 1-2 stabilisées. *(smartModeSlice.ts ↔ timelineSlice.ts)*

---

**Fil conducteur :** Phase 1 fait *paraître* le logiciel refondu (noms + LIVE) sans risque ; Phase 2 rend la navigation DESIGN réellement linéaire ; Phase 3 fusionne les modèles pour tuer la friction inter-modes. Chaque phase est livrable seule et additive — on peut s'arrêter après n'importe laquelle sans casser l'existant.
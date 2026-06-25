# C8 — Convergence Smart/Creator + Undo global

**Dépend de :** C1-C6 (toutes les briques partagées) | **Bloque :** C10 (recommandé avant) | **Priorité :** 🟡 P1
**Fichiers à charger en contexte :** par lot (voir §4 — chaque lot liste les siens). Ce chantier est découpé en **5 lots livrables séparément** (C8a → C8e), un lot = une session Codex = une PR.

## 1. Contexte

L'audit (`02-AUDIT-GLOBAL.md`) montre que Smart et Creator ont divergé en deux applications : 2 plans de feu, 2 inspecteurs (3 avec le 3D), 2 paradigmes de sélection, positions en 3 encodages, undo limité au canvas. C1-C6 construisent les briques partagées ; C8 les fait converger en « un atelier, deux postures » (Perform/Build), et ajoute le contrat de confiance d'un outil de création : **Ctrl+Z partout**.

## 2. Fichiers touchés (vue d'ensemble)

| Lot | Périmètre | Fichiers principaux |
|-----|-----------|---------------------|
| C8a | Coque commune | `app/page.tsx`, `app/smart/page.tsx`, nouveau `components/AppShell.tsx` |
| C8b | Sidebar 3 rôles (+ Bibliothèque) | `smart/SmartSidebar.tsx`, `Sidebar.tsx` (Creator), `LibraryModal.tsx` |
| C8c | Fusion plan de feu | `smart/StagePlan.tsx`, `PatchPanel.tsx` |
| C8d | Sélection unique | `uiSlice.ts`, `reactFlowSlice.ts`, `three/FixtureClickHandler` |
| C8e | Undo global | nouveau `store/history.ts`, slices concernés |

## 3. État existant

- `/` (page.tsx, 549 lignes) et `/smart` assemblent chacun leur écran ; la MacroTimeline est déjà commune.
- Sidebar Creator (`Sidebar.tsx`, 208 lignes) = palette de nœuds draggables + liste fixtures ; `LibraryModal.tsx` (506 lignes) = bibliothèque en modal.
- `PatchPanel.tsx` (2 722 lignes) : patch + plan 2D Creator avec templates de venues, groupes, licence. `smart/StagePlan.tsx` (C6) : plan SMART sur `gridPosition`.
- Sélection : `selectedNode` (reactFlowSlice) + `selectedFixtureId/Ids` (uiSlice) + `selectedStageGroup` (C3) + raycaster 3D.
- Undo/redo : uniquement `past/future` dans reactFlowSlice (50 entrées).

## 4. Spécification comportementale par lot

### C8a — Coque commune (AppShell)
*Contexte à charger : `app/page.tsx`, `app/smart/page.tsx`, `TopBar.tsx`, `uiSlice.ts`.*
- **S1** — QUAND l'app s'affiche ALORS une coque unique `AppShell` rend : TopBar (identique dans les deux modes) + SmartSidebar (les deux modes) + zone centrale selon `appMode` + MacroTimeline. `/` et `/smart` deviennent deux entrées vers la même coque (`/smart` = `?mode=smart`, redirection conservée pour les raccourcis PWA).
- **S2** — QUAND `appMode === 'creator'` ALORS la zone centrale affiche les onglets Canvas | Plan | 3D (proView) ; QUAND `'smart'` ALORS les widgets du SmartDashboard. Le basculement de mode conserve la sélection, le playhead et l'état de la sidebar.
- **S3** — QUAND le menu 🔧 Outils (C1) est ouvert ALORS il est identique dans les deux modes et regroupe : Santé (Diagnostic, Preflight, Recovery), Matériel (Assistant DMX, Sorties DMX, QLC+), Show (Export/Import `.glowproject`, snapshots), Aide (Tour, Help center, Support), ⚙ Réglages. Les boutons correspondants disparaissent de la TopBar (ils n'y restent que : transport/BPM/SYNC, BLACKOUT, badges d'état, sauvegarde rapide, projet).

### C8b — Sidebar 3 rôles
*Contexte à charger : `smart/SmartSidebar.tsx`, `Sidebar.tsx`, `LibraryModal.tsx`, `uiSlice.ts`.*
- **S4** — QUAND la sidebar est affichée ALORS elle a 3 rôles : `scenes` (SceneController C2), `inspector` (C3), `library` (nouveau). `smartSidebarPanel` devient `'scenes' | 'inspector' | 'library'`. Trois icônes verticales fines (32px) sur le bord gauche de la sidebar permettent de changer de rôle ; la sélection d'une fixture continue d'auto-switcher vers `inspector` (C3-S1).
- **S5** — QUAND le rôle `library` est actif ALORS il affiche en accordéons : Fixtures patchées (drag → canvas/plan), Nœuds (en mode Build uniquement : la palette actuelle de `Sidebar.tsx`), Looks & presets (contenu de l'actuelle LibraryModal via `/api/library`), Médias. `Sidebar.tsx` (Creator) est supprimé ; `LibraryModal` devient un simple raccourci qui ouvre ce rôle.

### C8c — Fusion des plans de feu
*Contexte à charger : `smart/StagePlan.tsx`, `PatchPanel.tsx`, `smartModeSlice.ts`.*
- **S6** — QUAND on est en mode Build, onglet Plan ALORS c'est le **même composant `StagePlan`** (C6) qui est rendu, avec les capacités de patch en plus (props `capabilities: 'perform' | 'build'`) : en `build`, panneau latéral de patch (universe, adresse, profil — repris de PatchPanel), templates de venues, gestion licence. `PatchPanel.tsx` est démantelé progressivement : sa logique de patch migre dans des sous-composants `smart/patch/*`, son plan 2D disparaît au profit de StagePlan. Positions : `gridPosition` uniquement (acquis C6).
- **S7** — QUAND C8c est terminé ALORS les champs `data.x3d/y3d/z3d` des nœuds ReactFlow sont supprimés (lecture ET écriture) — la 3D lit `gridPosition` exclusivement (la transformation codée en dur de `FixtureRenderer` a déjà été remplacée en C6-S6).

### C8d — Sélection unique
*Contexte à charger : `uiSlice.ts`, `reactFlowSlice.ts`, `three/FixtureClickHandler`, `smart/StagePlan.tsx`.*
- **S8** — QUAND l'utilisateur clique une fixture N'IMPORTE OÙ (plan, canvas via un nœud fixture, 3D, liste bibliothèque) ALORS la même paire `selectedFixtureId`/`selectedFixtureIds` est mise à jour et l'inspecteur sidebar s'ouvre (flux C3). `selectedNode` (canvas) reste pour les nœuds non-fixture (LFO, slider…) mais sélectionner un nœud fixture synchronise `selectedFixtureId`. La sélection est visuellement cohérente : ring cyan partout.

### C8e — Undo global (exigence transversale)
*Contexte à charger : `store/useStore.ts`, `timelineSlice.ts`, `smartModeSlice.ts`, `showPlayerSlice.ts`, `reactFlowSlice.ts`.*
- **S9** — QUAND une action **destructive ou structurelle** est exécutée ALORS elle passe par un historique central `store/history.ts` (command pattern : `{ label, undo(), redo() }`, pile 100 entrées, non persistée). Périmètre minimal obligatoire : suppression/déplacement/édition de pad, suppression/déplacement/redimensionnement de clip et keyframe, suppression/création/renommage de groupe, déplacement de fixture sur le plan, suppression de piste d'automation. Le canvas ReactFlow conserve son mécanisme actuel mais l'enregistre comme une entrée dans l'historique central (un undo global dépile l'un ou l'autre dans l'ordre chronologique).
- **S10** — QUAND l'utilisateur presse Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z) ALORS l'historique global est dépilé/rempilé, un toast discret affiche `Annulé : <label>` / `Rétabli : <label>`. Les mouvements de faders et valeurs DMX temps réel sont EXCLUS de l'historique (geste de performance, pas d'édition).
- **S11** — QUAND `showLock === true` ALORS l'undo des actions de structure reste disponible mais un garde empêche d'annuler au-delà du moment d'activation du lock (protection live).

## 5. Modèle de données

```ts
// uiSlice.ts
smartSidebarPanel: 'scenes' | 'inspector' | 'library';

// store/history.ts (non persisté)
interface HistoryEntry { id: string; label: string; at: number; undo: () => void; redo: () => void; }
pushHistory(entry: Omit<HistoryEntry, 'id' | 'at'>): void;
undo(): HistoryEntry | null;
redo(): HistoryEntry | null;
clearHistory(): void;            // appelé au chargement d'un projet

// smart/StagePlan.tsx
interface StagePlanProps { capabilities: 'perform' | 'build'; }
```

## 6. Critères d'acceptation (par lot)

- **AC-a** : un seul AppShell ; changer de mode conserve sélection + playhead ; menu Outils identique et complet dans les deux modes ; TopBar réduite aux éléments listés en S3.
- **AC-b** : sidebar 3 rôles dans les deux modes ; drag d'un nœud depuis la bibliothèque vers le canvas fonctionne ; `Sidebar.tsx` supprimé sans régression.
- **AC-c** : le plan de feu est le même composant dans les deux modes ; patcher une fixture en Build la fait apparaître en Perform au même endroit ; plus aucune lecture/écriture de `x3d/y3d/z3d` (grep vide).
- **AC-d** : cliquer une fixture dans le canvas, le plan, la 3D ou la bibliothèque ouvre le même inspecteur avec la même sélection.
- **AC-e** : supprimer un pad puis Ctrl+Z le restaure (avec son mapping MIDI) ; idem clip, keyframe, groupe, position de fixture ; les faders ne polluent pas l'historique ; charger un projet vide l'historique.
- **AC-global** : `npm run build` passe après chaque lot ; le scénario de référence (`03-DISCIPLINE.md §2`) passe après C8c et C8e.

## 7. Hors scope

- Pas de renommage SMART/CREATOR → PERFORM/BUILD dans ce chantier (cosmétique, décision PO séparée).
- Pas d'édition de position depuis la 3D (toujours sens unique plan → 3D).
- Pas d'undo des réglages (Settings, mappings de sortie DMX) ni des actions matérielles.
- Ne pas toucher : `dmxEngine.ts`, `outputHealth` (C9), backend sauf si un lot le précise.

# C2 — Contrôleur de scènes unifié (fusion Pads + APC Mini virtuel)

**Dépend de :** C1 | **Bloque :** — | **Priorité :** 🔴 P0
**Fichiers à charger en contexte :**
- `apps/web/src/components/SmartDashboard.tsx`
- `apps/web/src/components/smart/SmartSidebar.tsx` (créé en C1)
- `apps/web/src/store/slices/smartModeSlice.ts`
- `apps/web/src/store/slices/midiSlice.ts`
- `apps/web/src/store/slices/projectSlice.ts`
- `apps/web/src/components/MidiListener.tsx`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Deux widgets séparés déclenchent les mêmes scènes : « PAD DE SCÈNES » (beau mais limité) et « APC MINI VIRTUEL » (dense mais illisible, gris, sans noms). On les fusionne en un seul contrôleur dans la sidebar libérée par C1 : esthétique des pads colorés + densité de l'APC, 4 pages × 16 pads = 64 scènes, deux modes d'affichage.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/SceneController.tsx` |
| Modifier | `apps/web/src/components/smart/SmartSidebar.tsx` (remplir le slot `scenes`) |
| Modifier | `apps/web/src/components/SmartDashboard.tsx` (retirer `renderPadsGrid`, `renderApcVirtual`, widgets `pads`/`apcVirtual`) |
| Modifier | `apps/web/src/store/slices/smartModeSlice.ts` (pagination, view mode, actions) |
| Modifier | `apps/web/src/store/slices/projectSlice.ts` (migration) |
| Modifier | `apps/web/src/components/MidiListener.tsx` (clés `pad_<page>_<slot>`) |

## 3. État existant (réfs vérifiées)

- `SmartDashboard.tsx` : `renderPadsGrid` ligne 1382 (grille de pads, drag-reorder en edit mode, double-clic config, templates starter show, presets control surface) ; `renderApcVirtual` ligne 2011 (grille 8×8, notes 0-63) ; rendu des widgets lignes 3400-3407 (`widget.id === 'pads'`, `'apcVirtual'`). Modal de config pad ~2338-2500 (nom, couleur, icône, MIDI Learn, note, canal, suppression). Handlers : `handlePadClick`, `handleCreateScene` (~781), `handleSavePadConfig` (~807), `handleDeletePad` (~834), `startMidiLearnForPad` (~847), drag-drop (~906), `applyStarterShow` (~926), `applyControlSurfacePreset` (~967).
- `smartModeSlice.ts` : `SmartPad` ligne 7 (`id, name, color, textColor, iconName, qlcPage, qlcWidget, dmxValues?, dmxCommands?, midiNote, midiChannel, gridCol, gridRow, gridW, gridH`) ; `DEFAULT_PADS` ligne 38 (4 pads) ; actions `addSmartPad`/`updateSmartPad`/`deleteSmartPad`/`reorderSmartPads` lignes 178-193 ; `triggerSmartPad` ligne 141 ; `smartPadColumns` ligne 132 ; `smartEditMode` ligne 135.
- `MidiListener.tsx` : routage `pad_` lignes 77 (LED feedback) et 230 (déclenchement).
- `widgets/Pad.tsx` : composant pad avec support MIDI Learn (border bleue pulsante).

## 4. Spécification comportementale

- **S1** — QUAND la sidebar est en panel `scenes` ALORS `SceneController` est rendu : header (titre `SCÈNES LIVE` + toggle `[Visuel|MIDI]`), barre de pages `[P1][P2][P3][P4]`, grille de pads, pied (ligne MIDI Learn + ligne Assistant). Le tout occupe la hauteur disponible, la grille scrolle si besoin.
- **S2** — QUAND `smartPadViewMode === 'visual'` (défaut) ALORS la grille affiche les 16 slots de la page active en **4 colonnes × 4 lignes**, pads carrés (aspect-ratio 1, min 64px), chacun montrant : icône (24px), nom (text-[10px], 1 ligne ellipsis), fond = couleur du pad à opacité 0.25 + bordure de la couleur, badge `🎹<note>` en coin haut-droit si `midiMappings['pad_<page>_<slot>']` existe. Slot vide = case pointillée avec `+` (clic = créer un pad dans ce slot, réutilise la modal de config existante).
- **S3** — QUAND `smartPadViewMode === 'midi'` ALORS la grille affiche les **64 pads des 4 pages** en 8×8 compact (pads ~28px, gap 2px) : fond = couleur du pad (pleine), numéro de note MIDI en `text-[8px] font-mono`, pas de nom. L'ordre reproduit l'APC Mini : ligne du bas = page 1 slots 0-7… (mapping note = `page * 16 + slot`, affiché de bas en haut comme l'APC). La page active est encadrée d'un liseré cyan.
- **S4** — QUAND l'utilisateur clique un pad (les deux modes) ALORS `triggerSmartPad(pad)` est appelé (toggle scène, identique à l'existant). Pad actif : ring cyan (`ring-2 ring-cyan-400`) + glow (`box-shadow: 0 0 20px rgba(6,182,212,0.4)`) + pulse BPM (cf. `01-CONVENTIONS.md §6`).
- **S5** — QUAND l'utilisateur clique un onglet de page `[P1..P4]` ALORS `activePadPage` change ; transition : fade 150ms. Chaque onglet montre un dot si sa page contient au moins un pad actif.
- **S6** — QUAND `smartEditMode === true` ALORS en mode Visuel le drag & drop d'un pad sur un autre slot (même page) appelle `movePad(...)` ; un drop sur un onglet de page déplace le pad vers le premier slot libre de cette page. Hors edit mode, pas de drag.
- **S7** — QUAND l'utilisateur fait un clic droit sur un pad ALORS un menu contextuel s'ouvre : `Éditer` (ouvre la modal de config existante), `Dupliquer` (copie dans le premier slot libre de la page), `Assigner MIDI` (lance le MIDI Learn pour ce pad), `Supprimer` (avec la garde `showLock` existante). Fermeture clic extérieur/Échap.
- **S8** — QUAND le MIDI Learn est actif pour un pad (ligne pied `🎹 MIDI Learn [Activer]`, puis clic sur un pad) ALORS le pad cible pulse en bleu (réutiliser le pattern de `widgets/Pad.tsx`) et le prochain Note On reçu est enregistré sous la clé `pad_<page>_<slot>`.
- **S9** — QUAND la ligne Assistant (`🎵 Assistant [Mariage ▼] [✨ Générer]`) est utilisée ALORS `applyPadTemplate(template, activePadPage)` remplit la **page active** avec les pads du template (reprendre les contenus des templates existants de `applyStarterShow` ~926 : Wedding/Club/Live VJ), après une confirmation si la page n'est pas vide (`Remplacer les 16 pads de la page P<n> ?`).
- **S10** — QUAND C2 est terminé ALORS `renderPadsGrid`, `renderApcVirtual` et la grille « contrôle surface presets » sont supprimés de `SmartDashboard.tsx` ; les entrées `pads` et `apcVirtual` sont retirées de `DEFAULT_WIDGETS` dans `smartModeSlice.ts` et filtrées au chargement d'anciens états (migration). La modal de config pad est déplacée dans `SceneController.tsx` (ou un sous-fichier `smart/PadConfigModal.tsx`).
- **S11** — QUAND un ancien état est chargé (localStorage ou projet) ALORS migration : pads sans `page`/`slot` → `page = floor(index/16)`, `slot = index % 16` ; clés MIDI `pad_<id>` → réécrites `pad_<page>_<slot>` (cf. `01-CONVENTIONS.md §5`).
- **S12** — QUAND un Note On mappé arrive dans `MidiListener.tsx` ALORS le routage `pad_` résout désormais `pad_<page>_<slot>` → retrouve le pad par page/slot → `triggerSmartPad`. Le LED feedback (ligne ~77) suit le même format de clé.

## 5. Modèle de données

```ts
// smartModeSlice.ts — modifications
export type SmartPad = {
  id: number; name: string; color: string; textColor: string; iconName: string;
  qlcPage: number; qlcWidget: number;
  dmxValues?: Record<number, number>;
  dmxCommands?: Array<{ universe: number; channel: number; value: number }>;
  midiNote: number; midiChannel: number;
  page: number;   // 0-3  (NOUVEAU)
  slot: number;   // 0-15 (NOUVEAU)
  // gridCol/gridRow/gridW/gridH : conservés mais plus utilisés par la vue SMART
};

activePadPage: number;                       // défaut 0 — persisté
setActivePadPage: (page: number) => void;
smartPadViewMode: 'visual' | 'midi';         // défaut 'visual' — persisté
setSmartPadViewMode: (mode: 'visual' | 'midi') => void;
movePad: (padId: number, toPage: number, toSlot: number) => void;
  // si le slot cible est occupé : swap des deux pads
applyPadTemplate: (template: 'mariage' | 'club' | 'livevj', page: number) => void;
  // remplace les pads de `page` par ceux du template (slots 0-15)
```

`smartPadColumns` devient inutilisé en vue SMART (conservé pour compat, ne pas supprimer).

## 6. Wireframe textuel

```
MODE VISUEL (4×4, page P1)                MODE MIDI (8×8, 4 pages)
┌─────────────────────────────┐           ┌─────────────────────────────┐
│ 🎛 SCÈNES LIVE   [Visuel|MIDI]│         │ 🎛 SCÈNES LIVE   [Visuel|MIDI●]│
├─────────────────────────────┤           ├─────────────────────────────┤
│ [P1●] [P2] [P3] [P4]        │           │ [P1●] [P2] [P3] [P4]        │
├─────────────────────────────┤           ├─────────────────────────────┤
│ ┌────┐┌────┐┌────┐┌────┐    │           │ ▓▓ ░░ ▓▓ ░░ ▓▓ ░░ ▓▓ ░░  ← P4│
│ │ 💧 ││ 🔥 ││ ⚡ ││ 💓 │    │           │ ░░ ▓▓ ░░ ▓▓ ░░ ▓▓ ░░ ▓▓     │
│ │Blue││Red ││Neon││Bass│    │           │ … (8 lignes, note en petit) │
│ │🎹56││    ││🎹58││ACTIVE   │           │ ▓▓ ░░ ▓▓ ░░ ▓▓ ░░ ▓▓ ░░  ← P1│
│ └────┘└────┘└────┘└────┘    │           │ └─ liseré cyan = page active │
│ ┌────┐┌╌╌╌╌┐┌╌╌╌╌┐┌╌╌╌╌┐    │           ├─────────────────────────────┤
│ │ ✨ ││ +  ││ +  ││ +  │    │           │ 🎹 MIDI Learn [ON] cliquez   │
│ └────┘└╌╌╌╌┘└╌╌╌╌┘└╌╌╌╌┘    │           │ un pad puis une touche…      │
│ … (4 lignes)                │           └─────────────────────────────┘
├─────────────────────────────┤
│ 🎹 MIDI Learn [Activer]     │
│ 🎵 Assistant [Mariage ▼] [✨ Générer]   │
└─────────────────────────────┘
Menu contextuel (clic droit pad) : Éditer / Dupliquer / Assigner MIDI / Supprimer
```

## 7. Critères d'acceptation

- **AC1** (S1, S2) : la sidebar affiche la grille 4×4 de la page active, avec icônes/noms/couleurs et badges MIDI.
- **AC2** (S3) : le toggle MIDI affiche les 64 slots en 8×8 avec numéros de note ; clic déclenche bien la scène.
- **AC3** (S4) : pad actif = ring cyan + pulse au BPM ; désactivé si `prefers-reduced-motion`.
- **AC4** (S5) : navigation P1-P4 fonctionne, dot d'activité visible.
- **AC5** (S6, S7) : drag & drop en edit mode, menu contextuel complet en clic droit.
- **AC6** (S8, S12) : MIDI Learn sur un pad enregistre `pad_<page>_<slot>` ; la note physique déclenche le pad ; le LED feedback APC suit.
- **AC7** (S9) : « Générer » remplit la page active avec le template choisi, avec confirmation.
- **AC8** (S10) : plus aucun widget `pads`/`apcVirtual` dans la zone centrale ; anciens états filtrés sans crash.
- **AC9** (S11) : un projet sauvegardé avant C2 se charge avec ses pads en page 0 et ses mappings MIDI fonctionnels.
- **AC10** : `npm run build` passe.

## 8. Hors scope

- Ne pas toucher : `lib/dmxEngine.ts`, `triggerSmartPad` (logique de déclenchement inchangée), `MacroTimeline.tsx`, `renderGroupStrips`/`renderStagePlan`/`renderVjDeck`/`renderMiniPlaylist`/`renderSpectro`, la TopBar, la vue CREATOR.
- Ne pas implémenter l'inspecteur (C3) ni de nouveau routage MIDI déclaratif (C3) — seule la clé `pad_` change de format ici.
- Pas de swipe tactile entre pages (itération ultérieure).

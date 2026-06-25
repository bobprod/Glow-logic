# C3 — Inspecteur contextuel dans la sidebar (façon Ableton Live)

**Dépend de :** C1 | **Bloque :** C4, C6 | **Priorité :** 🔴 P0
**Fichiers à charger en contexte :**
- `apps/web/src/components/FixtureController.tsx`
- `apps/web/src/components/SmartDashboard.tsx` (uniquement `renderStagePlan`, lignes ~1120-1380)
- `apps/web/src/components/smart/SmartSidebar.tsx` (créé en C1)
- `apps/web/src/components/MidiListener.tsx`
- `apps/web/src/store/slices/uiSlice.ts`
- `apps/web/src/store/slices/midiSlice.ts`
- `apps/web/src/components/widgets/XYPad.tsx`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Idée maîtresse du product owner : comme dans Ableton Live (cliquer une piste affiche sa chaîne de devices), **cliquer un élément du Plan de Scène Interactif ouvre dans la sidebar l'inspecteur complet de cet élément** — XY pad pan/tilt, couleur, gobos, presets de mouvement — avec mapping MIDI par contrôle (comme on mappe un instrument/une batterie dans Ableton). L'inspecteur fixture existe déjà (`FixtureController.tsx`, vue FIXTURES du Creator) : on le rend réutilisable au lieu de le réécrire.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/FixtureInspectorPanel.tsx` (extraction du corps de FixtureController) |
| Créer | `apps/web/src/components/smart/GroupInspectorPanel.tsx` |
| Modifier | `apps/web/src/components/FixtureController.tsx` (devient un wrapper `layout='page'`) |
| Modifier | `apps/web/src/components/smart/SmartSidebar.tsx` (slot `inspector`) |
| Modifier | `apps/web/src/components/SmartDashboard.tsx` (`renderStagePlan` : sélection → sidebar, suppression du panneau droit) |
| Modifier | `apps/web/src/components/MidiListener.tsx` (table de routage déclarative + préfixe `fixture_`) |
| Modifier | `apps/web/src/store/slices/uiSlice.ts` (sélection groupe) |

## 3. État existant (réfs vérifiées)

- `FixtureController.tsx` : `export default function FixtureController` ligne 127 ; `detectFixtureType` ligne 100 ; `hasXYPad = panCh && tiltCh` ligne 231 ; `sendChannelMulti` ~264 ; `sendXYMulti` ligne 280 ; panneaux : sélecteur+actions (~393-531), XYPad (~533-578, bouton Centrer `sendXYMulti(127,127)` ligne 572), couleur+roue (~581-645), gobos (~647-691), prisme/optiques (~694+). Layout actuel : panneaux horizontaux de ~230px (scroll horizontal).
- `SmartDashboard.tsx` `renderStagePlan` lignes 1120-1380 : cercles fixtures (LY1-4, D1-3, LAT, FC1-4) ; clic → `setSelectedStageGroup(groupName)` → panneau droit (intensité/couleur/mute du groupe). Ce panneau droit disparaît (remplacé par la sidebar).
- `uiSlice.ts` : `selectedFixtureId` ligne 40, `selectedFixtureIds` ligne 42 (partagés avec la 3D et la vue FIXTURES) ; `smartSidebarPanel` ajouté en C1.
- `MidiListener.tsx` : auto-map APC en dur lignes 170-198 (CC48-53 → `setGroupLevel('Face'…)`, notes 64-71 → mutes) ; MIDI Learn capture lignes 201-211 ; routage play-mode en if/else lignes 230-285 (`pad_`, `fader_`, `crossfader_main`, `topbar_blackout`, `topbar_autopilot`).
- `three/FixtureInspector.tsx` : inspecteur 3D existant — **doublon à résorber** (voir S11).

## 4. Spécification comportementale

### Sélection et commutation sidebar

- **S1** — QUAND l'utilisateur clique une **fixture individuelle** sur le Plan de Scène ALORS `setSelectedFixtureId(nodeId)` est appelé ET `smartSidebarPanel` passe à `'inspector'` (auto-switch). La fixture cliquée reçoit un ring blanc sur le plan (existant).
- **S2** — QUAND l'utilisateur clique le **label d'un groupe** sur le Plan de Scène (les titres de rangée `LYRE`, `DCH 1`, `DCH 2`, `DCH 3`, `LAT`, `FACE`) ALORS `selectedStageGroup` est défini et la sidebar passe à `'inspector'` en mode **groupe** (S8). Le panneau droit actuel du stagePlan est supprimé — la sidebar le remplace.
- **S3** — QUAND l'inspecteur est ouvert ALORS son header affiche `[← Scènes]  <Nom>  [×]`. Le bouton `← Scènes`, le bouton `×` et la touche Échap ramènent `smartSidebarPanel` à `'scenes'` et désélectionnent (`setSelectedFixtureId(null)` / `selectedStageGroup = null`). Un clic dans le vide du Plan de Scène fait de même.
- **S4** — QUAND une fixture est sélectionnée et que l'utilisateur clique une autre fixture ALORS l'inspecteur se met à jour sans repasser par `'scenes'`.

### Inspecteur fixture (`FixtureInspectorPanel`)

- **S5** — QUAND on extrait `FixtureController` ALORS le corps (détection de type, lecture des canaux, `sendChannelMulti`/`sendXYMulti`/`sendRGBWAMulti`, tous les panneaux de contrôle) part dans `FixtureInspectorPanel.tsx` avec la signature `{ fixtureId: string; layout: 'sidebar' | 'page' }`. `FixtureController.tsx` devient : sélecteur de fixture + `<FixtureInspectorPanel fixtureId={selectedFixtureId} layout='page' />`. Zéro changement fonctionnel pour la vue FIXTURES.
- **S6** — QUAND `layout === 'sidebar'` ALORS les panneaux s'empilent verticalement dans cet ordre : ① XYPad pleine largeur (carré, aspect-ratio 1) + valeurs Pan/Tilt + bouton `Centrer` ; ② presets de mouvement (`Cercle`, `8`, `Sweep`, `Random` — réutiliser les effets existants `startEffect` du dmxEngine, mêmes presets que la vue actuelle) ; ③ Couleur (ColorPicker + roue presets) ; ④ accordéons repliés par défaut : `Gobos`, `Prisme & optiques`, `Beam & strobe`. Le dimmer master de la fixture est un slider horizontal sous le XYPad.
- **S7** — QUAND plusieurs fixtures sont sélectionnées (`selectedFixtureIds.length > 1`, multi-sélection existante) ALORS le header affiche `<n> fixtures` et les contrôles agissent sur toutes (comportement `sendXYMulti`/`sendChannelMulti` existant).

### Inspecteur groupe (`GroupInspectorPanel`)

- **S8** — QUAND la sidebar est en mode inspector **groupe** ALORS elle affiche le contenu actuel du panneau droit du stagePlan, à l'identique : slider Intensité (%), grille de couleurs (8 presets + picker hex), bouton `Muter`/`Démuter`. Plus une liste des fixtures du groupe : cliquer une fixture de la liste bascule sur son inspecteur fixture (S1).

### Mapping MIDI façon Ableton

- **S9** — QUAND on refactore `MidiListener.tsx` ALORS le routage play-mode (lignes 230-285) devient une **table déclarative** `MIDI_ROUTES: Array<{ match: (controlId: string) => boolean; handle: (controlId, mapping, data1, data2, state) => void }>` parcourue dans l'ordre. Les routes existantes (`pad_`, `fader_`, `crossfader_main`, `topbar_blackout`, `topbar_autopilot`) ET l'auto-map APC en dur (lignes 170-198) sont portés dans cette table sans changement de comportement.
- **S10** — QUAND `midiLearnMode` est actif ALORS chaque contrôle de l'inspecteur (XY pad : deux cibles distinctes Pan et Tilt affichées comme deux petites pastilles `P`/`T` sous le pad ; slider dimmer ; chaque preset de mouvement est NON mappable dans ce chantier) devient cliquable pour sélection (`setMidiLearnActiveControl('fixture_<nodeId>_pan' | '_tilt' | '_dimmer')`, border bleue pulsante comme `widgets/Pad.tsx`). Le prochain CC reçu est enregistré sous cette clé. En lecture, la table de routage ajoute la route `fixture_` : CC → `Math.round(data2 * 255 / 127)` → `dmxEngine.setChannel(universe, panCh|tiltCh|dimmerCh, value, { source: 'manual' })` pour la fixture visée (résoudre universe/canaux depuis `fixtures` du store ; ça doit marcher même si l'inspecteur est fermé).
- **S11** — QUAND une fixture mappée est affichée dans l'inspecteur ALORS chaque contrôle mappé porte un badge `🎹` avec tooltip `CC <n> · canal <c>` ; clic droit sur le badge → `Supprimer le mapping` (`removeMidiMapping`). Doublon 3D : `three/FixtureInspector.tsx` ne doit plus être l'éditeur de référence — au clic sur une fixture dans le visualiseur 3D en mode SMART, ouvrir CE panneau sidebar (même flux que S1). Ne pas supprimer le fichier 3D dans ce chantier ; juste rediriger la sélection.

## 5. Modèle de données

```ts
// uiSlice.ts — ajout
selectedStageGroup: string | null;           // déjà un useState local dans SmartDashboard → le REMONTER dans uiSlice (non persisté)
setSelectedStageGroup: (group: string | null) => void;

// midiSlice.ts — AUCUN changement de structure.
// Nouvelles clés utilisées : fixture_<nodeId>_pan / _tilt / _dimmer (cf. 01-CONVENTIONS.md §3)
```

```ts
// smart/FixtureInspectorPanel.tsx
interface FixtureInspectorPanelProps {
  fixtureId: string;
  layout: 'sidebar' | 'page';
}
```

## 6. Wireframe textuel

```
SIDEBAR — Inspecteur fixture (layout sidebar)        SIDEBAR — Inspecteur groupe
┌──────────────────────────────┐                     ┌──────────────────────────────┐
│ [← Scènes]  LY2 · beam 12ch [×]                    │ [← Scènes]  CONTRE        [×]│
├──────────────────────────────┤                     ├──────────────────────────────┤
│ ┌──────────────────────────┐ │                     │ Intensité ────────●── 61%    │
│ │        XY PAD            │ │ ← carré, plein      │ COULEUR  ■■■■■■■■  [#hex]   │
│ │      ◉ (pan/tilt)        │ │   largeur           │ [    Muter    ]              │
│ └──────────────────────────┘ │                     ├──────────────────────────────┤
│ Pan 190 · Tilt 160  [Centrer]│                     │ FIXTURES DU GROUPE           │
│  (P)🎹CC12   (T)🎹CC13       │ ← cibles MIDI       │  ◦ LY1   ◦ LY2   ◦ LY3  ◦ LY4│
│ MOUVEMENT [○][∞][⇄][⚡]      │                     │  (clic → inspecteur fixture) │
│ 💡 Dimmer ───────────●  255  │                     └──────────────────────────────┘
├──────────────────────────────┤
│ COULEUR  [picker] ■■■■■■■■   │
├──────────────────────────────┤
│ ▸ Gobos          (accordéon) │
│ ▸ Prisme & optiques          │
│ ▸ Beam & strobe              │
└──────────────────────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1, S3, S4) : clic fixture sur le plan → inspecteur dans la sidebar ; `← Scènes`/`×`/Échap/clic-vide → retour au SceneController ; clic d'une autre fixture → mise à jour directe.
- **AC2** (S2, S8) : clic groupe → inspecteur groupe avec intensité/couleur/mute identiques à l'ancien panneau droit (qui n'existe plus) + liste des fixtures.
- **AC3** (S5) : la vue FIXTURES du Creator fonctionne exactement comme avant (wrapper).
- **AC4** (S6) : en sidebar, XY pad pleine largeur opérationnel (drag souris/tactile → pan/tilt DMX), presets mouvement, couleur, accordéons.
- **AC5** (S9) : routage MidiListener en table déclarative, tous les comportements existants conservés (pads, faders zones, auto-map APC, blackout, autopilot, LED feedback).
- **AC6** (S10) : on peut mapper un CC physique sur Pan et un autre sur Tilt via MIDI Learn ; bouger les potards pilote la lyre même inspecteur fermé.
- **AC7** (S11) : badge 🎹 sur contrôles mappés, suppression de mapping au clic droit ; clic fixture dans le 3D (mode SMART) ouvre l'inspecteur sidebar.
- **AC8** : `npm run build` passe.

## 8. Hors scope

- Ne pas toucher : `lib/dmxEngine.ts` (les presets de mouvement utilisent `startEffect` existant), `SceneController` (C2), `MacroTimeline.tsx`, les groupes dynamiques (C5 — l'inspecteur groupe travaille avec les groupes actuels en dur), l'édition de position des fixtures sur le plan (C6).
- Pas de bouton REC ni d'enregistrement d'automation (C4).
- Pas de mapping MIDI des presets de mouvement ni des couleurs (itération ultérieure).
- Ne pas supprimer `three/FixtureInspector.tsx`.

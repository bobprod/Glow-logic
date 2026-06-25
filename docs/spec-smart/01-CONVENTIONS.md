# 01 — Conventions partagées (à respecter dans tous les chantiers)

## 1. Arborescence cible

Les nouveaux composants de la vue SMART vont dans `apps/web/src/components/smart/` :

```
apps/web/src/components/smart/
├── SmartSidebar.tsx          (C1) — conteneur sidebar : switch scenes ↔ inspector
├── SmartToolsModals.tsx      (C1) — modals Diagnostic / Preflight / Recovery extraits
├── SceneController.tsx       (C2) — contrôleur de scènes unifié
├── FixtureInspectorPanel.tsx (C3) — inspecteur fixture réutilisable (sidebar + page)
├── GroupInspectorPanel.tsx   (C3) — inspecteur groupe (intensité/couleur/mute)
├── GroupStrips.tsx           (C5) — faders de groupes dynamiques extraits
├── StagePlan.tsx             (C6) — plan de scène extrait + mode édition
└── TrajectoryEditor.tsx      (C7) — éditeur de trajectoires pan/tilt
```

Stratégie **strangler** : on n'extrait une render function de `SmartDashboard.tsx` que lorsque son chantier la touche. On ne déplace jamais du code « en passant ».

## 2. Patterns du projet (à imiter)

- **Store** : Zustand, slices dans `apps/web/src/store/slices/*.ts`, agrégés dans `store/useStore.ts`, persistés en localStorage (`glow-logic-storage`) via `partialize`. Tout nouveau champ persisté doit être ajouté au `partialize` ET à la sérialisation projet (`projectSlice.ts` → `saveProject`/`loadProject`).
- **Composants** : function components TS, hooks `useStore()` avec sélection des champs nécessaires, `useCallback` pour les handlers passés aux enfants.
- **DMX** : toute écriture passe par `dmxEngine.setChannel(universe, channel, value, { source })` (`lib/dmxEngine.ts`). Sources : `'manual'` (priorité 3, lock 1200ms), `'timeline'` (2, 120ms), `'background'` (1, 0ms). Ne jamais écrire de DMX en contournant le moteur.
- **Sockets** : événements existants `smart:trigger_scene`, `smart:blackout`, `smart:zone_intensity`, `dmx_update`, `dmx_sync`. Ne pas en créer de nouveaux sans mention dans le chantier.
- **Toasts** : `addToast({ type, message, detail?, duration? })` du `toastSlice`.
- **Icônes** : `lucide-react`, taille `w-4 h-4` (boutons) / `w-6 h-6` (principales).
- **Widgets réutilisables existants** : `components/widgets/XYPad.tsx`, `ColorPicker.tsx`, `VerticalFader.tsx`, `Pad.tsx`. Les réutiliser, ne pas les dupliquer.

## 3. Convention de clés `midiMappings` (FIGÉE — utilisée par C2, C3, C4, C5)

Le store `midiSlice.ts` : `midiMappings: Record<string, { type: number; channel: number; data1: number }>` (type 144 = Note On, 176 = CC).

| Cible | Clé (controlId) | Type MIDI attendu |
|-------|-----------------|-------------------|
| Pad de scène | `pad_<page>_<slot>` (page 0-3, slot 0-15) | Note On |
| Fader de zone (legacy) | `fader_<zoneName>` | CC |
| Fader de groupe | `group_<groupId>_level` | CC |
| Mute de groupe | `group_<groupId>_mute` | Note On |
| Pan d'une fixture | `fixture_<nodeId>_pan` | CC |
| Tilt d'une fixture | `fixture_<nodeId>_tilt` | CC |
| Dimmer d'une fixture | `fixture_<nodeId>_dimmer` | CC |
| Crossfader | `crossfader_main` | CC |
| Blackout | `topbar_blackout` | Note On |
| Autopilot | `topbar_autopilot` | Note On |

Règles :
- Les clés legacy `pad_<id>` (id numérique de pad) sont migrées en `pad_<page>_<slot>` par C2.
- Un CC 0-127 pilotant pan/tilt est converti en valeur DMX 0-255 (`value * 2 + (value >> 6)` ou `Math.round(value * 255 / 127)`) — utiliser `Math.round(value * 255 / 127)`.
- Le routage MIDI en lecture vit dans `components/MidiListener.tsx` sous forme de **table de routage déclarative** (introduite par C3 §S9) : `Array<{ prefix: string; handle: (controlId, mapping, data2, state) => void }>`. Tout nouveau préfixe s'ajoute à cette table, jamais en `if/else` ad hoc.

## 4. Modèle de données global cible (après C1…C7)

Extensions de slices — chaque chantier recopie la partie qui le concerne, ceci est la vue d'ensemble :

```ts
// uiSlice (C1)
smartSidebarPanel: 'scenes' | 'inspector';

// smartModeSlice (C2)
type SmartPad = { /* champs existants */ ; page: number /* 0-3 */; slot: number /* 0-15 */ };
activePadPage: number;            // 0-3
smartPadViewMode: 'visual' | 'midi';

// timelineSlice (C4)
type AutomationKeyframe = { id: string; timeMs: number; value: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold' }; // défaut 'linear'
automationRecArmed: boolean;
recTargetFixtureId: string | null;

// showPlayerSlice (C5)
type DmxGroup = { id: string; name: string; color: string; fixtureIds: string[]; order: number };
dmxGroups: DmxGroup[];            // remplace les 6 groupes en dur
groupPresets: Array<{ id: string; name: string; groups: DmxGroup[]; levels: Record<string, number> }>;

// smartModeSlice (C6)
stagePlanLayout: Array<{ fixtureId: string; x: number; y: number; rotation: number }>; // x,y en % 0-100
stagePlanEditMode: boolean;
previewMode: boolean;             // true = sortie DMX physique coupée, 3D actif
```

## 5. Migrations (états persistés)

À l'hydratation du store ET dans `projectSlice.loadProject` :

| Changement | Règle de migration |
|------------|--------------------|
| Pads paginés (C2) | Pad sans `page`/`slot` → `page = 0`, `slot = index dans le tableau` (max 15, surplus → page 1…) |
| Clés MIDI pads (C2) | `pad_<id>` → retrouver le pad par id → réécrire en `pad_<page>_<slot>` |
| Keyframe easing (C4) | `easing` absent → `'linear'` (ne pas réécrire les données, traiter à la lecture) |
| Groupes dynamiques (C5) | `dmxGroups` absent → générer les 6 défauts (Face, Douche 1, Douche 2, Douche 3, Latéral, Contre) avec `id = slug du nom` (`face`, `douche-1`, …) et recopier `groupLevels/Mutes/Colors` existants |
| Layout plan (C6) | `stagePlanLayout` absent → positions par défaut actuelles du `renderStagePlan` |

## 6. Thème, typographie, animations

- Fonds : `#0A0A0C` (principal), `#0c0e12`, `#12141A`, `#1a1c23` (panneaux).
- Accents : cyan `#06b6d4`/`#22d3ee` (primaire), purple `#a855f7`/`#8b5cf6` (secondaire), rouge `#ef4444` (danger/REC), ambre `#f59e0b` (warning/édition), vert `#22c55e` (success).
- Texte secondaire : slate `#94a3b8`/`#64748b`. Titres : `font-black tracking-widest uppercase`. Valeurs numériques : `font-mono`.
- Transitions de layout : 200ms `cubic-bezier(0.4, 0, 0.2, 1)`. Micro-interactions : 100-150ms.
- **Pulse BPM** : keyframes CSS `opacity 1 → 0.7 → 1`, durée `60 / bpm` secondes, appliqué via une CSS variable `--bpm-pulse-duration` mise à jour quand `bpm` change. Désactivé si `prefers-reduced-motion`.

## 6bis. Lexique UI (labels visibles)

Les labels affichés suivent le lexique de `03-DISCIPLINE.md §4` : en mode Perform/Smart, dire **Projecteur** (pas Fixture), **Intensité** (pas Dimmer), **Vérification avant show** (pas Preflight), **Récupération de show** (pas Recovery), **Synchro DJ** (pas OS2L), ne jamais exposer « widget » ou « QLC ». Les identifiants de code (types, slices, props) ne changent pas. Tout chantier met en conformité les labels qu'il touche.

## 7. Accessibilité (minimum exigé sur tout nouveau composant)

- Pads : `role="button"`, `aria-pressed` selon l'état actif.
- Faders/sliders : `role="slider"`, `aria-valuenow/min/max`, pilotables aux flèches clavier (pas de drag obligatoire).
- Pages/onglets : `role="tablist"` / `role="tab"` / `aria-selected`.
- XY pad : `role="application"` + `aria-label="Pad Pan/Tilt"`, flèches clavier = pas de 1 (Maj = pas de 10).
- Contraste texte ≥ 4.5:1.

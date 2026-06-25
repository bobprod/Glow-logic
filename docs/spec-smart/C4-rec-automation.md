# C4 — REC temps réel : mouvements X/Y → keyframes d'automation timeline

**Dépend de :** C3 | **Bloque :** C7 | **Priorité :** 🔴 P0
**Fichiers à charger en contexte :**
- `apps/web/src/components/smart/FixtureInspectorPanel.tsx` (créé en C3)
- `apps/web/src/store/slices/timelineSlice.ts`
- `apps/web/src/components/MacroTimeline.tsx` (lecture playhead + rendu pistes automation)
- `apps/web/src/lib/dmxEngine.ts` (LECTURE SEULE — comprendre les locks)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Comme l'automation d'Ableton Live : armer REC, bouger le XY pad à la souris pendant que la timeline joue, et les mouvements pan/tilt sont capturés en keyframes sur des pistes d'automation, éditables ensuite dans la MacroTimeline. L'infrastructure keyframes existe (`AutomationTrack`, interpolation linéaire) ; il manque la capture temps réel, la création automatique de pistes, la simplification des points et l'easing.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Modifier | `apps/web/src/store/slices/timelineSlice.ts` (REC state, easing, actions batch) |
| Modifier | `apps/web/src/components/smart/FixtureInspectorPanel.tsx` (bouton REC + capture) |
| Modifier | `apps/web/src/components/MacroTimeline.tsx` (easing à la lecture, indicateur REC) |
| Créer | `apps/web/src/lib/simplifyKeyframes.ts` (Douglas-Peucker) |

## 3. État existant (réfs vérifiées)

- `timelineSlice.ts` : `AutomationKeyframe` ligne 38 (`{ id, timeMs, value }`) ; `AutomationTrack` ligne 44 (`{ id, label, fixtureId, universe, channel, channelType: 'dimmer'|'pan'|'tilt'|'red'|'green'|'blue'|'strobe'|'color'|'custom', color, enabled, keyframes }`) ; `addAutomationKeyframe` ligne 145 (insère + trie par `timeMs`) ; `addAutomationTrack` ligne 138.
- `MacroTimeline.tsx` : lecture des pistes automation pendant le play (interpolation **linéaire** dans `getAutomationValueAtTime`, ~ligne 59-77) → `dmxEngine.setChannel(universe, channel, value, { source: 'timeline' })` ; édition keyframes : double-clic = ajout, drag = déplacement. Le playhead (temps écoulé en ms) est l'horloge de référence.
- `dmxEngine.ts` : priorités `manual=3` (lock 1200ms) > `timeline=2` (120ms) — lignes 21-30. Le XY pad écrit en `manual`.
- `showPlayerSlice.ts` : `isRecording` ligne 26 = REC **audio** (« Rec Lumière ») — NE PAS réutiliser ce flag.

## 4. Spécification comportementale

### Armement et capture

- **S1** — QUAND une fixture avec pan/tilt est affichée dans l'inspecteur sidebar ALORS un bouton `● REC` (rouge `#ef4444`, à droite du bouton `Centrer`) est visible. Clic → `automationRecArmed = true`, `recTargetFixtureId = fixtureId`. Le bouton passe en plein rouge pulsant et le XY pad reçoit une bordure rouge. Re-clic ou Échap → désarmement.
- **S2** — QUAND `automationRecArmed === true` et que l'utilisateur commence un drag sur le XY pad ALORS si la timeline est **arrêtée**, elle démarre la lecture à la position courante du playhead (punch-in) ; si elle joue déjà, l'enregistrement se fait en vol. Le DMX continue d'être émis normalement pendant le drag (source `manual`, comportement existant).
- **S3** — QUAND un drag REC est en cours ALORS toutes les **50 ms** (throttle 20 Hz), deux échantillons sont bufferisés en mémoire locale (pas encore dans le store) : `{ timeMs: playheadMs, value: panDmx }` et `{ timeMs: playheadMs, value: tiltDmx }`.
- **S4** — QUAND le drag se termine (pointer up) ALORS :
  1. Résolution des pistes : `getOrCreateAutomationTrack(fixtureId, 'pan')` et `(…, 'tilt')` — réutilise une piste existante de même `fixtureId`+`channelType`, sinon en crée une (label `"<NomFixture> · Pan"`, `universe`/`channel` résolus depuis les canaux de la fixture, `color` cyan pour pan / purple pour tilt, `enabled: true`).
  2. Simplification **Douglas-Peucker** des buffers (tolérance epsilon = 2 sur l'échelle 0-255) via `simplifyKeyframes.ts`.
  3. `recordKeyframeBatch(trackId, keyframes, { fromMs, toMs })` : supprime les keyframes existantes de la piste dans `[fromMs, toMs]` (mode **overwrite**) puis insère les nouvelles, triées.
  4. Toast success : `"<n> keyframes enregistrées → <NomFixture> Pan/Tilt"`.
- **S5** — QUAND l'enregistrement se termine ALORS `automationRecArmed` reste armé (enregistrements successifs possibles) jusqu'à désarmement manuel, fermeture de l'inspecteur ou changement de fixture.
- **S6** — QUAND la timeline rejoue une zone fraîchement enregistrée ALORS spécification du conflit de locks : le lock `manual` (1200ms) posé par le dernier geste expire avant relecture dans la plupart des cas ; pour garantir la relecture immédiate, au pointer-up du REC, appeler `dmxEngine.setChannel(universe, ch, lastValue, { source: 'manual', lockMs: 0 })` pour les canaux pan/tilt concernés (libération explicite du lock). Ne pas modifier `dmxEngine.ts` : l'option `lockMs` existe déjà.

### Easing des keyframes

- **S7** — QUAND le modèle `AutomationKeyframe` est étendu ALORS il gagne `easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold'` (défaut `'linear'`, données anciennes lues comme linéaires sans réécriture). `'hold'` = la valeur reste constante jusqu'à la keyframe suivante (step).
- **S8** — QUAND `getAutomationValueAtTime` interpole entre la keyframe A et B ALORS la courbe utilisée est l'`easing` de **A** : linear `t`, easeIn `t²`, easeOut `1-(1-t)²`, easeInOut `t<0.5 ? 2t² : 1-((-2t+2)²)/2`, hold `valeur de A`.
- **S9** — QUAND l'utilisateur fait un clic droit sur une keyframe dans la MacroTimeline ALORS un menu propose les 5 easings (l'actif coché) + `Supprimer`. Les keyframes issues du REC sont créées en `'linear'`.

### Feedback UI

- **S10** — QUAND `automationRecArmed === true` ALORS la MacroTimeline affiche un badge `● REC` rouge près des contrôles de transport, et les pistes cibles (pan/tilt de `recTargetFixtureId`) sont surlignées en rouge translucide pendant la capture.

## 5. Modèle de données

```ts
// timelineSlice.ts — ajouts
export interface AutomationKeyframe {
  id: string;
  timeMs: number;
  value: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold'; // défaut 'linear'
}

automationRecArmed: boolean;                 // défaut false — NON persisté
recTargetFixtureId: string | null;           // défaut null — NON persisté
setAutomationRecArmed: (armed: boolean, fixtureId?: string | null) => void;

getOrCreateAutomationTrack: (
  fixtureId: string,
  channelType: 'pan' | 'tilt',
  meta: { label: string; universe: number; channel: number; color: string }
) => string; // retourne trackId

recordKeyframeBatch: (
  trackId: string,
  keyframes: Array<Omit<AutomationKeyframe, 'id'>>,
  overwriteRange: { fromMs: number; toMs: number }
) => void;
```

```ts
// lib/simplifyKeyframes.ts
export function simplifyKeyframes(
  points: Array<{ timeMs: number; value: number }>,
  epsilon: number // distance perpendiculaire max, échelle de value
): Array<{ timeMs: number; value: number }>;
// Implémentation Douglas-Peucker récursive classique, sans dépendance npm.
```

## 6. Wireframe textuel

```
Inspecteur (extrait, fixture sélectionnée, REC armé)
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │  XY PAD  (bordure rouge) │ │
│ └──────────────────────────┘ │
│ Pan 190 · Tilt 160           │
│ [Centrer]   [● REC]←rouge pulsant
└──────────────────────────────┘
MacroTimeline pendant capture
┌────────────────────────────────────────────┐
│ ▶ ⏸ ⏹  00:42.3   ● REC                    │
│ LY2 · Pan  ●──●─●●●●●●●(capture)──         │ ← surligné rouge translucide
│ LY2 · Tilt ●────●──●●●●●(capture)──        │
└────────────────────────────────────────────┘
Clic droit keyframe : ( ) Linear (•) EaseIn ( ) EaseOut ( ) EaseInOut ( ) Hold | 🗑 Supprimer
```

## 7. Critères d'acceptation

- **AC1** (S1) : bouton REC visible sur fixture pan/tilt, armement/désarmement avec feedback visuel.
- **AC2** (S2) : drag XY pad timeline arrêtée → punch-in (la lecture démarre) ; timeline en lecture → capture en vol.
- **AC3** (S3, S4) : après un drag de ~3 s, deux pistes Pan/Tilt existent avec des keyframes simplifiées (ordre de grandeur : < 40 points pour 3 s de mouvement fluide, pas ~60 bruts), toast affiché.
- **AC4** (S4.3) : ré-enregistrer sur la même zone remplace les anciennes keyframes de la fenêtre balayée uniquement.
- **AC5** (S6) : juste après le pointer-up, relancer la lecture sur la zone enregistrée rejoue les mouvements (pas de lock résiduel).
- **AC6** (S7, S8, S9) : easing sélectionnable par clic droit, lecture respecte la courbe, anciens projets se chargent (easing absent = linéaire).
- **AC7** (S10) : badge REC + surlignage des pistes pendant capture.
- **AC8** : `npm run build` passe.

## 8. Hors scope

- Ne pas modifier `lib/dmxEngine.ts` (l'option `lockMs: 0` existe).
- Pas de REC pour couleur/dimmer/autres canaux (pan/tilt uniquement dans ce chantier — l'architecture `getOrCreateAutomationTrack` doit cependant accepter un `channelType` paramétré pour l'avenir).
- Pas de courbes de Bézier éditables ni de poignées de tangente.
- Pas de quantize BPM des keyframes.
- Ne pas toucher : SceneController, StagePlan, TopBar, vue CREATOR.

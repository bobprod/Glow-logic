# C7 — Trajectoires dessinées → keyframes pan/tilt

**Dépend de :** C4, C6 | **Bloque :** — | **Priorité :** 🟡 P1
**Fichiers à charger en contexte :**
- `apps/web/src/components/smart/FixtureInspectorPanel.tsx` (C3/C4)
- `apps/web/src/store/slices/timelineSlice.ts` (post-C4 : easing, `getOrCreateAutomationTrack`, `recordKeyframeBatch`)
- `apps/web/src/lib/simplifyKeyframes.ts` (C4)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Pour les lyres, dessiner une trajectoire (cercle, figure-8, sweep, tracé libre) et la convertir automatiquement en keyframes pan/tilt sur la timeline — au lieu d'enregistrer à la main (C4) ou de poser des keyframes une à une. Équivalent des « movement FX » de SoundSwitch, mais éditable ensuite comme de l'automation normale.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/TrajectoryEditor.tsx` |
| Créer | `apps/web/src/lib/trajectoryGenerator.ts` |
| Modifier | `apps/web/src/components/smart/FixtureInspectorPanel.tsx` (bouton `✏ Trajectoire`) |

## 3. État existant

- C4 fournit : `getOrCreateAutomationTrack(fixtureId, 'pan'|'tilt', meta)`, `recordKeyframeBatch(trackId, keyframes, overwriteRange)`, easing par keyframe, `simplifyKeyframes`.
- L'inspecteur (C3) a déjà des presets de mouvement temps réel (`Cercle`, `8`, `Sweep`, `Random` via `dmxEngine.startEffect`) — **distincts** : eux tournent en boucle live, C7 écrit des keyframes éditables dans la timeline. Ne pas les fusionner.
- Le XY pad mappe l'espace pan (X, 0-255) / tilt (Y, 0-255).

## 4. Spécification comportementale

- **S1** — QUAND une fixture pan/tilt est dans l'inspecteur ALORS un bouton `✏ Trajectoire` (sous les presets de mouvement) ouvre `TrajectoryEditor` en modal (640×520px max, responsive).
- **S2** — QUAND l'éditeur est ouvert ALORS il affiche : un canvas carré représentant l'espace pan/tilt (mêmes axes que le XY pad, croix au centre 127/127), un sélecteur de forme `[Cercle] [Huit] [Sweep] [Libre]`, des paramètres, et un aperçu animé de la trajectoire (point qui parcourt le path en boucle, durée = durée configurée).
- **S3** — QUAND la forme est `Cercle` ou `Huit` ALORS les paramètres sont : Centre (drag de la forme sur le canvas ; défaut = position pan/tilt actuelle de la fixture), Amplitude pan / Amplitude tilt (0-127, sliders), Durée d'un cycle (`beats` si Sync BPM activé : 1/2/4/8/16 temps ; sinon secondes 0.5-30), Phase (0-360°), Sens (horaire/antihoraire). Génération : cercle `pan = cx + A·cos(θ+φ)`, `tilt = cy + B·sin(θ+φ)` ; huit (Lissajous) `pan = cx + A·sin(θ+φ)`, `tilt = cy + B·sin(2θ)`.
- **S4** — QUAND la forme est `Sweep` ALORS l'utilisateur place 2 points (A → B) sur le canvas ; paramètres : Durée, Aller-retour (toggle), Easing (les 5 de C4). Génération : interpolation A→B (→A si aller-retour).
- **S5** — QUAND la forme est `Libre` ALORS l'utilisateur dessine au doigt/souris sur le canvas ; le tracé est échantillonné puis simplifié (`simplifyKeyframes`, epsilon 2) ; paramètre : Durée totale (le tracé est rejoué à vitesse uniforme sur cette durée).
- **S6** — QUAND l'utilisateur clique `Insérer dans la timeline` ALORS : nombre de cycles (champ `Répétitions`, défaut 1, max 64) × durée de cycle = fenêtre `[playheadMs, playheadMs + total]` ; les keyframes pan et tilt sont générées (échantillonnage : 16 keyframes par cycle pour cercle/huit, 2(+1) pour sweep, points simplifiés pour libre ; easing `'linear'`, sauf sweep qui utilise l'easing choisi sur ses segments) et écrites via `getOrCreateAutomationTrack` + `recordKeyframeBatch` (overwrite de la fenêtre). Toast : `Trajectoire <forme> insérée : <n> keyframes sur <durée>s`. La modal se ferme.
- **S7** — QUAND `Sync BPM` est activé ALORS la durée de cycle = `beats × 60000 / bpm` ms, recalculée à l'insertion avec le BPM courant du store (pas de re-sync dynamique après insertion — les keyframes sont figées, c'est assumé et indiqué par un hint dans la modal : `Figé au BPM courant (<bpm>)`).
- **S8** — QUAND l'utilisateur clique `Tester` (bouton secondaire) ALORS la trajectoire joue UNE fois en live sur la fixture (écriture DMX `source: 'manual'`, boucle `requestAnimationFrame`) sans rien écrire dans la timeline ; un clic pendant le test l'arrête.

## 5. Modèle de données

```ts
// lib/trajectoryGenerator.ts
export interface TrajectoryDef {
  shape: 'circle' | 'eight' | 'sweep' | 'free';
  centerPan: number;        // 0-255
  centerTilt: number;       // 0-255
  amplitudePan: number;     // 0-127
  amplitudeTilt: number;    // 0-127
  cycleDurationMs: number;  // déjà résolu depuis beats si sync BPM
  phaseDeg: number;         // 0-360
  clockwise: boolean;
  repetitions: number;      // 1-64
  // sweep :
  pointA?: { pan: number; tilt: number };
  pointB?: { pan: number; tilt: number };
  roundTrip?: boolean;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';
  // free :
  freePoints?: Array<{ pan: number; tilt: number }>;
}

export function generateTrajectoryKeyframes(
  def: TrajectoryDef,
  startMs: number
): { pan: Array<{ timeMs: number; value: number; easing?: string }>;
     tilt: Array<{ timeMs: number; value: number; easing?: string }> };
// Pur, sans accès au store. Valeurs clampées 0-255.
```

Aucun nouvel état persisté : seules les keyframes produites sont stockées (dans les `automationTracks` existantes).

## 6. Wireframe textuel

```
MODAL — ✏ Trajectoire (LY2)
┌──────────────────────────────────────────────────┐
│ ✏ TRAJECTOIRE — LY2                          [×] │
│ [Cercle●] [Huit] [Sweep] [Libre]                 │
│ ┌───────────────────┐  Amplitude pan  ───●── 60  │
│ │     ╭───╮         │  Amplitude tilt ──●─── 40  │
│ │    (  ⊙  ) ←aperçu│  Durée  [4 temps ▼] ☑Sync BPM│
│ │     ╰───╯  animé  │  Phase  ──●──── 90°        │
│ │  + centre dragable│  Sens   [Horaire ▼]        │
│ └───────────────────┘  Répétitions [ 8 ]         │
│ Figé au BPM courant (128)                        │
│        [▶ Tester]   [⤓ Insérer dans la timeline] │
└──────────────────────────────────────────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1, S2) : modal accessible depuis l'inspecteur, aperçu animé pour chaque forme.
- **AC2** (S3) : cercle 4 temps sync BPM 128 → keyframes couvrant 1875 ms/cycle, 16 kf/cycle/axe, valeurs clampées.
- **AC3** (S4, S5) : sweep A→B avec easing ; tracé libre simplifié rejoué à durée fixe.
- **AC4** (S6) : insertion à partir du playhead, overwrite de la fenêtre uniquement, toast, lecture timeline = mouvement attendu dans le 3D (mode Preview C6 utilisable pour vérifier).
- **AC5** (S8) : `Tester` joue une fois sans toucher la timeline.
- **AC6** : `generateTrajectoryKeyframes` est pur et couvert par un test unitaire minimal (cercle : premier point = centre+amplitude·cos(phase), nombre de points = 16×répétitions+1).
- **AC7** : `npm run build` passe.

## 8. Hors scope

- Pas de dessin de trajectoire directement sur le Plan de Scène (le canvas modal suffit pour cette itération).
- Pas de re-sync BPM dynamique post-insertion.
- Pas de trajectoires multi-fixtures avec déphasage automatique (itération ultérieure).
- Ne pas modifier les presets de mouvement live existants (`startEffect`), ni `dmxEngine.ts`, ni MacroTimeline au-delà de la lecture normale des keyframes.

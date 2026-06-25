# C16 — Crossfade entre scènes (fade par pad + fade global)

**Dépend de :** Porte 1 (05-PLAN-VAGUE-2) | **Bloque :** C17 | **Priorité :** 🟡 P1 vague 2
**Fichiers à charger en contexte :**
- `apps/web/src/lib/dmxEngine.ts` (`fadeChannels` ligne ~187, `crossfade` ligne ~191, types easing)
- `apps/web/src/store/slices/smartModeSlice.ts` (`SmartPad`, `triggerSmartPad`)
- `apps/web/src/components/smart/SceneController.tsx` (menu contextuel pad, modal config)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Aujourd'hui un pad applique ses valeurs DMX instantanément (snap). Les consoles de référence (SoundSwitch, MyDMX) fondent les ambiances : passer de « Warmup » à « Slow dance » doit pouvoir prendre 2 secondes de fondu. Le moteur sait déjà le faire (`fadeChannels`/`crossfade` avec easing) — il n'est juste pas branché sur les pads. C'est le chantier au meilleur ratio valeur/effort de la vague 2.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Modifier | `apps/web/src/store/slices/smartModeSlice.ts` (`SmartPad.fadeMs`, logique `triggerSmartPad`) |
| Modifier | `apps/web/src/components/smart/SceneController.tsx` (UI fade : config pad + menu contextuel + fade global) |
| Modifier | `apps/web/src/lib/projectMigration.ts` (défaut `fadeMs`) |

## 3. État existant

- `triggerSmartPad(pad)` : applique `pad.dmxValues` / `pad.dmxCommands` via `dmxEngine.setChannel` (instantané) + émet `smart:trigger_scene` + applique le scale `masterDimmer`.
- `dmxEngine.fadeChannels(channels[], durationMs, easing)` et `crossfade(A, B, durationMs, easing)` existent (easings : `sCurve` par défaut). Les fades écrivent en interne via le moteur (priorités respectées).
- La modal de config pad (C2) édite nom/couleur/icône/MIDI. Le menu contextuel pad (C2-S7) a Éditer/Dupliquer/Assigner MIDI/Supprimer.
- L'inspecteur fixture a déjà un « Transition/Fade time picker » (0s à 3s) — pour les gestes manuels, distinct de ce chantier.

## 4. Spécification comportementale

- **S1** — QUAND le modèle `SmartPad` est étendu ALORS il gagne `fadeMs?: number` (0 = instantané, défaut). Migration : pads existants sans champ → `fadeMs: 0` (aucune réécriture nécessaire, traiter `undefined` comme 0).
- **S2** — QUAND `triggerSmartPad` active un pad avec `fadeMs > 0` ALORS au lieu de `setChannel` directs, il construit la liste `{universe, channel, value}` des valeurs cibles (avec le scale `masterDimmer` appliqué comme aujourd'hui) et appelle `dmxEngine.fadeChannels(liste, fadeMs, 'sCurve')`. La désactivation (toggle off) fade vers les valeurs de repos selon la même durée (comportement off actuel, mais fadé).
- **S3** — QUAND un pad B est déclenché alors qu'un pad A est actif ET que les deux ont des canaux en commun ALORS le fade de B remplace simplement les cibles (le moteur de fade gère l'interruption par canal — pas de logique spéciale A/B à coder ; NE PAS utiliser `crossfade()` ici, il est pour des listes disjointes).
- **S4** — QUAND l'utilisateur ouvre la config d'un pad ALORS un champ `Fondu` apparaît : presets `[0s] [0.5s] [1s] [2s] [4s]` + saisie libre (0-30000 ms, step 100). Le menu contextuel du pad gagne une entrée `Fondu ▸` avec les mêmes presets (édition rapide sans ouvrir la modal).
- **S5** — QUAND un pad a `fadeMs > 0` ALORS son coin bas-droit affiche un petit indicateur `⏱ 2s` (text-[8px], slate) en mode Visuel.
- **S6** — QUAND l'utilisateur règle le **Fade global** (nouveau contrôle compact dans le header du SceneController : `Fondu global [OFF ▼]` avec presets 0/0.5/1/2/4 s) ALORS sa valeur REMPLACE le `fadeMs` de tous les déclenchements tant qu'il n'est pas sur OFF (priorité : global > pad). Persisté.
- **S7** — QUAND un pad est déclenché pendant un fade en cours sur les mêmes canaux ALORS le nouveau fade part des valeurs courantes (comportement naturel de `fadeChannels` — vérifier, sinon le forcer en lisant `getChannel` avant).
- **S8** — QUAND le BLACKOUT est activé ALORS il reste **instantané** (jamais fadé — geste d'urgence), quel que soit le fade global.
- **S9** — QUAND une scène est déclenchée par MIDI, par chaser ou par la timeline ALORS le même chemin `triggerSmartPad` s'applique → le fade fonctionne identiquement (aucun code spécifique ; l'AC le vérifie).

## 5. Modèle de données

```ts
// smartModeSlice.ts
export type SmartPad = { /* existant */ ; fadeMs?: number };  // 0-30000, défaut 0
smartGlobalFadeMs: number;                    // 0 = OFF, défaut 0 — persisté + projet
setSmartGlobalFadeMs: (ms: number) => void;
```

## 6. Wireframe textuel

```
Header SceneController : 🎛 SCÈNES LIVE  [Visuel|MIDI]  Fondu global [OFF ▼]
                                                          ├ OFF / 0.5s / 1s / 2s / 4s
Pad (mode Visuel) :        Menu contextuel pad :          Modal config pad :
┌────────┐                 ┌──────────────┐               Fondu
│   💧   │                 │ Éditer       │               [0s][0.5s][1s][2s][4s]
│ Warmup │                 │ Dupliquer    │               [ 1500 ] ms
│    ⏱2s │ ← indicateur    │ Fondu      ▸ │
└────────┘                 │ Assigner MIDI│
                           │ Supprimer    │
                           └──────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1, S4, S5) : régler un fade de 2 s sur un pad via la modal ET via le menu contextuel ; indicateur ⏱ visible ; persiste au reload.
- **AC2** (S2) : déclencher le pad → les canaux montent en ~2 s (vérifiable au visualiseur/Preview ou via `dmxEngine.getChannel` échantillonné) ; toggle off → descente fadée.
- **AC3** (S3, S7) : enchaîner deux pads partageant des canaux → transition fluide sans saut à zéro intermédiaire.
- **AC4** (S6) : fade global 1 s → tous les pads fondent à 1 s même si leur fadeMs vaut 0 ; OFF → retour aux valeurs par pad.
- **AC5** (S8) : BLACKOUT coupe instantanément même avec fade global 4 s.
- **AC6** (S9) : un pad déclenché via sa note MIDI fade identiquement.
- **AC7** : migration — projet pré-C16 chargé sans erreur, pads en fade 0 ; `npm run build` + `test:unit` + `test:api` verts.

## 8. Hors scope

- Pas de courbe de fade configurable par pad (sCurve fixe — l'easing par pad est une entrée backlog).
- Pas de crossfader A/B physique deux-scènes (autre concept, backlog).
- Pas de fade sur les faders de groupes ni les zones (gestes manuels = temps réel).
- Ne pas modifier `dmxEngine.ts` ni `DmxFader.ts` (si S7 révèle un départ de fade incorrect, le corriger côté appelant en lisant `getChannel`).

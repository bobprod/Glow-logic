# C14 — Mode « Live Performance » plein écran

**Dépend de :** Porte 1 (05-PLAN-VAGUE-2) | **Bloque :** C17 | **Priorité :** 🔴 P0 vague 2
**Fichiers à charger en contexte :**
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/smart/SceneController.tsx`
- `apps/web/src/components/smart/GroupStrips.tsx`
- `apps/web/src/components/smart/DmxStatusBadge.tsx`
- `apps/web/src/components/TopBar.tsx`
- `apps/web/src/store/slices/uiSlice.ts`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Le soir du show, l'opérateur n'a besoin que de : déclencher des ambiances, doser les groupes, voir le BPM et l'état des sorties, et pouvoir tout couper. Tout le reste (timeline, plan, réglages, menus) est du bruit et un risque de fausse manipulation. Ce mode masque tout sauf l'essentiel, en plein écran — idée d'origine du product owner (prompt initial, question 4).

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/LivePerformanceView.tsx` |
| Modifier | `apps/web/src/components/AppShell.tsx` (rendu du mode + raccourci) |
| Modifier | `apps/web/src/components/TopBar.tsx` (bouton d'entrée) |
| Modifier | `apps/web/src/store/slices/uiSlice.ts` (`livePerformanceMode`) |

## 3. État existant

- `AppShell.tsx` : coque unique (C8a), rend TopBar + sidebar + zone centrale + MacroTimeline.
- `SceneController` (C2) et `GroupStrips` (C5) sont des composants autonomes branchés sur le store — réutilisables tels quels.
- `DmxStatusBadge` (C9) : badge santé sorties. `smartBlackout` + bouton BLACKOUT existent dans TopBar.
- Il existe déjà un bouton « LIVE (RÉDUIT) » historique en bas à droite (fonction floue, signalé dans le prompt initial) — à remplacer par ce mode.

## 4. Spécification comportementale

- **S1** — QUAND l'utilisateur clique le bouton `▶ LIVE` (TopBar, à droite du toggle SMART/CREATOR, visible en mode smart uniquement) OU presse `F10` ALORS `livePerformanceMode = true` et `LivePerformanceView` recouvre TOUT l'écran (z-index au-dessus de tout, fond `#0A0A0C`), en demandant le fullscreen navigateur (`document.documentElement.requestFullscreen()`, toléré si refusé).
- **S2** — QUAND le mode est actif ALORS l'écran affiche UNIQUEMENT, de haut en bas :
  - bandeau fin (40px) : nom du projet, BPM (font-mono, pulse au beat), badge DMX (composant `DmxStatusBadge` réutilisé), horloge, bouton `Quitter` discret ;
  - zone pads : `SceneController` en mode Visuel, pads agrandis (la grille 4×4 de la page active occupe ~60% de la hauteur), onglets P1-P4 conservés, MIDI Learn et Assistant MASQUÉS ;
  - zone groupes : `GroupStrips` sans le menu Presets ni le mode édition (faders + MUTE uniquement) ;
  - bouton **BLACKOUT** : pleine largeur, 56px de haut, rouge, en bas d'écran — même action que la TopBar.
- **S3** — QUAND le mode est actif ALORS toute édition est inerte : `smartEditMode` forcé à false, clic droit sur pads désactivé, drag désactivé, `showLock` activé à l'entrée (et restauré à sa valeur précédente à la sortie).
- **S4** — QUAND l'utilisateur veut sortir ALORS : bouton `Quitter` OU **appui long sur Échap (800 ms)** — un appui court ne sort PAS (anti-fausse-manip) ; un appui court affiche 1,5 s un hint `Maintenir Échap pour quitter`. La sortie restaure l'écran précédent et quitte le fullscreen navigateur.
- **S5** — QUAND le mode est actif ALORS les mappings MIDI restent pleinement actifs (pads, faders, blackout — MidiListener n'est pas affecté), et la timeline continue de jouer si elle jouait (le mode est un overlay d'affichage, pas un changement d'état du show).
- **S6** — QUAND l'app se recharge ALORS `livePerformanceMode` est TOUJOURS false (jamais persisté).
- **S7** — QUAND le mode est actif sur écran < 1024px (tablette) ALORS la zone groupes passe sous les pads en scroll, le bouton BLACKOUT reste fixé en bas (sticky).
- **S8** — QUAND C14 est livré ALORS l'ancien bouton « LIVE (RÉDUIT) » est supprimé (rechercher l'ancre texte `LIVE` / `RÉDUIT` dans TopBar/AppShell et retirer le code associé).

## 5. Modèle de données

```ts
// uiSlice.ts — ajouts (NON persistés, exclus du partialize)
livePerformanceMode: boolean;                 // défaut false
setLivePerformanceMode: (on: boolean) => void; // gère showLock save/restore (S3)
```

## 6. Wireframe textuel

```
┌────────────────────────────────────────────────────────────┐
│ test ▪ BPM 128.0 ▪ ●DMX ▪ 23:47:12                [Quitter]│ 40px
├────────────────────────────────────────────────────────────┤
│  [P1●] [P2] [P3] [P4]                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   💧     │ │   🔥     │ │   ⚡     │ │   💓     │       │
│  │  Warmup  │ │  Build   │ │  Drop    │ │  Bass    │  ~60% │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  … (4×4, pads agrandis, pulse BPM sur l'actif)             │
├────────────────────────────────────────────────────────────┤
│  Face  Douche1  Douche2  Douche3  Latéral  Contre          │
│   ┃▌     ┃▌      ┃▌       ┃▌       ┃▌       ┃▌            │
│  [MUTE] [MUTE]  [MUTE]   [MUTE]   [MUTE]   [MUTE]          │
├────────────────────────────────────────────────────────────┤
│ ████████████████  BLACKOUT  ████████████████               │ 56px
└────────────────────────────────────────────────────────────┘
Échap court → toast « Maintenir Échap pour quitter »
```

## 7. Critères d'acceptation

- **AC1** (S1) : bouton TopBar et F10 ouvrent le mode en fullscreen ; rien d'autre n'est visible.
- **AC2** (S2) : pads de la page active déclenchables, faders de groupes opérationnels, BLACKOUT fonctionne, badge DMX vivant.
- **AC3** (S3) : aucun clic droit/drag/édition possible ; `showLock` actif pendant le mode et restauré après.
- **AC4** (S4) : Échap court ne sort pas (hint affiché) ; Échap long 800 ms sort ; `Quitter` sort.
- **AC5** (S5) : un pad mappé MIDI se déclenche depuis le contrôleur physique pendant le mode ; la timeline en lecture continue de jouer.
- **AC6** (S6) : reload navigateur pendant le mode → l'app revient en vue normale.
- **AC7** (S8) : l'ancien bouton « LIVE (RÉDUIT) » n'existe plus.
- **AC8** : `npm run build` + `test:unit` + `test:api` verts.

## 8. Hors scope

- Pas de layout éditable du mode live (positions fixes).
- Pas de second écran / sortie projection.
- Pas de nouveau composant pad/fader — réutilisation stricte de SceneController/GroupStrips (props d'options autorisées : `compact`, `readonly`).
- Ne pas toucher : MacroTimeline, dmxEngine, MidiListener, backend.

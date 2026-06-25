# BACKLOG — Améliorations candidates (post-refonte)

> Conformément à `03-DISCIPLINE.md §1` : aucune de ces entrées n'entre dans le code tant que les **dettes dues** ne sont pas soldées. Une entrée passe en chantier (spec dédiée, gabarit C-n) sur décision écrite du PO.

## 0. Dettes dues AVANT toute nouveauté (rappel, pas du backlog)

| # | Quoi | Réf |
|---|------|-----|
| D1 | Finir C8c : mort de `PatchPanel.tsx` (dernier doublon de convergence) | C8-convergence.md |
| D2 | Premier run CI réel (Playwright n'a JAMAIS été exécuté) + vérifier qu'ESLint tourne dans `npm run verify` | 04-REVUE §4 |
| D3 | Rituel humain « Show de zéro » + mesure TTFL baseline | 03-DISCIPLINE §2-3 |
| D4 | Étapes 5 (REC) et 8 (panne sortie → badge) du scénario ajoutées au spec Playwright | 04-REVUE §4 |
| D5 | Migration progressive `fetch()` → `apiFetch()` (le monkey-patch reste un filet, pas une stratégie) | 04-REVUE §3 P2-6 |

## 1. Live & performance scénique (différenciation max)

- **B1 — Mode « Live Performance » plein écran** : masque tout sauf pads, faders de groupes, BPM, BLACKOUT, badge DMX ; sortie par Échap longue ou code. *(Idée d'origine du PO — question 4 du prompt initial, jamais traitée.)* Petit chantier, grosse valeur le soir J.
- **B2 — Crossfade entre scènes** : le moteur `crossfade()` existe dans dmxEngine ; l'exposer — slider de fade global + durée par pad (clic droit → « fade 2 s »). Standard chez SoundSwitch.
- **B3 — Solo de groupe** : complément du MUTE (écouter un groupe seul) ; trivial côté store, gros confort de réglage.
- **B4 — Follow actions sur les pads** (façon Ableton) : « après 8 temps → pad suivant / aléatoire de la page ». Transforme une page de pads en mini-show automatique.
- **B5 — Quantize BPM des keyframes + courbes au beat** : caler le REC (C4) sur la grille tempo ; complète trajectoires (C7) sync BPM.
- **B6 — Tablette : layout tactile dédié** (breakpoints du prompt initial §5) : sidebar en bottom-sheet, pads 2×4, faders élargis. L'app vise l'iPad en régie mobile — aujourd'hui c'est du desktop rétréci.

## 2. Intelligence & assistance (l'ADN « Smart »)

- **B7 — Autopilot audio-réactif sérieux** : le spectro et `smartAutoPilot` existent ; relier détection beat/énergie → déclenchement de pads pondéré par page/tags (« calme », « drop »). C'est LE différenciateur vs QLC+.
- **B8 — Import Open Fixture Library (OFL/GDTF)** : aujourd'hui le patch repose sur le scan OCR/LLM ou la saisie ; un import depuis la base communautaire OFL (~1000 profils JSON librement réutilisables) ferait chuter le TTFL plus que n'importe quelle feature UI.
- **B9 — Suggestions IA contextuelles** : « génère une page de pads adaptée à mon patch » (le LLM connaît les fixtures patchées) — extension naturelle de l'assistant templates C2.

## 3. Fiabilité & exploitation (la confiance, suite de C9/C10)

- **B10 — ArtPoll/ArtPollReply** : découverte des nodes Art-Net avec accusé de présence → le badge C9 passe de « best-effort UDP » à « node vu il y a 2 s ».
- **B11 — Journal de show** : enregistrer horodaté tout ce qui se passe pendant le live (pads, faders, pannes, blackouts) → export pour débrief / preuve en cas de litige presta.
- **B12 — Watchdog + auto-restart backend** dans le launcher (le pattern existe côté Hermes) + reprise de session automatique.
- **B13 — TLS optionnel + rate-limit** sur l'API (suite C10, requis si un jour accès hors LAN).

## 4. Création & timeline

- **B14 — Courbes de Bézier éditables** sur l'automation (poignées de tangente) — après adoption réelle de l'easing C4.
- **B15 — REC multi-paramètres** : étendre le REC C4 au dimmer/couleur (l'architecture `getOrCreateAutomationTrack` est déjà paramétrée pour).
- **B16 — Trajectoires multi-fixtures avec déphasage** (vague de lyres) — extension C7 explicitement reportée.
- **B17 — Undo : couvrir l'édition de timeline fine** (déplacements de clips en masse, collages) au-delà du périmètre minimal C8e.

## 5. Technique & distribution

- **B18 — Budget bundle + lazy-load Three.js** : `next-bundle-analyzer`, vérifier que la 3D ne pèse pas sur le TTFL en Perform.
- **B19 — Poursuivre l'extraction de SmartDashboard** (1 688 lignes → viser < 800 : zoneControls, vjDeck, miniPlaylist, spectro vers `smart/`).
- **B20 — Packaging installeur** (Electron/Tauri ou simple installeur Windows du launcher) : « double-clic → ça marche » — à n'ouvrir qu'après D3, car ça fige le TTFL mesuré.
- **B21 — Versionnement de schéma SQLite** (table `schema_migrations`) pour remplacer les `ALTER TABLE` try-catch silencieux.

## Priorisation recommandée (après D1-D5)

`B1 (live full screen) → B8 (import OFL) → B2 (crossfade) → B7 (autopilot) → B10 (ArtPoll) → B6 (tablette)` — le reste à la demande.
Logique : d'abord ce qui sert le show du samedi soir (B1, B2), puis ce qui fait tomber le TTFL (B8), puis la différenciation (B7).

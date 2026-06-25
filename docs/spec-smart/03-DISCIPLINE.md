# 03 — Discipline produit : moratoire, rituel de validation, métrique, lexique

> Ce fichier n'est pas un chantier à coder : c'est le **contrat de processus** qui accompagne C1-C10. Il répond aux risques n°3 (features > consolidation), n°4 (langage/utilisateur), n°6 (dérive 3D) de l'avis d'expertise du 2026-06-11. À relire au début de chaque session de travail (humaine ou agent).

## 1. Moratoire sur les nouvelles surfaces

**Règle** : tant que C1-C4 + C9 + C8 ne sont pas livrés et validés, AUCUNE nouvelle intégration n'entre dans le code :
- pas de nouveau protocole (pas de sACN, pas de GrandMA, pas de nouveau sync),
- pas de nouveau deck/module (pas de nouveau VJ, médias IA, drone++),
- pas de nouvelle dépendance npm hors besoin direct d'un chantier.

**Test du moratoire** pour toute demande : « est-ce que ça réduit la dette (fusion, fiabilité, undo) ou est-ce que ça ajoute une surface ? » Une surface → backlog `docs/spec-smart/BACKLOG.md` (créer au besoin), pas le code. Exceptions : bugs, sécurité, et décision explicite du PO consignée par écrit.

**Garde-fou 3D** (risque n°6) : le visualiseur reste *fonctionnel* — faisceaux, couleurs, pan/tilt et Preview corrects. Tout travail de rendu « réaliste » (volumétrique avancé, fumée, réflexions, qualité Capture/Depence) est hors moratoire ET hors backlog court terme : un préviz approximatif qui se prétend réaliste ment à l'utilisateur.

## 2. Rituel de validation humaine (après CHAQUE chantier)

Les agents valident `npm run build`, pas l'expérience. Après chaque chantier mergé : **15 minutes de test manuel scénarisé** par le PO, sur la machine réelle.

**Scénario de référence « Show de zéro »** (à dérouler intégralement, chronométré) :
1. Lancer l'app (launcher), arriver en mode Smart.
2. Patcher 4 PAR LED + 2 lyres (scan ou bibliothèque), les placer sur le plan.
3. Créer 8 pads de scènes (2 couleurs, 1 strobe, 1 blackout, 4 libres) — page 1.
4. Mapper 2 pads + 1 fader de groupe sur l'APC mini (ou clavier si absent).
5. Sélectionner une lyre sur le plan → inspecteur → bouger le XY pad → REC un mouvement de 10 s.
6. Sauvegarder le projet. Fermer complètement. Relancer.
7. Recharger le projet : les 8 pads, les mappings, les positions et l'automation sont intacts ; lancer la timeline : le mouvement rejoue (en Preview si pas de matériel).
8. Débrancher/couper une sortie DMX : le badge passe rouge en ≤ 5 s (post-C9).

**Règle de sortie** : un chantier n'est « livré » que si le scénario passe ET qu'aucune étape n'a *empiré* (temps, clics, bugs). Toute friction observée = issue immédiate, pas une note mentale.

**Automatisation** : ce scénario est la cible du test Playwright de référence (`apps/web/tests/show-from-scratch.spec.ts`, à créer progressivement — étapes 2-3-6-7 automatisables dès C2 ; brancher dans la CI dès que Playwright y tourne, cf. C11).

## 3. Métrique unique : Time-To-First-Light (TTFL)

**Définition** : temps entre « machine allumée, app installée » et « un vrai projecteur (ou le 3D en Preview) répond à un fader », pour un utilisateur qui découvre.

- Mesurer au chrono à chaque rituel (§2, étapes 1-2 + bouger un fader).
- Baseline à établir à la prochaine session, objectif : **< 10 minutes** matériel branché, **< 3 minutes** en Preview 3D.
- Chaque itération doit faire baisser (ou maintenir) le TTFL ; une feature qui l'augmente doit le justifier explicitement.

## 4. Choix d'utilisateur et courbe d'apprentissage (risque n°4)

**Décision de cadrage** : le mode **Perform (Smart) est conçu pour le débutant-mariage/DJ** — utilisable en 10 minutes, lexique grand public, zéro jargon. Le mode **Build (Creator) est conçu pour le pro/passionné** — peut exiger une heure, lexique métier toléré. Toute décision d'UI se tranche avec cette phrase : *« le débutant la verra-t-elle en Perform ? »* Si oui, elle doit être simple ou cachée.

**Lexique UI imposé** (labels visibles ; les noms de code/types ne changent pas) :

| ❌ Interdit en Perform | ✅ À utiliser |
|------------------------|---------------|
| Fixture | Projecteur |
| Widget / QLC widget | (ne jamais exposer — dire Scène, Module) |
| Preflight | Vérification avant show |
| Recovery | Récupération de show |
| Universe / Univers DMX | (Perform : caché ; Build : Univers) |
| OS2L, OSC, Art-Net (dans les labels) | Synchro DJ, Réseau lumière (le sigle en sous-titre) |
| Dimmer | Intensité |
| Pan/Tilt (labels Perform) | Mouvement (X/Y affiché dans l'inspecteur, tolérés en Build) |
| Cue / Chaser (Perform) | Enchaînement / Séquence (tolérés en Build) |
| Blackout | Conservé (terme universel scène) — tooltip « Noir total » |

Règle d'application : tout chantier qui touche un label le met en conformité au passage (pas de chantier dédié). Les nouveaux composants (C1-C10) naissent conformes.

## 5. Définition de « livré » (Definition of Done globale)

Un chantier est livré quand : tous ses AC passent + `npm run build` sans erreur TS + scénario de référence §2 déroulé sans régression + TTFL mesuré + lexique §4 respecté sur les surfaces touchées + entrée ajoutée au journal (`memory/` ou commit message détaillé).

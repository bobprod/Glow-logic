# 📐 Spec Refonte SMART — Index maître

> **Glow Logic v2.1 — Refonte UX de la vue SMART.**
> Ce dossier est la source de vérité pour les agents codeurs (Codex…). Chaque chantier (C1…C7) est un fichier **autonome** : pour exécuter un chantier, charge UNIQUEMENT son fichier + les fichiers sources listés dans son en-tête. Ne charge jamais deux chantiers à la fois.

## Vision

Transformer la vue SMART en console de régie aussi fluide qu'**Ableton Live** (mapping MIDI universel, inspecteur contextuel, automation enregistrable), **CapCut** (timeline directe), **MadMapper/SoundSwitch** (préviz, plan de feu interactif) :

1. La sidebar gauche devient une zone vivante à deux états : **Contrôleur de scènes unifié** (repos) ↔ **Inspecteur contextuel** (quand une fixture/un groupe est sélectionné sur le plan de scène).
2. Tout contrôle (pad, fader de groupe, pan/tilt, dimmer) est **mappable MIDI** comme on mappe un instrument dans Ableton.
3. Les mouvements à la souris sur le XY pad sont **enregistrables (REC)** comme keyframes pan/tilt dans la timeline, puis éditables.
4. Le plan de scène et le visualiseur 3D deviennent des outils d'**édition et de préviz** (mode Preview sans sortie DMX physique), plus seulement des afficheurs.

## Chantiers et ordre d'exécution

| # | Fichier | Titre | Priorité | Dépend de |
|---|---------|-------|----------|-----------|
| C1 | `C1-topbar-sidebar.md` | TopBar compacte + libération sidebar | 🔴 P0 | — |
| C2 | `C2-scene-controller.md` | Contrôleur de scènes unifié (Pads + APC Mini) | 🔴 P0 | C1 |
| C3 | `C3-inspector-contextuel.md` | Inspecteur contextuel sidebar | 🔴 P0 | C1 |
| C4 | `C4-rec-automation.md` | REC temps réel X/Y → keyframes timeline | 🔴 P0 | C3 |
| C9 | `C9-fiabilite-dmx.md` | Fiabilité sorties DMX : erreurs visibles, badge par sortie | 🔴 P0 | C1 |
| C5 | `C5-groupes-dynamiques.md` | Groupes DMX dynamiques + faders mappables | 🟡 P1 | C1, C3 |
| C6 | `C6-plan-scene-3d.md` | Plan de scène éditable + sync + mode Preview | 🟡 P1 | C3, C5 |
| C8 | `C8-convergence.md` | Convergence Smart/Creator (5 lots C8a-e) + undo global | 🟡 P1 | C1-C6 |
| C10 | `C10-securite.md` | Auth API locale (token pairing) + safety gate bloquant | 🔴 P0 avant production | C9, C8a |
| C7 | `C7-trajectoires.md` | Trajectoires dessinées → keyframes pan/tilt | 🟡 P1 | C4, C6 |

```
C1 ──┬──> C2
     ├──> C3 ──> C4 ───────────────────┐
     ├──> C9 ─────────────> C10        │
     └──> C5 ──> C6 ──> C8 ──┴──> C7 <─┘
```

**Ordre d'exécution : C1 → C2 → C3 → C4 → C9 → C5 → C6 → C8 → C10 → C7.**
Justifications d'ordre : C9 avant les P1 (un échec de sortie DMX invisible détruit la confiance de l'opérateur — la fiabilité prime sur les fonctionnalités) ; C10 avant tout show réel (API sans auth = non-option avec laser/pyro) ; C7 en dernier (la plus démonstrative, la moins urgente — sans valeur tant que le REC C4 n'est pas solide et adopté). Ne jamais commencer un chantier dont les dépendances ne sont pas mergées.

> **Vague 2** : la vague 1 (C1-C10) est implémentée (revue : `04-REVUE-POST-CODEX.md`). La suite est pilotée par **`05-PLAN-VAGUE-2.md`** : Porte 1 (dettes D1-D5) → Porte 2 (rituel humain) → chantiers `C14-live-performance.md`, `C15-import-ofl.md`, `C16-crossfade-scenes.md` (C11-C13 réservés — utilisés informellement par l'agent de la vague 1). Les idées non planifiées vivent dans `BACKLOG.md`.

> **`03-DISCIPLINE.md` est contraignant pour toutes les sessions** : moratoire sur les nouvelles surfaces jusqu'à C8 livré, rituel de validation manuelle « Show de zéro » après chaque chantier, métrique Time-To-First-Light, lexique UI (Perform = langage débutant). La Definition of Done globale y est définie.

> `02-AUDIT-GLOBAL.md` contient la cartographie complète du logiciel (Creator, backend, persistance) et les problèmes structurels transversaux. Lecture utile mais NON requise pour exécuter un chantier — les amendements qui en découlent sont déjà intégrés dans C5 (groupes adossés à `/api/fixture-groups`) et C6 (positions canoniques = `gridPosition`). Les chantiers futurs C8-C12 (unification fixture, fiabilité sorties DMX, sécurité API, qualité CI, offline) y sont listés.

## Règles d'or (s'appliquent à TOUS les chantiers)

1. **Strangler, pas big-bang** : `SmartDashboard.tsx` fait 3426 lignes. Chaque chantier extrait UNIQUEMENT les render functions de son périmètre vers `apps/web/src/components/smart/`. Interdiction de réorganiser/reformater le reste du fichier.
2. **Hors scope = interdit** : la section 8 de chaque chantier liste ce qu'il ne faut PAS toucher. La respecter strictement.
3. **Ne pas casser le moteur DMX** : ne jamais modifier `lib/dmxEngine.ts` (priorités, boucle 44Hz, locks) sauf si un chantier le demande explicitement.
4. **Migrations obligatoires** : tout changement de modèle persisté (localStorage `glow-logic-storage`, projets `/api/projects`) doit fournir des valeurs par défaut au chargement pour les anciens états. Voir `01-CONVENTIONS.md §5`.
5. **Conventions de nommage MIDI** : les clés `midiMappings` suivent `01-CONVENTIONS.md §3`. Ne jamais inventer un autre format.
6. **Dark mode + langue FR** : tous les labels UI sont en français ; respecter le thème (`01-CONVENTIONS.md §6`).
7. **Pas de nouvelle dépendance npm** sans mention explicite dans le chantier.
8. **`prefers-reduced-motion`** : toute animation (pulse BPM, glow) doit être désactivée si ce media query est actif.
9. **Critères d'acceptation** : un chantier est terminé quand tous ses AC passent + `npm run build` (dans `apps/web`) passe sans erreur TypeScript.

## Glossaire

| Terme | Définition |
|-------|------------|
| **Vue SMART** | Mode régie simplifié (`appMode === 'smart'`), page `apps/web/src/app/smart/page.tsx` |
| **Vue CREATOR** | Mode pro (`appMode === 'creator'`) avec proViews canvas/patch/visualizer — hors scope de toutes ces specs sauf mention |
| **Plan de Scène** | Widget `stagePlan` du SmartDashboard (plan de feu 2D interactif) |
| **Pad** | Bouton scène (`SmartPad` dans `smartModeSlice.ts`) déclenchant des valeurs DMX |
| **Groupe** | Groupe de fixtures avec niveau/mute/couleur (`groupLevels` dans `showPlayerSlice.ts`) |
| **Inspecteur** | Panneau de contrôle contextuel d'une fixture (XY pad, couleur, gobos…) |
| **MacroTimeline** | Séquenceur en bas d'écran (`MacroTimeline.tsx`) : clips, markers, pistes d'automation |
| **Keyframe** | Point `{timeMs, value}` d'une `AutomationTrack`, interpolé à la lecture |
| **MIDI Learn** | Mode d'apprentissage : cliquer un contrôle puis bouger un contrôleur physique pour les lier |
| **Output gate** | Interrupteurs de sortie du dmxEngine (QLC-OSC/WS, ArtNet, USB-DMX) |

## Comment utiliser ces specs (instructions pour l'agent codeur)

1. Lis l'en-tête du chantier : `Fichiers à charger en contexte` = la liste exacte des fichiers source à lire avant de coder.
2. Implémente les items S1, S2… dans l'ordre. Chaque S est de la forme « QUAND… ALORS… » et est testable individuellement.
3. Vérifie chaque AC (section 7) avant de considérer le chantier terminé.
4. Si un numéro de ligne cité a dérivé (le code a bougé), recherche l'ancre textuelle citée à côté (ex. `"Live Status"`, `renderPadsGrid`).
5. Ne pose pas de question si la spec couvre le cas ; si un cas n'est pas couvert, choisis l'option la plus simple ET note-la dans le message de commit.

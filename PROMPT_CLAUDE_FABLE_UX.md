# 🎨 Prompt Claude Fable (Anthropic) — Analyse UX/UI & Ergonomie Glow Logic

> **Objectif :** Utiliser la puissance analytique de Claude Fable pour produire un **plan d'amélioration UX/UI détaillé** sans écrire de code. Le codage sera délégué à d'autres agents (Codex, etc.) pour optimiser les coûts tokens.
> **Date :** Juin 2026
> **Projet :** Glow Logic v2 — Régie multimédia temps réel

---

## 1. Contexte du projet

**Glow Logic** est une régie multimédia temps réel unifiée pour le contrôle scénique (DMX/LED, vidéo-mapping, lasers, drones, pyrotechnie). Interface web Next.js 16 + React 19 + Zustand + Tailwind CSS v4.

**Architecture frontend :**
- `apps/web/src/components/SmartDashboard.tsx` — Console régie principale (145 ko)
- `apps/web/src/components/MacroTimeline.tsx` — Séquenceur linéaire (70 ko)
- `apps/web/src/components/PatchPanel.tsx` — Plan de feu 2D (119 ko)
- `apps/web/src/components/TopBar.tsx` — Barre supérieure (727 lignes)
- `apps/web/src/components/VisualizerView.tsx` — Visualiseur 3D Three.js
- `apps/web/src/components/three/SafetySimulationLayer.tsx` — Simulation laser/drone/pyro (468 lignes)
- `apps/web/src/components/ui/ProceduralVjCanvas.tsx` — Shaders WebGL VJ Deck (419 lignes)

**Store Zustand :**
- 8 slices : `ui`, `midi`, `smartMode`, `reactFlow`, `project`, `timeline`, `toast`, `showPlayer`
- Persist localStorage avec `partialize`

**Score actuel :** ~95% conformité avec le cahier des charges MVP. Le projet est fonctionnel mais l'**ergonomie et l'expérience utilisateur** méritent une passe professionnelle.

---

## 2. Ta mission (Claude Fable)

Tu es un **senior UX/UI designer + product strategist**. Tu ne dois **PAS** écrire de code. Tu dois produire un **document de spécification UX** que des agents codeurs pourront implémenter.

### 2.1 Livrables attendus

1. **Audit UX complet** — Analyse de chaque écran/composant avec problèmes identifiés
2. **Propositions d'amélioration** — Solutions concrètes avec justification (pourquoi ça améliore l'UX)
3. **Plan d'action priorisé** — Ordre d'implémentation avec fichiers concernés
4. **Spécifications détaillées** — Comportements, animations, états, responsive
5. **Wireframes textuels** — Description structurée de la nouvelle disposition (pas d'image, du texte précis)

### 2.2 Contraintes

- **Ne pas proposer de changer le stack technique** (reste Next.js 16 + React 19 + Tailwind v4 + Zustand)
- **Ne pas proposer de nouvelles dépendances** sauf justification absolue
- **Respecter le dark mode** actuel (thème noir/cyan/purple)
- **Garder la logique métier** (Safety Gate, DMX 44Hz, priority locks)
- **Penser mobile/tablette** — L'app doit rester utilisable sur tablette tactile (iPad Pro 12.9")
- **Penser performance** — Pas de propositions qui dégradent le bundle ou le FPS

---

## 3. Analyse de la capture d'écran fournie

Voici les observations préliminaires de l'agent d'analyse sur la capture d'écran de l'interface actuelle (SmartDashboard mode) :

### Zone 1 — Panneau latéral gauche (haut)
- **Onglets** : "Contrôles", "IA", "Automations" — 3 onglets sous-utilisés
- **Section "CAPTURE SCENES"** : Bloc de texte informatif très grand (5-6 lignes) qui explique que les scènes sont dans la MacroTimeline. Ce texte est un **placeholder de onboarding** qui devrait être temporaire, pas permanent.
- **Problème** : Ce panneau prend ~25% de la largeur d'écran pour afficher principalement du texte statique. L'espace est précieux sur un écran de régie.

### Zone 2 — Panneau latéral gauche (bas) — "Live Status"
- **BACKEND CONNECTED** — Indicateur utile mais très verbeux
- **BPM 128.0** — Information clé, bien placée
- **SCÈNES 6 / SCENE ACTIVE -** — Utile mais pourrait être plus compact
- **Boutons** : "Diagnostic IA du DMX", "Preflight show", "Recovery show" — 3 boutons empilés verticalement, prennent beaucoup de hauteur
- **Problème** : Ce panneau mélange des **infos temps réel** (BPM, scène active) avec des **actions** (diagnostic, preflight, recovery). La hiérarchie visuelle n'est pas claire.

### Zone centrale — "SMART DASHBOARD"
- **"GROUPES DMX (6 CH)"** — Titre avec toggle collapse
- **"MASTER DINNER — Scale global DMX"** — Slider horizontal cyan, très visible
- **6 faders verticaux** : Face, Douche 1, Douche 2, Douche 3, Latéral, Centre — Chacun avec un bouton "MUTE" vert en dessous
- **Problème** : Les faders sont très espacés horizontalement. Sur un écran 16:9, il y a beaucoup d'espace vide entre eux. Les boutons MUTE sont très larges par rapport à leur utilité.
- **Problème** : Le slider "MASTER DINNER" a un nom confus ("DINNER" ? Devrait être "DIMMER" ou "MASTER")

### Top Bar
- **Trop d'éléments** : GLOW | SMART | CREATOR | BPM 128.0 | SYNC | BLACKOUT | CANVAS | FIXTURES | 3D | Horloge | DMX | LASER | PYRO | OFFLINE READY | 5+ icônes
- **Problème** : La top bar est surchargée. Certains éléments pourraient être regroupés dans des menus déroulants ou déplacés.
- **Problème** : "CANVAS", "FIXTURES", "3D" sont des vues du mode CREATOR mais apparaissent aussi en mode SMART.

### Global
- **Notification Windows** "Activer Windows" — Gêne l'interface (mais c'est hors scope, c'est l'OS)
- **"LIVE (RÉDUIT)"** — Bouton en bas à droite, fonction non claire
- **Manque d'indicateurs visuels** de l'état du show (enregistrement, modifications non sauvegardées)

---

## 3.1. Idées spécifiques du product owner (à intégrer dans l'analyse)

Le product owner a identifié 3 axes d'amélioration majeurs après usage réel de l'interface :

### A. Remplacer "CAPTURE SCENES" et "Automations" dans la sidebar
**Constat** : Le bloc "CAPTURE SCENES" (5-6 lignes de texte expliquant que les scènes sont dans la MacroTimeline) et l'onglet "Automations" sont **redondants** car ces fonctionnalités existent déjà dans la **MacroTimeline** (en bas d'écran) avec une ergonomie dédiée.

**Demande** : Supprimer/remplacer cette section par quelque chose d'**indispensable en mode live** :
- Un **mini-playlist** des scènes récentes (last 5 played)
- Un **quick-access** aux looks favoris
- Un **panel de monitoring** DMX (valeurs temps réel des univers)
- Un **panel de contrôle rapide** (blackout, full-on, freeze, tap tempo)

### B. Déplacer "Live Status" et libérer toute la sidebar gauche
**Constat** : Le panneau "Live Status" (Backend, BPM, Scènes, Scène Active, Diagnostic, Preflight, Recovery) prend la **moitié inférieure de la sidebar** (~15% de la largeur totale de l'écran) pour afficher des infos qui pourraient être **beaucoup plus compactes**.

**Demande** :
1. **Déplacer** les infos temps réel (Backend, BPM, Scène Active) dans la **TopBar** sous forme d'indicateurs compacts (icône + valeur, pas de label)
2. **Déplacer** les boutons d'action (Diagnostic, Preflight, Recovery) dans un **menu "Outils"** accessible via un bouton 🔧 dans la TopBar ou un raccourci clavier
3. **Libérer ainsi toute la sidebar gauche** (~25% de la largeur) pour y mettre un **contrôleur de scènes unifié** (voir point C)

### C. Fusionner / remplacer "Pads de Scènes" + "APC Mini Virtuel"
**Constat actuel** : Il y a **2 widgets séparés** pour le même usage (déclencher des scènes) :
- **"PAD DE SCÈNES"** : Grille visuelle de 6 pads colorés avec icônes, noms, état ACTIVE, bouton "New Scene". Très beau, très visuel, mais limité à 6 pads visibles.
- **"APC MINI VIRTUEL"** : Grille 8×8 de boutons carrés gris avec numéros MIDI (0-63). Très technique, peu lisible, pas de couleur, pas d'icône.

**Demande** : Créer un **contrôleur de scènes unifié** qui remplace les deux :
- **Grille hybride** : Combiner l'esthétique des pads colorés (icônes, couleurs, noms) avec la densité de l'APC Mini (8×8 = 64 slots)
- **2 modes d'affichage** :
  - **Mode "Visuel"** (défaut) : Grille 4×4 ou 4×8 avec les pads colorés comme actuellement, mais plus dense
  - **Mode "MIDI"** (toggle) : Grille 8×8 compacte, style APC Mini, mais avec les couleurs des pads et les numéros MIDI
- **Drag & drop** pour réorganiser les pads
- **Right-click** pour éditer (couleur, icône, nom, note MIDI, DMX values)
- **Bank/Pages** : 4 pages de 16 pads = 64 scènes total (comme l'APC Mini), avec des tabs en haut (Page 1, 2, 3, 4)
- **Feedback visuel** : Quand un pad est actif, il pulse au BPM. Quand il est mappé à une note MIDI, un petit indicateur 🎹 apparaît.
- **Placement** : Ce contrôleur unifié occuperait la **sidebar gauche entière** (libérée par le déplacement de Live Status), en hauteur complète, avec scroll si besoin.

**Wireframe conceptuel du contrôleur unifié (sidebar gauche) :**
```
┌─────────────────────────────┐
│  🎛 SCÈNES LIVE      [Visuel│MIDI]  │  ← Toggle mode d'affichage
├─────────────────────────────┤
│ [P1] [P2] [P3] [P4] [+]     │  ← 4 pages + ajouter page
├─────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │ 💧 │ │ 🔥 │ │ ⚡ │ │ 💓 │ │  ← Pads colorés (mode Visuel)
│ │Blue│ │Red │ │Neon│ │Bass│ │
│ │ 🎹 │ │    │ │ 🎹 │ │    │ │  ← Indicateur MIDI mapping
│ └────┘ └────┘ └────┘ └────┘ │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │ ✨ │ │ 🌊 │ │ ➕ │ │    │ │
│ │Safe│ │Rset│ │New │ │    │ │
│ └────┘ └────┘ └────┘ └────┘ │
├─────────────────────────────┤
│ 🎹 MIDI Learn: OFF  [Activer]│  ← Section mapping MIDI
├─────────────────────────────┤
│ 🎵 Assistant: [Mariage ▼]   │  ← Quick template selector
│ [Générer grille]            │
└─────────────────────────────┘
```

---

## 4. Questions stratégiques à analyser

Claude Fable doit répondre à ces questions dans son analyse, **en priorisant les 3 axes du product owner** (Section 3.1) :

### A. Sidebar gauche — Réorganisation complète (PRIORITÉ MAXIMALE)
1. **"CAPTURE SCENES" et "Automations"** sont redondants avec la MacroTimeline. Que mettre à la place dans la sidebar haut ? (mini-playlist, monitoring DMX, quick-access looks, contrôles rapides)
2. **"Live Status"** doit être déplacé pour libérer toute la sidebar. Où le mettre ? (TopBar compacte, menu "Outils", overlay flottant)
3. **Sidebar libérée** (~25% largeur) : quel usage en faire ? (contrôleur de scènes unifié, mixeur étendu, visualiseur mini)
4. Faut-il un **mode "Live Performance"** qui masque tout sauf les contrôles essentiels (faders, pads, BPM) ?

### B. Contrôleur de scènes unifié — Fusion Pads + APC Mini (PRIORITÉ MAXIMALE)
5. Comment fusionner l'esthétique des **Pads de Scènes** (colorés, icônes, noms) avec la densité de l'**APC Mini** (8×8, 64 slots) ?
6. Quel mode d'affichage par défaut ? Grille 4×4 visuelle ou 8×8 compacte ? Comment toggler ?
7. Comment gérer les **pages/banks** (4 pages × 16 pads = 64 scènes) avec navigation claire ?
8. Quel **feedback visuel** au BPM pour les pads actifs ? (pulse, glow, border)
9. Comment intégrer le **MIDI Learn** dans ce contrôleur unifié sans surcharger l'UI ?
10. Le **"Assistant Débutant"** (templates Mariage/Club/Live) devrait-il générer directement une page de pads pré-remplie ?

### C. Layout & Spatial Design
11. Les 6 faders DMX devraient-ils être **plus compacts** (largeur réduite) pour laisser de la place au contrôleur de scènes ?
12. Le "Plan de Scène Interactif" est-il utile en mode SMART ou devrait-il être réservé au mode CREATOR ?
13. Faut-il un **grid layout personnalisable** (drag & drop des widgets) à la place du layout fixe actuel ?
14. La timeline devrait-elle être **toujours visible** en bas ou **toggleable** avec un raccourci clavier ?

### D. Visual Design & Feedback
15. Les boutons "MUTE" sont-ils trop discrets ? Devraient-ils avoir un état "SOLO" aussi ?
16. Faut-il des **indicateurs de niveau VU-mètre** sur les faders (animation vert-jaune-rouge) ?
17. Le changement de BPM devrait-il avoir un **feedback visuel** (pulse, glow) ?
18. Les pads de scènes devraient-ils avoir des **miniatures visuelles** (aperçu de la couleur/effet) ?

### E. Interaction & Workflow
19. Le workflow "Créer un show de zéro" est-il clair pour un débutant ? Quelles sont les étapes manquantes ?
20. Faut-il un **"Quick Start Wizard"** qui s'ouvre au premier lancement (sélection du type d'événement : mariage, club, concert) ?
21. Le "Diagnostic IA du DMX" est-il bien placé ? Devrait-il être dans un menu "Outils" ?
22. Faut-il un **bouton d'urgence "PANIC"** (blackout immédiat, gros bouton rouge) toujours visible ?

### G. Module "Groupes DMX" — Extensibilité & Interopérabilité
26. **Extensibilité des canaux** : Le module est actuellement figé à 6 canaux (Face, Douche 1-3, Latéral, Centre). Comment permettre à l'utilisateur d'**ajouter, supprimer, renommer et réorganiser** des canaux/groupes DMX dynamiquement ? Faut-il une limite max ? Quel UI pour la gestion (modal, inline edit, drag & drop) ?
27. **Mappage MIDI des faders** : Chaque fader de groupe devrait être **mappable à un contrôleur MIDI physique** (fader, knob). Comment intégrer le MIDI Learn directement sur chaque fader (bouton "MIDI" à côté de MUTE ?) sans surcharger l'UI ? Comment afficher visuellement qu'un fader est mappé (note MIDI, nom du contrôleur) ?
28. **Synchronisation inter-modules** : Quand un fader de groupe change, cela doit affecter les **pads de scènes**, le **visualiseur 3D**, et la **timeline**. Comment rendre cette synchronisation visible et prévisible pour l'utilisateur ? Faut-il un **indicateur de "link"** entre les modules ? Quand un pad est activé, le fader du groupe concerné devrait-il refléter la valeur en temps réel ?
29. **VU-mètres et monitoring** : Les faders devraient-ils avoir des **indicateurs de niveau** (barre vert-jaune-rouge) qui reflètent l'activité DMX réelle ? Cela aiderait à visualiser quels groupes sont actifs dans le show.
30. **Gestion des presets de groupes** : Faut-il permettre de sauvegarder/charger des **configurations de groupes** (ex: "Config Mariage" = 4 groupes, "Config Club" = 8 groupes + strobe) comme des presets ?

### H. Plan de Scène Interactif & Visualiseur 3D — Édition, Sync, Preview (PRIORITÉ HAUTE)

**Contexte (Captures 6, 7, 8) :**
- **Capture 6** : Le "Plan de Scène Interactif" 2D affiche les fixtures positionnées (LY1-4, DCH 1-3, LAT1-2, FC1-4) avec un panneau latéral "CONTRE" pour ajuster l'intensité et la couleur du groupe sélectionné.
- **Capture 7** : Vue "2D Stage Plan" simplifiée avec toggle 2D/3D.
- **Capture 8** : "3D Live Visualizer" avec représentation des faisceaux lumineux en temps réel.

**Le product owner souhaite que ces modules deviennent des outils de création et de prévisualisation complets, pas seulement des visualiseurs passifs.**

31. **Édition du plan de scène** : Le plan 2D doit être **modifiable** (drag & drop des fixtures, ajout/suppression, redimensionnement de la scène). Comment rendre l'édition intuitive sans risquer de déplacer accidentellement une fixture en mode live ? Faut-il un **mode "Édition" / "Live"** toggle ?

32. **Synchronisation Plan 2D ↔ Groupes DMX ↔ Pads** : Quand on clique sur un fixture dans le plan 2D, le **groupe DMX** correspondant devrait être sélectionné et ses faders mis en évidence. Inversement, quand on bouge un fader, le fixture dans le plan devrait refléter visuellement le changement (intensité = opacité du halo, couleur = couleur du halo). Comment rendre cette sync visible sans être trop distrayante ?

33. **Mappage MIDI du plan de scène** : Peut-on **mapper des zones du plan** à des notes MIDI ? Par exemple : note 60 = "zone gauche", note 61 = "zone centre", note 62 = "zone droite". Ou mapper le **pan/tilt** d'une lyre sélectionnée à un joystick MIDI ? Quel UI pour configurer ça ?

34. **REC et Automation sur le plan** : Le plan de scène devrait être **enregistrable** (REC) : capturer les mouvements de fixtures (pan/tilt), les changements de couleur, les déplacements dans le plan, comme des **keyframes** dans la timeline. Comment intégrer un bouton REC dans l'interface du plan ? Les mouvements de drag & drop deviennent-ils des keyframes de position ?

35. **Visualiseur 3D ↔ Timeline (Preview Mode)** : Le product owner veut un **mode "Preview"** où le visualiseur 3D joue la timeline **sans émettre de signal DMX physique**. Cela permettrait de **voir le résultat complet du spectacle avant de le mettre en live**. Comment basculer entre "Preview" (simulation 3D uniquement) et "Live" (DMX physique actif) ? Faut-il un grand toggle **PREVIEW / LIVE** visible dans le visualiseur 3D ?

36. **Sync Timeline ↔ 3D Visualizer** : Quand la timeline joue, le visualiseur 3D doit refléter **en temps réel** : faisceaux qui bougent (pan/tilt), couleurs qui changent, strobe qui pulse, lasers qui s'activent. Comment garantir que le visualiseur 3D reste **synchronisé au frame près** avec la timeline sans perdre de performance ? Faut-il un **buffer de prévisualisation** ?

37. **Plan 2D ↔ Visualiseur 3D** : Les positions des fixtures dans le plan 2D doivent être **transposées automatiquement** dans l'espace 3D (x, y, z). Quand on déplace une fixture dans le plan 2D, elle doit bouger dans le visualiseur 3D. Inversement, une vue "top-down" dans le visualiseur 3D pourrait éditer la position. Comment gérer la **cohérence des coordonnées** entre les deux vues ?

38. **Automation de trajectoires** : Pour les lyres (moving heads), peut-on **dessiner une trajectoire** dans le plan 2D (ligne, cercle, figure-8) qui sera convertie en **automation pan/tilt** dans la timeline ? L'utilisateur dessinerait un path, et le système générerait les keyframes automatiquement.

---

## 5. Format de sortie attendu

Claude Fable doit produire un document structuré en Markdown :

```markdown
# 📐 Spécification UX/UI — Glow Logic v2.1

## 1. Audit UX (Problèmes identifiés)

### 1.1 Sidebar gauche — Problèmes critiques
| Problème | Sévérité | Impact | Preuve (ligne/fichier) |
|----------|----------|--------|------------------------|
| "CAPTURE SCENES" texte statique redondant avec MacroTimeline | Haute | Perte de 25% largeur | SmartDashboard.tsx ~ligne X |
| "Automations" onglet inutile (déjà dans timeline) | Haute | Confusion utilisateur | SmartDashboard.tsx ~ligne X |
| "Live Status" trop verbeux, mélange infos + actions | Haute | Hiérarchie confuse | SmartDashboard.tsx ~ligne X |
| Pads de scènes (6) et APC Mini (64) séparés | Haute | 2 widgets pour même usage | smartModeSlice.ts |
| ... | ... | ... | ... |

### 1.2 Top Bar
...

### 1.3 Faders DMX
...

## 2. Propositions d'amélioration (priorisées)

### 2.1 Sidebar — Réorganisation complète (P0)
**Concept :** Supprimer "CAPTURE SCENES" et "Automations". Déplacer "Live Status" dans la TopBar. Utiliser toute la sidebar pour le **contrôleur de scènes unifié**.

**Spécification comportementale :**
- Suppression du bloc "CAPTURE SCENES" (texte statique)
- Suppression de l'onglet "Automations" (redondant avec timeline)
- Déplacement de "Live Status" :
  - Backend status → dot vert/rouge dans TopBar (à côté de l'horloge)
  - BPM → déjà dans TopBar, garder
  - Scène active → badge compact dans TopBar
  - Boutons Diagnostic/Preflight/Recovery → menu "Outils" (🔧) dans TopBar
- La sidebar devient un **drawer dédié au contrôleur de scènes**

**Fichiers à modifier :**
- `apps/web/src/components/SmartDashboard.tsx` — Refactor layout sidebar
- `apps/web/src/components/TopBar.tsx` — Ajouter indicateurs compacts + menu Outils
- `apps/web/src/store/slices/uiSlice.ts` — Ajouter `showSceneController: boolean`

**Wireframe textuel — Nouvelle sidebar (contrôleur de scènes unifié) :**
```
[Sidebar gauche — 280px fixe, hauteur 100vh]
┌─────────────────────────────┐
│ 🎛 SCÈNES LIVE      [Visuel│MIDI]  │  ← Header + toggle mode
├─────────────────────────────┤
│ [P1] [P2] [P3] [P4] [+]     │  ← 4 pages + ajouter page
├─────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │ 💧 │ │ 🔥 │ │ ⚡ │ │ 💓 │ │  ← Pads colorés (mode Visuel)
│ │Blue│ │Red │ │Neon│ │Bass│ │
│ │ 🎹 │ │    │ │ 🎹 │ │    │ │  ← Indicateur MIDI mapping
│ └────┘ └────┘ └────┘ └────┘ │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │ ✨ │ │ 🌊 │ │ ➕ │ │    │ │
│ │Safe│ │Rset│ │New │ │    │ │
│ └────┘ └────┘ └────┘ └────┘ │
├─────────────────────────────┤
│ 🎹 MIDI Learn: OFF  [Activer]│  ← Section mapping MIDI
├─────────────────────────────┤
│ 🎵 Assistant: [Mariage ▼]   │  ← Quick template selector
│ [Générer grille]            │
└─────────────────────────────┘
```

### 2.2 Contrôleur de scènes unifié — Fusion Pads + APC Mini (P0)
**Concept :** Un seul widget qui remplace "PAD DE SCÈNES" et "APC MINI VIRTUEL".

**Spécification comportementale :**
- **2 modes d'affichage** (toggle dans le header) :
  - **Mode "Visuel"** (défaut) : Grille 4×4, pads colorés 80×80px, icône 24px, nom en dessous, indicateur MIDI 🎹 en coin
  - **Mode "MIDI"** : Grille 8×8, pads compacts 32×32px, couleur de fond du pad, numéro MIDI en petit
- **4 pages** (P1-P4) de 16 pads chacune = 64 scènes max
- **Navigation pages** : Tabs en haut, click pour switch, swipe horizontal sur mobile
- **Drag & drop** : Réorganiser les pads dans la grille (même page)
- **Right-click** : Menu contextuel (éditer, dupliquer, supprimer, assigner MIDI)
- **États visuels** :
  - Inactif : opacité 0.7, border subtle
  - Actif : opacité 1, border cyan glow, pulse au BPM
  - Mappé MIDI : petit icône 🎹 en haut à droite
  - En édition : border dashed amber
- **Assistant intégré** : Dropdown en bas "Type d'événement" (Mariage, Club, Live) + bouton "Générer" qui remplit la page courante avec des looks pré-configurés

**Fichiers à modifier :**
- `apps/web/src/components/SmartDashboard.tsx` — Supprimer les widgets "pads" et "apcVirtual" séparés
- `apps/web/src/components/ui/SceneController.tsx` — **NOUVEAU** composant unifié
- `apps/web/src/store/slices/smartModeSlice.ts` — Refactor `smartPads` pour supporter 64 pads + pages
- `apps/web/src/store/slices/midiSlice.ts` — Lier les mappings MIDI aux pads

**Wireframe textuel — Mode "Visuel" (4×4) :**
```
┌─────────────────────────────┐
│ 🎛 SCÈNES LIVE      [Visuel│MIDI]  │
├─────────────────────────────┤
│ [P1●] [P2] [P3] [P4] [➕]   │  ← Page 1 active (dot), + pour nouvelle page
├─────────────────────────────┤
│ ┌────────┐ ┌────────┐       │
│ │   💧   │ │   🔥   │       │
│ │ Warmup │ │ Build  │       │
│ │  🎹56  │ │        │       │  ← Note MIDI mappée
│ │▓▓▓▓▓▓▓▓│ │░░░░░░░░│       │  ← Intensité visuelle (barre en bas)
│ └────────┘ └────────┘       │
│ ┌────────┐ ┌────────┐       │
│ │   ⚡   │ │   💓   │       │
│ │ Drop   │ │ Bass   │       │
│ │  🎹58  │ │  ACTIVE│ ← Pulse cyan
│ │▓▓▓▓▓▓▓▓│ │████████│       │
│ └────────┘ └────────┘       │
│ ... (4×4 total)             │
├─────────────────────────────┤
│ 🎹 MIDI Learn [OFF ▼]       │
│ 🎵 Assistant [Club/DJ ▼]    │
│ [✨ Générer looks]          │
└─────────────────────────────┘
```

**Wireframe textuel — Mode "MIDI" (8×8 compact) :**
```
┌─────────────────────────────┐
│ 🎛 SCÈNES LIVE      [Visuel│MIDI●] │
├─────────────────────────────┤
│ [P1●] [P2] [P3] [P4]       │
├─────────────────────────────┤
│ ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐   │
│ │0││1││2││3││4││5││6││7│   │  ← Row 1 (notes 0-7)
│ │▓││░││▓││░││▓││░││▓││░│   │  ← Couleur du pad
│ └─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘   │
│ ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐   │
│ │8││9││10││11││12││13││14││15│ │  ← Row 2
│ ... (8 rows)                │
│ └─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘   │
├─────────────────────────────┤
│ 🎹 MIDI Learn [ON ▼]        │
│ Cliquez un pad, puis une     │
│ touche de votre contrôleur   │
└─────────────────────────────┘
```

### 2.3 TopBar — Regroupement intelligent (P0)
**Concept :** Compacter les infos, déplacer les actions dans un menu "Outils".

**Spécification comportementale :**
- **Gauche** : Logo GLOW (compact) | Mode [SMART|CREATOR] (toggle switch)
- **Centre** : 🟢 (backend) | BPM 128.0 | ⏱ (tap) | SYNC | 🚨 BLACKOUT | Scène 3/6 (badge)
- **Droite** : 🔧 Outils (dropdown: Diagnostic, Preflight, Recovery, Settings) | 🔔 | 👤 | OFFLINE READY
- **Masquer** : CANVAS, FIXTURES, 3D en mode SMART (réservé CREATOR)

**Fichiers à modifier :**
- `apps/web/src/components/TopBar.tsx` — Refactor complet

### 2.4 Faders DMX — Compact + VU-mètres (P1)
...

## 3. Plan d'action priorisé

| Priorité | Titre | Fichiers | Complexité | Estimation |
|----------|-------|----------|------------|------------|
| 🔴 P0 | Sidebar réorganisée (supprimer CAPTURE SCENES/Automations, déplacer Live Status) | SmartDashboard.tsx, TopBar.tsx, uiSlice.ts | Moyenne | 2h |
| 🔴 P0 | Contrôleur de scènes unifié (fusion Pads + APC Mini) | SceneController.tsx (nouveau), smartModeSlice.ts, midiSlice.ts | Élevée | 4h |
| 🔴 P0 | TopBar regroupée (indicateurs compacts + menu Outils) | TopBar.tsx | Moyenne | 1.5h |
| 🟡 P1 | VU-mètres sur faders | SmartDashboard.tsx | Moyenne | 1.5h |
| 🟡 P1 | Mode Live Performance | useStore.ts, SmartDashboard.tsx | Moyenne | 2h |
| 🟢 P2 | Quick Start Wizard | Nouveau fichier | Élevée | 3h |
| 🟢 P2 | Gestures tactiles | MacroTimeline.tsx, PatchPanel.tsx | Élevée | 4h |

## 4. Spécifications d'animation

### 4.1 Transitions de layout
- Sidebar toggle : `width` transition 200ms, `cubic-bezier(0.4, 0, 0.2, 1)`
- Page switch (P1→P2) : `opacity` fade 150ms + `translateX` slide 100ms
- Mode toggle (Visuel↔MIDI) : `grid-template-columns` transition 300ms

### 4.2 Micro-interactions
- Pad hover : `scale(1.03)`, shadow increase, 100ms
- Pad active : `ring-2 ring-cyan-400`, `box-shadow: 0 0 20px rgba(6,182,212,0.4)`, pulse au BPM
- Pad MIDI mapped : icône 🎹 apparition `scale(0→1)` 150ms bounce
- Mute button : toggle avec transition de couleur 100ms
- Blackout : flash rouge `#ef4444` sur toute l'interface pendant 200ms

### 4.3 BPM Pulse
- `@keyframes bpmPulse` : `opacity 1 → 0.7 → 1`
- Durée : `60 / BPM` secondes (ex: 128 BPM = 468ms)
- Appliqué aux : pads actifs, indicateur BPM dans TopBar, VU-mètres

## 5. Responsive breakpoints

| Breakpoint | Largeur | Adaptations |
|------------|---------|-------------|
| Desktop XL | ≥1920px | Sidebar 320px, 8 faders, 4×4 pads visuels |
| Desktop | 1280-1919px | Sidebar 280px, 6 faders, 4×4 pads visuels |
| Tablet L | 1024-1279px | Sidebar 240px, 4 faders + scroll, 3×3 pads |
| Tablet P | 768-1023px | Sidebar collapsible (icône), faders en grille 2×3, 2×4 pads |
| Mobile | <768px | Bottom sheet scènes, 3 faders max, mode simplifié |

## 6. Accessibilité (a11y)

- Tous les pads : `role="button"`, `aria-pressed` (true/false selon état actif)
- Faders : `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Pages : `role="tablist"`, `role="tab"`, `aria-selected`
- Drawer : `aria-expanded`, focus trap quand ouvert
- Contraste : minimum 4.5:1 pour le texte
- Réduction de mouvement : respecter `prefers-reduced-motion` (désactiver pulse BPM)
```

---

## 6. Règles pour Claude Fable

1. **Sois précis** — Donne des valeurs exactes (px, ms, couleurs hex) quand c'est pertinent
2. **Sois justifié** — Chaque proposition doit avoir une raison UX ("Parce que...")
3. **Sois réaliste** — Ne propose pas de refaire toute l'interface from scratch. Itère sur l'existant.
4. **Sois complet** — Pense à tous les états (hover, active, disabled, loading, error)
5. **Sois orienté action** — Chaque proposition doit être implémentable par un agent codeur
6. **Ne code pas** — Utilise des pseudo-code, des wireframes textuels, des descriptions. Pas de JSX/TSX.
7. **Pense au débutant** — L'app doit être utilisable par quelqu'un qui ne connaît pas le DMX
8. **Pense au pro** — L'app doit rester rapide et efficace pour un régisseur expérimenté
9. **Priorise les 4 axes du product owner** (Section 3.1 + H) : sidebar réorganisée, contrôleur de scènes unifié, TopBar compacts, Plan de Scène/Visualiseur 3D éditable et sync
10. **Référence les captures** — Quand tu analyses un problème, cite la capture d'écran correspondante (ex: "Capture 3 — PAD DE SCÈNES", "Capture 6 — Plan de Scène Interactif")

---

## 7. Contexte supplémentaire (pour référence)

### Thème de couleurs actuel
- Fond principal : `#0A0A0C` (presque noir)
- Fond secondaire : `#0c0e12`, `#12141A`, `#1a1c23`
- Accent primaire : Cyan `#06b6d4` / `#22d3ee`
- Accent secondaire : Purple `#a855f7` / `#8b5cf6`
- Danger : Red `#ef4444` / `#f43f5e`
- Warning : Amber `#f59e0b` / `#fbbf24`
- Success : Green `#22c55e`
- Texte principal : Blanc/blanc cassé
- Texte secondaire : Slate `#94a3b8` / `#64748b`

### Typographie
- Titres : `font-black`, `tracking-widest`, `uppercase`
- Labels : `text-[9px]` à `text-xs`
- Mono : `font-mono` pour les valeurs numériques (BPM, DMX values)

### Icônes
- Lucide React (`lucide-react`)
- Taille standard : `w-4 h-4` (16px) pour les boutons, `w-6 h-6` (24px) pour les icônes principales

---

**Claude Fable, analyse l'interface, réponds aux 19 questions, et produis la spécification UX/UI complète.**

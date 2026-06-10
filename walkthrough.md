# Documentation Globale de l'Intégration & Calibrations (MyStrow & Glow Logic)

Ce document rassemble l'ensemble des modules développés, des corrections de bugs, des calibrages physiques DMX et des synchronisations interactives réalisés pour fusionner les meilleures fonctionnalités de MyStrow dans Glow Logic.

---

## 🚀 1. Modules Fonctionnels Intégrés

### 💻 A. Assistant de Configuration DMX (Setup Wizard)
* **Backend de diagnostic réseau** : Création de [network.ts](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/server/services/network.ts) et des routes `/api/network/*` dans [index.ts](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/server/index.ts) pour lister les cartes réseau, configurer des adresses IP statiques (via UAC/netsh) et tester la connexion avec les interfaces USB FTDI.
* **Interface étape-par-étape** : Composant [DmxSetupWizard.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/ui/DmxSetupWizard.tsx) guidant l'utilisateur de la vérification des câbles à la détection de nœuds Art-Net (ArtPoll) et au diagnostic de port COM.

### 🗺️ B. Plan de Feu (2D Spatial Patch)
* **Espace de travail 2D** : Composant `PlanDeFeuCanvas` dans [PatchPanel.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/PatchPanel.tsx) permettant de placer visuellement des projecteurs sur une grille orthonormée.
* **Outils d'alignement** : Alignement horizontal, vertical et distribution équitable de l'espace en un clic pour organiser rapidement les projecteurs de scène.

### 📝 C. Constructeur de Profils & Lecteur IA de Manuels (Footprint Parser)
* **Éditeur visuel** : Permet de créer un nouveau projecteur dans [FixtureProfileBuilder.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/ui/FixtureProfileBuilder.tsx).
* **Analyse de texte par IA** : Un champ de texte intelligent permet de coller le tableau des canaux brut issu de n'importe quel manuel PDF. L'analyseur en extrait automatiquement les canaux, les types (dimmer, pan, tilt, gobo...) et génère le profil instantanément.

### 🎛️ D. Mappeur MIDI pour AKAI APC mini
* **Interface graphique dédiée** : Composant [ApcMiniMapper.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/ui/ApcMiniMapper.tsx) intégré dans l'onglet MIDI des paramètres.
* **Fonctions avancées** : Mappage des faders physiques, superposition d'effets, mode de bascule GO et potentiomètre de luminosité des LED de retour.

---

## 🔧 2. Calibrages Physiques DMX (Lyres 7R standard)

### 🎨 A. Alignement de la Roue de Couleurs
* Alignement des valeurs DMX envoyées par le tableau de bord ([index.ts](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/server/index.ts)) et interprétées en 3D ([useDmxFixture.ts](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/three/useDmxFixture.ts)) pour correspondre au disque physique de 14 couleurs :
  * `Rouge` ➜ DMX `15` | `Orange` ➜ DMX `25` | `Cyan` ➜ DMX `35` | `Vert` ➜ DMX `45` | `Jaune` ➜ DMX `75` | `Magenta` ➜ DMX `105` | `Bleu` ➜ DMX `125`.

### 🌀 B. Correction de la Répétition des Gobos
* Dans [GoboProjector.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/three/GoboProjector.tsx), passage de la texture de projection en mode `THREE.ClampToEdgeWrapping` (au lieu de `RepeatWrapping`).
* **Effet** : Supprime le bug de duplication qui affichait une mosaïque de petits cercles répétitifs à la place du faisceau "Cercle Uni" (Gobo Open).

### 💎 C. Fusion du Faisceau de Prisme (Overlap)
* Lorsque le Prisme est actif et que le Gobo est ouvert (cercle), les faisceaux projetés en 3D sont agrandis à `0.65` et rapprochés à `45px` d'écartement.
* **Effet** : Les 7 spots lumineux se chevauchent pour former un faisceau épais, brillant et facetté, identique au rendu d'une lentille de prisme réelle.

### 🔍 D. Simulation du Zoom en Temps Réel
* Liaison du canal DMX `zoom` au spotlight 3D et au maillage volumétrique de faisceau dans [MovingHeadFixture.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/three/fixtures/MovingHeadFixture.tsx). L'angle varie dynamiquement de `0.15` (faisceau étroit) à `1.2` (faisceau large).

---

## 🎚️ 3. Synchronisation 2D/3D & Fenêtre Flottante Modulaire

### 🔄 A. Synchronisation Bidirectionnelle
1. **2D ➜ 3D (Positionnement)** : Déplacer une fixture sur le Plan de feu (2D) met à jour immédiatement ses coordonnées spatiales (X et Z) dans la scène 3D.
2. **3D ➜ Dashboard (Sélection)** : Cliquer sur un projecteur ou une lyre dans la scène 3D le sélectionne automatiquement dans le store global de l'application et ouvre son panneau de commande à droite.
3. **Retour visuel** : Un anneau lumineux cyan s'affiche au sol en 3D sous l'appareil sélectionné.

### 🖥️ B. Fenêtre Flottante Multi-Vues Interactive
Le composant [MiniOverlay.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/three/MiniOverlay.tsx) permet désormais :
* **Double vue 3D / 2D commutable** : Boutons de sélection dans l'en-tête pour basculer instantanément entre le visualiseur 3D Three.js et le plan de scène 2D interactif.
* **Tiroir de contrôle compact (Slide-up)** : En mode 2D, cliquer sur un groupe de spots (Lyres, Face, Douches, Latéraux) ouvre un panneau de contrôle ultra-optimisé au bas de la fenêtre flottante (fader d'intensité, mute, sélecteur rapide de couleur et palette).
* **Drag & Drop** : Déplacement libre de la fenêtre par glissement de son en-tête.
* **Redimensionnement cyclique** : Commutation instantanée entre 3 tailles (Petite : 320x220px, Moyenne : 480x320px, Grande : 640x420px).
* **Minimisation** : Réduction en un bandeau compact (220x38px) avec gel des animations/3D pour économiser les ressources système.

---

## 🎛️ 4. Améliorations Majeures de la Vue Smart (SmartDashboard)

Le composant [SmartDashboard.tsx](file:///c:/Users/AMIN/Desktop/Project/Glow-logic/apps/web/src/components/SmartDashboard.tsx) a été entièrement réécrit pour devenir une console de régie modulaire, flexible et mappable :

1. **Intégration des 6 faders de groupes DMX** :
   - Ajout d'une console de mixage virtuelle pour piloter les 6 groupes principaux (`Face`, `Douche 1`, `Douche 2`, `Douche 3`, `Latéral`, `Contre`) directement synchronisée avec la vue Live et le store Zustand.
   - Intégration de color pickers natifs stylisés et de commutateurs Mute physiques/virtuels.
2. **Mode Édition dynamique** :
   - Ajout d'un interrupteur global "Mode Édition" pour configurer la grille de pads et masquer les widgets inutilisés pendant un show.
   - Sélecteur du nombre de colonnes de la grille de pads (de 2 à 8 colonnes) persistant dans Zustand (`smartPadColumns`).
3. **Réorganisation modulaire des widgets** :
   - Affichage dynamique et ordonné des widgets selon le store (`smartWidgets`). Les widgets peuvent être pliés, dépliés, déplacés vers le haut/bas ou masqués.
4. **Drag & Drop & Modal de personnalisation des Pads** :
   - Possibilité de glisser-déposer les pads de scènes pour réorganiser la grille.
   - Modal de configuration détaillée pour chaque pad : changement de nom, choix du thème de couleur (parmi les 8 palettes premium), choix de l'icône, mappage du canal et de la note MIDI (0-127), et option de suppression.
5. **Console APC mini virtuelle interactive** :
   - Représentation graphique 2D d'une grille 8x8 de boutons correspondant à l'Akai APC mini.
   - Affiche en surbrillance les scènes mappées et permet de leur associer rapidement des touches physiques d'un simple clic en mode édition.
6. **Spectrogramme audio & Mini-playlist de secours** :
   - Intégration du visualiseur de fréquences audio Sound-to-Light et d'un lecteur audio compact.

---

## 🎚️ 5. Refonte de l'Architecture Multi-Vues & Sidebars Fixes

Pour garantir une expérience utilisateur fluide et ergonomique où le régisseur peut manipuler les faders, la playlist et l'IA tout en visualisant le show, la structure des pages a été repensée :

1. **TopBar & Timeline Fixes** : La barre supérieure et la timeline de macro en bas de l'écran restent toujours montées et visibles.
2. **Sidebars de Contrôle Persistantes** :
   - En mode **Smart** : La barre latérale de contrôle DMX (Contrôles, IA, Automations) reste visible à gauche si activée.
   - En mode **Live** : La playlist et le show-player restent fixes et visibles à gauche.
   - En mode **Creator** : Le panneau de configuration et de presets reste monté à droite.
3. **Canvas Centraux Interchangeables** :
   - Basculer sur `FIXTURES` ou `3D` dans la TopBar ne change plus toute la page. Seule la zone centrale de travail ("canvas") est remplacée par la grille 2D de patch (`PatchPanel`) ou le simulateur 3D (`VisualizerView`).
   - L'overlay flottant `MiniOverlay` s'affiche automatiquement en bas à droite uniquement si la vue centrale active est `CANVAS` (pour éviter les doublons).
4. **Réorganisation de la Barre Smart** :
   - **Manuel & Capture** : Regroupement sous le même onglet des curseurs de réglage manuel (`FixtureController`) et du module de capture de scène (`SceneBuilder`).
   - **Automations Claires** : Ajout de sous-onglets horizontaux "Cue List" / "Chenillards" pour libérer de l'espace vertical.
   - **Live Status Fixe** : La fiche d'état de connexion et le diagnostic IA restent toujours ancrés en bas de la barre gauche.

---

## 🤖 Guide Technique pour Agent IA (Architecture & Sync)

Ce guide décrit de manière chirurgicale l'architecture du layout et de la synchronisation de l'application pour permettre à tout futur agent d'intervenir instantanément.

### 📁 Fichiers Clés et Rôles

1. **`src/app/page.tsx`** : Point d'entrée de l'application (Router principal).
   - *Rôle* : Structure le layout global de l'écran avec `<TopBar />` fixe, `<MacroTimeline />` fixe en bas, et sélectionne le mode d'affichage (`appMode === "smart" | "live" | "creator"`).
   - *Important* : Pour le mode `creator`, il gère l'échange de la zone de canvas gauche (`proView === "visualizer" | "patch" | "canvas"`) tout en gardant le panneau latéral droit monté en continu.
2. **`src/components/SmartDashboard.tsx`** : Dashboard du mode Smart.
   - *Rôle* : Gère le mixeur de groupes DMX, la grille de pads et les automations.
   - *Layout* : Contient la barre latérale gauche (soumise à `isSidebarVisible`) et la zone centrale interchangeable (soumise à `proView` : `VisualizerView` | `PatchPanel` | widgets).
3. **`src/components/LivePerformanceView.tsx`** : Régie spectacle VJ du mode Live.
   - *Rôle* : Gère le lecteur de playlist multimédia de régie, la console APC virtuelle et le plan de feu.
   - *Layout* : Playlist à gauche (soumise à `isSidebarVisible`), zone de droite interchangeable (soumise à `proView` : `VisualizerView` | `PatchPanel` | plan de feu + console).
4. **`src/components/TopBar.tsx`** : Barre supérieure de navigation globale.
   - *Rôle* : Contient les sélecteurs de mode (`appMode`) et de vue (`proView`).

### ⚙️ Variables d'État Zustand Clés (`useStore`)

Toutes ces variables proviennent de `src/store/useStore.ts` et sont synchronisées globalement :

- **`appMode`** (`"smart" | "live" | "creator"`) : Contrôle le composant de vue global actif.
- **`proView`** (`"canvas" | "patch" | "visualizer"`) : Contrôle le type de canvas affiché au centre de la zone de travail.
- **`isSidebarVisible`** (`boolean`) : Gère l'affichage ou le masquage des barres de commandes latérales gauches dans Smart et Live, et la barre de nœuds dans Creator.
- **`groupLevels` / `groupMutes` / `groupColors`** : Dictionnaire d'états DMX des 6 groupes principaux (`Face`, `Douche 1-3`, `Latéral`, `Contre`) partagés en temps réel.

### 🔄 Logique de Commutation (Surgical Snippet)

Dans **`SmartDashboard`** et **`LivePerformanceView`**, l'interchangeabilité est gérée en déviant le flux de rendu principal de la colonne de droite/centrale :

```tsx
// SmartDashboard.tsx (Colonne Centrale)
<div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
  {proView === "visualizer" ? (
    <VisualizerView />
  ) : proView === "patch" ? (
    <PatchPanel />
  ) : (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 pb-8 custom-scrollbar">
      {/* ... widgets standard ... */}
    </div>
  )}
</div>
```

Dans **`LivePerformanceView.tsx`** (Zone Droite) :

```tsx
<div className="flex-1 flex flex-col h-full bg-[#0a0c10] overflow-hidden">
  {proView === "visualizer" ? (
    <VisualizerView />
  ) : proView === "patch" ? (
    <PatchPanel />
  ) : (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar min-h-0">
      {/* ... plan de feu & console standard ... */}
    </div>
  )}
</div>
```

---

## 📸 Démo & Validation Visuelle (Captures d'Écran de Test)

Pour visualiser l'ergonomie et l'agencement exact des interfaces mises à jour, veuillez consulter les captures d'écran suivantes générées lors du test :

````carousel
![SMART Mode - Vue Standard Canvas](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/smart_mode_default_1780795865562.png)
<!-- slide -->
![SMART Mode - Vue 2D Stage Patch](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/smart_fixtures_active_1780795876453.png)
<!-- slide -->
![SMART Mode - Vue 3D Visualizer](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/smart_3d_active_1780795884381.png)
<!-- slide -->
![LIVE Mode - Vue Standard Canvas](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/live_canvas_active_1780795893091.png)
<!-- slide -->
![LIVE Mode - Vue 3D Visualizer](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/live_3d_active_1780795901088.png)
<!-- slide -->
![LIVE Mode - Vue 2D Stage Patch](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/live_fixtures_active_1780795913855.png)
<!-- slide -->
![CREATOR Mode - Vue Standard Canvas](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/creator_canvas_active_1780795923811.png)
<!-- slide -->
![CREATOR Mode - Vue 3D Visualizer](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/creator_3d_active_1780795934684.png)
<!-- slide -->
![CREATOR Mode - Vue 2D Stage Patch](file:///C:/Users/AMIN/.gemini/antigravity-ide/brain/dc54ae68-86e5-4b5b-a87b-7edc7d22b06d/creator_fixtures_active_1780795948522.png)
````

---

## 📊 Statut du Projet
* **Typecheck compilation** : Réussi avec 0 erreur (`npx tsc --noEmit` sur client + serveur).
* **Build de production Next.js** : Réussi avec succès (`next build`).
* **Serveurs actifs** : Serveur API sur port 3005, Serveur Web sur port 3000.

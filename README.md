# 🛸 Glow Logic — Régie Multimédia Temps Réel

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/bobprod/Glow-logic)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Commercial-red)](./LICENSE)

**Glow Logic** est une régie multimédia temps réel unifiée pour le contrôle scénique (DMX/LED, vidéo-mapping, lasers, drones, pyrotechnie) sous une interface unique réactive au rythme et assistée par IA.

---

## 🎯 Fonctionnalités

### 💡 Éclairage DMX (Phase 1 — Complet)
- **Contrôle universel** : Smart / Live / Creator modes
- **Moteur DMX 44Hz** : Sorties simultanées QLC+ OSC, Art-Net, USB DMX
- **Smooth DMX** : Interpolation avec 6 courbes d'easing (linear, easeIn, easeOut, easeInOut, sCurve, snap)
- **Patterns de mouvement** : Cercle, figure-8, sweep, rainbow, pulse, random, strobe
- **Color wheel 12ch beam** : 16 presets (blanc, rouge, orange, jaune, vert, cyan, bleu, mauve, magenta, UV, etc.)
- **Patch 2D** : Placement visuel des fixtures sur grille
- **Fixture profiles** : Import QLC+ (.qxf), GDTF, OCR de manuels PDF

### 🎛️ Interface Unifiée (Phase 2 — Complet)
- **SmartDashboard** : Console de régie principale avec pads, faders, mixeur
- **MacroTimeline** : Séquenceur linéaire (Ableton/CapCut style) avec clips, keyframes, automations
- **Visualizer 3D** : Three.js avec simulation laser, drone, pyro, gobo, zoom, prisme
- **APC mini virtuel** : Grille 8×8 mappable
- **Orchestrator IA** : LLM génère des scènes en français (ex: "Fais pulser les lumières en rouge sur les basses")

### 🎚️ VJ Deck & Shaders GPU (Phase 6 — Partiel)
- **Shaders WebGL** : Noise gradient, waves audio-reactif, strobe BPM
- **Projection vidéo** : Fenêtre flottante multi-vues (2D/3D)
- **Media Generator** : Proxy Higgsfield AI / Google Veo / Replicate

### 🛡️ Sécurité (Phase 5 — Complet)
- **Safety Gate** : Filtre déterministe pour commandes IA
- **Armement manuel** : laserArmed / pyroArmed avec LEDs dans la TopBar
- **Limites physiques** : Laser max 64/255, geofencing drones
- **Roles** : beginner / expert / admin

### 📦 Fondations Produit (Phase 9 — Complet)
- **Licence** : Service local avec activation
- **Projets** : Format `.glowproject` (export/import ZIP)
- **Bibliothèques** : System / User / Community (3 niveaux)
- **Mode Offline** : PWA + localStorage + SQLite
- **Crash Recovery** : Autosave + snapshot + restore
- **Diagnostics** : `/api/diagnose`, logs, support export

---

## Documentation avancee

- [Guide developpeur](docs/DEVELOPER_GUIDE.md)
- [Reference API](docs/API_REFERENCE.md)
- [Guide bridge DMX](DMX_BRIDGE_GUIDE.md)
- [Launcher Windows](LAUNCHER.md)

---

## 🚀 Installation

### Prérequis
- **Windows 10/11** (x64)
- **Node.js** ≥ 18.x
- **Git** (optionnel, pour cloner)
- **Python** ≥ 3.10 (pour le bridge DMX)
- **FTDI Driver** (pour dongle USB DMX comme UTD-10)

### Cloner le repo
```bash
git clone https://github.com/bobprod/Glow-logic.git
cd Glow-logic
```

### Installer les dépendances
```bash
npm install
```

### Configurer les raccourcis bureau (Windows)
```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\Create-DesktopShortcut.ps1
```

Cela crée 3 raccourcis :
- **Glow Logic** — Lance en arrière-plan (silencieux)
- **Glow Logic (Debug)** — Lance avec console visible
- **Glow Logic - Stop** — Arrête tous les services

---

## 🎮 Démarrage rapide

### Méthode 1 — Raccourci Bureau
Double-clique sur **Glow Logic.lnk** sur le Bureau.

### Méthode 2 — Commande
```bash
# Démarrer
npm run start

# Ou avec la console
.\launch-glow-logic.cmd
```

### Arrêter
```bash
# Méthode 1 — Raccourci Stop
Double-clique sur "Glow Logic - Stop.lnk"

# Méthode 2 — Commande
npm run stop

# Méthode 3 — Git Bash
.\scripts\stop-glow-logic.sh
```

### Accès
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:3005
- **Socket.IO** : ws://localhost:3005

---

## 🏗️ Architecture

```
Glow-logic/
├── apps/
│   ├── web/          # Next.js 16 (Frontend)
│   │   ├── src/
│   │   │   ├── app/              # Pages (/, /smart, /live, /timeline, /visualizer)
│   │   │   ├── components/     # React components
│   │   │   │   ├── SmartDashboard.tsx      # Console régie
│   │   │   │   ├── MacroTimeline.tsx       # Séquenceur
│   │   │   │   ├── VisualizerView.tsx      # 3D Three.js
│   │   │   │   ├── PatchPanel.tsx          # Plan de feu 2D
│   │   │   │   ├── FixtureController.tsx   # Contrôle per-fixture
│   │   │   │   ├── OrchestratorController.tsx  # IA LLM
│   │   │   │   ├── TopBar.tsx              # Barre supérieure
│   │   │   │   └── three/                  # Visualiseur 3D
│   │   │   │       ├── ThreeCanvas.tsx
│   │   │   │       ├── SafetySimulationLayer.tsx
│   │   │   │       └── fixtures/
│   │   │   ├── lib/              # Moteurs
│   │   │   │   ├── dmxEngine.ts          # DMX 44Hz
│   │   │   │   ├── DmxFader.ts         # Interpolation easing
│   │   │   │   ├── EffectEngine.ts     # Patterns mouvement
│   │   │   │   ├── socket.ts           # Socket.IO client
│   │   │   │   └── ShowAudioEngine.ts  # Analyse audio
│   │   │   ├── store/            # Zustand
│   │   │   │   ├── useStore.ts
│   │   │   │   └── slices/
│   │   │   │       ├── uiSlice.ts          # appMode, proView, sidebar
│   │   │   │       ├── smartModeSlice.ts   # pads, scenes, bpm
│   │   │   │       ├── safetySlice.ts      # laserArmed, pyroArmed
│   │   │   │       ├── timelineSlice.ts    # clips, keyframes
│   │   │   │       └── projectSlice.ts     # .glowproject
│   │   │   └── types/            # TypeScript
│   │   │       └── dmx.ts              # DmxChannel, FixtureProfile, etc.
│   │   └── public/           # PWA (manifest, icons, sw.js)
│   └── server/       # Express + Socket.IO
│       ├── index.ts              # API REST + Socket.IO
│       ├── services/             # Backend services
│       │   ├── dmxRouter.ts          # Routeur DMX
│       │   ├── safetyGate.ts         # Safety Gate déterministe
│       │   ├── database.ts           # SQLite
│       │   ├── network.ts            # Cartes réseau
│       │   ├── projectPackage.ts     # Export .glowproject
│       │   ├── anomalyDetector.ts    # Diagnostic
│       │   ├── license.ts            # Licence
│       │   ├── mediaGenerator.ts     # Proxy IA
│       │   └── qlcEngine.ts          # QLC+ integration
│       ├── dmx_bridge.py         # Bridge Python Windows
│       └── tests/                # Tests API
├── scripts/          # Scripts utilitaires
│   ├── Create-DesktopShortcut.ps1
│   ├── Launch-GlowLogic.ps1
│   ├── Stop-GlowLogic.ps1
│   └── stop-glow-logic.sh
├── memory/           # Logs de sessions
│   ├── 2026-06-04.md
│   ├── 2026-06-05.md
│   └── 2026-06-10.md
├── .env.local        # Config locale (non commitée)
├── .gitignore
├── package.json
└── README.md
```

---

## 🎛️ Guide utilisateur

### 1. Premier lancement

1. **Connecter le matériel DMX** :
   - Brancher le dongle FTDI (UTD-10) sur USB
   - Installer les drivers FTDI si nécessaire
   - Vérifier le port COM dans Windows (ex: COM5)

2. **Configurer la sortie DMX** :
   - Aller dans **Settings** (⚙️ en haut à droite)
   - Onglet **DMX**
   - Sélectionner le port COM
   - Activer USB DMX
   - Activer Art-Net (si besoin)
   - Activer QLC+ (si besoin)

3. **Ajouter une fixture** :
   - Aller dans **Fixtures** (dans la barre supérieure)
   - Cliquer **Add**
   - Choisir le type (Beam, Par LED, Moving Head, etc.)
   - Définir l'adresse DMX (start address)
   - Définir le nombre de canaux

### 2. Mode Smart

Le mode **Smart** est la console de régie principale :

- **Pads** : Grille de scènes prédéfinies (clique = envoi DMX instantané)
- **Faders** : Mixeur de groupes (Face, Douche, Latéral, etc.)
- **Master Dimmer** : Slider 0-255 qui scale tous les groupes
- **Color Pickers** : Sélection couleur par groupe
- **BPM** : Tap tempo pour synchroniser les effets

### 3. Mode Live

Le mode **Live** est pour le spectacle :

- **Playlist** : Séquence de clips/scènes
- **Timeline** : MacroTimeline avec pistes DMX
- **Crossfader** : Mix A/B entre deux scènes
- **Blackout** : Bouton d'urgence (touche K)
- **Full On** : Bouton d'urgence (touche L)

### 4. Mode Creator

Le mode **Creator** est pour la programmation :

- **Patch** : Plan de feu 2D
- **Timeline** : Édition des keyframes et automations
- **Orchestrator** : IA LLM pour générer des scènes
- **3D** : Visualiseur Three.js

### 5. Raccourcis clavier

| Touche | Action |
|--------|--------|
| `K` | Blackout (urgence) |
| `L` | Full On (urgence) |
| `Shift + drag` | Mode fine (précision) |
| `Ctrl + Z` | Undo (React Flow) |
| `Ctrl + Y` | Redo (React Flow) |

### 6. Guide interactif

Un **Guided Tour** est intégré dans l'application. Cliquer sur le bouton **?** dans la barre supérieure pour le lancer.

---

## 🧪 Troubleshooting

### "Port COM5 Access denied"
**Cause** : Un autre programme utilise le port COM.

**Solution** :
```powershell
# 1. Vérifier les ports
Get-Process -Name "node", "python" | Stop-Process

# 2. Redémarrer
.\scripts\stop-glow-logic.sh
npm run start
```

### "npm run build bloque sur spawn EPERM"
**Cause** : Antivirus ou permission Windows.

**Solution** :
```powershell
# 1. Exécuter en administrateur
# 2. Ou désactiver temporairement l'antivirus
# 3. Relancer
npm run build
```

### "QLC+ ne répond pas"
**Cause** : QLC+ n'est pas lancé ou le port OSC est pris.

**Solution** :
```powershell
# 1. Vérifier si QLC+ tourne
Get-Process -Name "qlcplus"

# 2. Libérer le port 57121
netstat -ano | findstr "57121"
taskkill /PID <PID> /F

# 3. Relancer QLC+ puis Glow Logic
```

### "Le beam ne bouge pas"
**Cause** : DMX engine pas démarré ou priorité lock.

**Solution** :
1. Vérifier que le moteur tourne (badge "LIVE" vert dans FixtureController)
2. Cliquer **Resync DMX** (🔄)
3. Vérifier le port COM dans Settings

---

## 🔧 API Backend

### Routes REST

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/network/adapters` | GET | Liste les cartes réseau |
| `/api/network/configure` | POST | Configure IP statique Art-Net |
| `/api/dmx/ports` | GET | Liste les ports COM |
| `/api/dmx/usb-config` | POST | Active USB DMX |
| `/api/dmx/live` | GET | État DMX actuel |
| `/api/safety/status` | GET | Statut sécurité (laserArmed, pyroArmed) |
| `/api/safety/arm` | POST | Arme/désarme laser/pyro |
| `/api/projects/export` | POST | Exporte `.glowproject` |
| `/api/projects/import` | POST | Importe `.glowproject` |
| `/api/diagnose` | GET | Diagnostic système (cache 60s) |
| `/api/llm/generate-media` | POST | Proxy Higgsfield/Veo/Replicate |

### Événements Socket.IO

| Événement | Direction | Description |
|-----------|-----------|-------------|
| `dmx_update` | Client → Serveur | Commande DMX brute |
| `dmx_sync` | Serveur → Client | Synchronisation valeurs DMX |
| `acp_message` | Bidirectionnel | Métadonnées agents IA |

---

## 🧑‍💻 Développement

### Scripts disponibles

```bash
npm run dev          # Dev mode (Turbopack)
npm run build        # Production build
npm run start        # Start production
npm run stop         # Stop all services
npm run typecheck    # TypeScript check
npm run verify       # Tests + lint + typecheck
npm run test:api     # Tests API backend
npm run lint         # ESLint
```

### Structure du monorepo

```bash
# Web (frontend)
cd apps/web
npm run dev

# Server (backend)
cd apps/server
npm run dev

# Tests
cd apps/server
npm run test:api
```

### Technologies

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16, React 18, TypeScript 5 |
| Backend | Express, Socket.IO, SQLite |
| 3D | Three.js, @react-three/fiber, @react-three/drei |
| Store | Zustand |
| DMX | SerialPort, Art-Net, QLC+ OSC |
| Audio | Web Audio API, AnalyserNode |
| IA | LLM (OpenAI), Higgsfield, Veo, Replicate |
| PWA | Service Worker, Web Push |

---

## 📋 Cahier des charges

Voir [`glow_logic_ultimate_spec.md`](./glow_logic_ultimate_spec.md) pour le cahier des charges complet.

### Phases MVP

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ | Core DMX & Connectivité |
| Phase 2 | ✅ | UI Unifiée (SmartDashboard) |
| Phase 3 | ✅ | Timeline (MacroTimeline) |
| Phase 4 | ✅ | Fixtures & Scanner IA |
| Phase 5 | ✅ | Sécurité (Safety Gate) |
| Phase 6 | ⚠️ | VJ Deck, 3D, IA (partiel) |
| Phase 7 | ✅ | Override & Priorités |
| Phase 8 | ✅ | Guided Tour |
| Phase 9 | ✅ | Fondations Produit |

---

## 📞 Support

- **Diagnostic** : `http://localhost:3000/setup` ou `/api/diagnose`
- **Logs** : `apps/server/server.log`, `apps/web/web.log`
- **Export diagnostic** : Bouton "Export" dans Support Center
- **Raccourcis bureau** : `Glow Logic - Stop.lnk` pour arrêter

---

## 📝 Changelog

### 2026-06-10 — Iteration 2
- ✅ Smooth DMX Engine (Fader + Effects + Easing)
- ✅ Safety Slice (laserArmed, pyroArmed, operatorRole)
- ✅ Master Dimmer (0-255)
- ✅ DMX Outputs config (qlcOsc, artNet, usbDmx)
- ✅ Network State (adapters, activeAdapter, discoveredNodes)
- ✅ TypeScript Types (DmxChannel, FixtureProfile, PatchedFixture, MediaClip, TimelineProject)
- ✅ WebGL Shaders (noise, waves, strobe)
- ✅ .glowproject Export/Import
- ✅ Safety Simulation Layer (laser, drone, pyro)
- ✅ Desktop shortcuts (Glow Logic, Debug, Stop)
- ✅ Anti double-launch guard

### 2026-06-04 — Iteration 1
- ✅ Core DMX Engine 44Hz
- ✅ SmartDashboard unifiée
- ✅ MacroTimeline avec clips et keyframes
- ✅ Patch 2D et fixtures
- ✅ Safety Gate déterministe
- ✅ Guided Tour
- ✅ Offline PWA mode

---

## 🛡️ Sécurité

- **Safety Gate** : Toutes les commandes IA passent par un filtre déterministe
- **Armement manuel** : Laser et pyro nécessitent un clic explicite
- **Limites physiques** : Laser max 64/255, geofencing drones
- **Permissions** : Rôles beginner/expert/admin
- **Logs** : Toutes les actions dangereuses sont loguées

---

## 📄 License

Voir [`LICENSE`](./LICENSE) pour les détails.

**Glow Logic** © 2026 — Tous droits réservés.

---

*Dernière mise à jour : 2026-06-10*
*Version : 2.0.0*
*Commit : `f155781` — `feat: iteration-2-critical-store-dmx-safety`*

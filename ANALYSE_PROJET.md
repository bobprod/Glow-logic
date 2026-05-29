# Analyse du Projet Glow Logic

## 📋 Résumé
Glow Logic est un système de contrôle d'éclairage DMX No-Code pour spectacles live. Il combine une interface web moderne avec un backend temps réel pour contrôler les luminaires via plusieurs protocoles.

---

## 📅 Journal des Modifications

### Itération 5 — 29 Mai 2026 (Suite)

#### ✅ Fixture Creator IA (Scan Image + Auto-Patch)
- **Scan image** : Upload photo du manuel → OCR + LLM → fixture créée automatiquement
- **Vérification qualité** : Score 0-100% (résolution, luminosité, netteté, angle)
- **Boutons 🪄** sur chaque champ (nom, type, profil, groupe)
- **Apprentissage** : L'IA apprend des corrections utilisateur
- **Match bibliothèque QLC+** : Compare avec la base existante

#### ✅ Nouveaux composants UI
- `AiSuggestButton` : Bouton 🪄 réutilisable avec animation
- `ImageQualityIndicator` : Indicateur de qualité image avec suggestions

#### ✅ Nouveaux endpoints API
```
POST /api/fixtures/scan-quality     → Vérifie la qualité de l'image
POST /api/ai/suggest-fixture        → Suggère type/profil à partir du nom
POST /api/ai/match-library          → Match avec la bibliothèque QLC+
POST /api/ai/suggest-settings       → Suggestions de réglages
POST /api/ai/learn-correction       → Enregistre les corrections
```

#### ✅ Assistant Chat IA amélioré
- **Contexte de page** : Détecte la page actuelle et adapte les actions
- **Guide du Patch** : Explication complète pour débutants
- **Actions rapides contextuelles** : Par page (patch, fixtures, ai-lighting, etc.)
- **Astuces** : Affiche des conseils spécifiques à chaque page

#### ✅ Corrections persistance données
- **Répertoire data/** : Créé automatiquement au démarrage du serveur
- **fixtures_library.json** : Créé automatiquement si absent
- **Synchronisation settings** : Charge les paramètres depuis SQLite au démarrage
- **Apprentissage** : Sauvegarde dans `data/fixture_learning.json`

---

### Itération 4 — 29 Mai 2026

#### ✅ MCP Server (Model Context Protocol)
- **Package** : `packages/mcp-server/`
- **18 outils** pour contrôler l'éclairage via LLM
- **5 ressources** (patch, config, groups, scenes, status)
- **4 prompts** (suggestion scènes, transitions, analyse, urgences)
- Transport **stdio** (compatible Claude Desktop, VS Code Copilot)

#### ✅ BYOK (Bring Your Own Key)
- **7 fournisseurs LLM** supportés
- **Endpoint test** : `POST /api/settings/test-key`
- **Bouton "Tester la connexion"** dans `/settings`
- Fournisseurs ajoutés :
  - OpenRouter (`sk-or-...`)
  - NVIDIA NIM (`nvapi-...`)
  - OpenCode Go (`sk-opencode-...`)

#### ✅ ACP Agents (Agent Communication Protocol)
- **Package** : `packages/acp-agents/`
- **4 agents IA** :
  - Agent Audio/Lumière → Analyse audio → couleurs RGB
  - Agent Scénographe → Génère des scènes
  - Agent Diagnostique → Surveille le DMX
  - Agent Apprentissage → Apprend les préférences
- **Orchestrateur** coordonne les agents
- **Dashboard** : `/agents`

#### ✅ Scan Fixture IA amélioré
- **Service LLM** (`llm-fixture.ts`) pour analyser le texte OCR
- **Détection améliorée** des channels (56% → 85-95%)
- **Interface de validation** avec badge "IA ANALYSÉ"
- **Bouton "Valider et sauvegarder"**

#### ✅ Progressive Web App (PWA)
- **Manifest PWA** avec icônes SVG
- **Service Worker** pour le cache
- **Installation** sur mobile et desktop
- **Raccourcis** depuis l'écran d'accueil

#### ✅ Assistant Chat IA
- **Bulle flottante** (baguette magique) en bas à droite
- **Panneau de chat** avec actions rapides
- **Contexte intelligent** (connait l'état de l'application)
- **Endpoint** : `POST /api/chat`
- **Multi-LLM** : utilise la clé API configurée

---

## 🏗️ Architecture

### Stack Technique
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + Framer Motion
- **Backend**: Express + Socket.IO + ts-node
- **Database**: SQLite (better-sqlite3)
- **Protocoles**: Art-Net, OSC, WebMIDI API
- **Canvas**: ReactFlow 11
- **IA/LLM**: OpenAI, Claude, Gemini, DeepSeek, OpenRouter, NVIDIA NIM, OpenCode Go
- **MCP**: Model Context Protocol pour intégration LLM
- **ACP**: Agent Communication Protocol pour orchestration IA

### Structure des Dossiers
```
Glow Logic/
├── apps/
│   ├── server/              # Backend Express + Socket.IO
│   │   ├── index.ts         # Point d'entrée principal
│   │   ├── services/
│   │   │   ├── database.ts  # SQLite
│   │   │   ├── artnet.ts    # Art-Net
│   │   │   ├── osc.ts       # OSC Bridge
│   │   │   ├── ocr.ts       # OCR Tesseract
│   │   │   └── llm-fixture.ts # ✨ Analyse IA fixtures
│   │   └── types/
│   └── web/                 # Frontend Next.js
│       └── src/
│           ├── app/         # Pages (routes)
│           │   ├── agents/  # ✨ Dashboard agents ACP
│           │   ├── ai-lighting/
│           │   ├── fixtures/
│           │   ├── patch/
│           │   └── settings/
│           ├── components/
│           │   └── ChatAssistant.tsx # ✨ Assistant chat IA
│           ├── lib/
│           └── store/       # État global (Zustand)
├── packages/
│   ├── config/
│   ├── dmx-lib/
│   ├── mcp-server/          # ✨ Serveur MCP
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tools/       # DMX, Patch, Groups, Scene
│   │   │   ├── resources/
│   │   │   └── prompts/
│   │   └── package.json
│   └── acp-agents/          # ✨ Agents ACP
│       ├── src/
│       │   ├── agents/
│       │   │   ├── base-agent.ts
│       │   │   ├── audio-lighting.ts
│       │   │   ├── scenographer.ts
│       │   │   ├── diagnostics.ts
│       │   │   └── learning.ts
│       │   ├── orchestrator/
│       │   └── shared/
│       └── package.json
└── scripts/
    └── Launch-GlowLogic.ps1
```

---

## 🎯 Fonctionnalités Principales

### 1. Modes de Contrôle
- **Smart Mode**: Dashboard simplifié avec sliders par zone
- **Creator Mode**: Éditeur nodal ReactFlow
- **Live Mode**: Interface de performance

### 2. Système de Groupes
- Groupes A-F (Face, Latéraux, Contres, Douches 1-3)
- Chaque groupe mappe vers une zone Smart Mode
- Configuration dans `/settings` → "Groupes DMX"

### 3. Protocoles de Sortie
- **QLC+ OSC**: Via UDP port 7700
- **Art-Net**: Via UDP port 6454
- **USB DMX**: Serial port (optionnel)

### 4. Mode IA Lumière (`/ai-lighting`)
- Analyse audio en temps réel via micro
- Détection de BPM automatique
- Conversion fréquences → couleurs RGB
- Effets DROP (flash blanc, stroboscope, flash couleur)
- Paramètre de "nervosité" pour les transitions

### 5. OCR DMX avec IA (`/fixtures`)
- Scan de manuels luminaires via Tesseract.js
- Extraction automatique des channels
- **Analyse LLM** pour améliorer la détection
- Validation utilisateur avant sauvegarde

### 6. Fixture Creator IA (`/patch`)
- **Scan image** : Upload photo du manuel → OCR + LLM → auto-remplit le formulaire
- **Vérification qualité** : Score 0-100% (résolution, luminosité, netteté, angle)
- **Boutons 🪄** sur chaque champ pour suggestions IA
- **Match bibliothèque QLC+** : Compare avec la base existante
- **Apprentissage** : L'IA apprend des corrections utilisateur
- **Suggestions réglages** : Groupe, hauteur, rotation, adresse

### 7. Assistant Chat IA
- Bulle flottante avec icône baguette magique
- Actions rapides (Blackout, Statut, Scènes, etc.)
- Contexte intelligent de l'application
- Multi-LLM avec la clé API configurée

### 7. Agents ACP (`/agents`)
- Agent Audio/Lumière : analyse audio → couleurs
- Agent Scénographe : génération de scènes
- Agent Diagnostique : surveillance DMX
- Agent Apprentissage : préférences utilisateur
- Orchestrateur : coordination des agents

---

## ⚙️ Système de Settings (`/settings`)

### Sections Disponibles
1. **Protocoles**: QLC+, Art-Net, statut backend
2. **MIDI**: Périphériques, horloge, profils contrôleurs
3. **IA & LLM**: Clés API par fournisseur + test connexion
4. **Groupes DMX**: Configuration A-F
5. **Interface**: Préférences UI
6. **Sauvegarde**: Autosave, export

### Fournisseurs LLM Supportés
| Fournisseur | Modèles | Clé API | Test |
|-------------|---------|---------|------|
| OpenAI | gpt-4o, gpt-4o-mini | `sk-...` | ✅ |
| Anthropic | claude-opus-4, claude-sonnet-4 | `sk-ant-...` | ✅ |
| Google Gemini | gemini-2.0-flash, gemini-1.5-pro | `AIza...` | ✅ |
| DeepSeek | deepseek-chat, deepseek-reasoner | `sk-...` | ✅ |
| OpenRouter | 300+ modèles | `sk-or-...` | ✅ |
| NVIDIA NIM | Nemotron, Llama, DeepSeek | `nvapi-...` | ✅ |
| OpenCode Go | Kimi, GLM, DeepSeek, MiMo, Qwen | `sk-opencode-...` | ✅ |

---

## 📡 API Backend (Port 3005)

### Routes Principales
```
GET    /api/settings              # Récupérer tous les paramètres
POST   /api/settings              # Sauvegarder des paramètres
POST   /api/settings/test-key     # ✨ Tester une clé API LLM
POST   /api/chat                  # ✨ Assistant chat IA
GET    /api/agents                # ✨ Lister les agents ACP
POST   /api/agents/:id/action     # ✨ Action sur un agent
POST   /api/orchestrator/orchestrate # ✨ Orchestration
GET    /api/diagnostics           # ✨ Rapport diagnostic
GET    /api/projects              # Lister les projets
POST   /api/projects              # Créer un projet
GET    /api/fixtures              # Lister les fixtures
POST   /api/fixtures              # Créer une fixture
POST   /api/fixtures/scan         # OCR + LLM scan
POST   /api/fixtures/scan-quality # ✨ Vérifie qualité image
POST   /api/ai/suggest-fixture    # ✨ Suggère type/profil depuis nom
POST   /api/ai/match-library      # ✨ Match avec bibliothèque QLC+
POST   /api/ai/suggest-settings   # ✨ Suggestions de réglages
POST   /api/ai/learn-correction   # ✨ Apprentissage des corrections
GET    /api/patch                 # Récupérer le patch DMX
POST   /api/patch                 # Ajouter un fixture au patch
```

---

## 🎨 Pages Web

| Route | Description |
|-------|-------------|
| `/` | Dashboard principal |
| `/smart` | Smart Mode (sliders + pads) |
| `/dmx-tester` | Testeur DMX |
| `/fixtures` | Scanner fixture OCR + IA |
| `/patch` | Patch DMX |
| `/effects` | Effets prédéfinis |
| `/timeline` | Éditeur timeline |
| `/visualizer` | Visualiseur 3D |
| `/ai-lighting` | Mode IA Lumière |
| `/agents` | ✨ Dashboard agents ACP |
| `/settings` | Paramètres + test LLM |

---

## 🧩 Composants UI

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `ChatAssistant` | `components/ChatAssistant.tsx` | Assistant chat IA bulle flottante |
| `AiSuggestButton` | `components/AiSuggestButton.tsx` | Bouton 🪄 réutilisable avec animation |
| `ImageQualityIndicator` | `components/ImageQualityIndicator.tsx` | Indicateur de qualité image |

---

## 📱 Progressive Web App (PWA)

### Fonctionnalités
- **Installation** : Installable sur mobile et desktop
- **Mode hors ligne** : Cache des pages et ressources
- **Barre d'applications** : Thème cyan personnalisé
- **Raccourcis** : Accès rapide depuis l'écran d'accueil

### Fichiers PWA
```
apps/web/public/
├── manifest.json          # Manifest PWA (SVG icons)
├── sw.js                  # Service Worker
├── icons/
│   └── icon.svg           # Icône SVG principale
└── generate-icons.html    # Outil de génération PNG
```

---

## 🔧 Commandes Utiles

```bash
# Démarrer en dev (tout)
npm run dev

# Démarrer séparément
npm run dev:server    # Backend API :3005
npm run dev:web       # Frontend :3000

# Via le launcher Windows
.\launch-glow-logic.cmd

# Arrêter
.\stop-glow-logic.cmd
```

---

## 📊 Base de Données SQLite

### Tables
- `app_settings`: Paramètres clé-valeur (LLM keys, config)
- `projects`: Projets sauvegardés (nodes/edges JSON)
- `fixtures`: Bibliothèque de fixtures DMX
- `patch`: Patch DMX actuel

---

## 🔒 Sécurité

- Clés API masquées côté serveur
- CORS configuré pour localhost:3000
- Upload images limité à 10 Mo
- Pas d'authentification (usage local)

---

## 📦 Dépendances Installées

| Package | Version | Usage |
|---------|---------|-------|
| next-pwa | ^5.6.0 | PWA support |
| framer-motion | ^12.40.0 | Animations UI |
| @modelcontextprotocol/sdk | ^1.12.1 | MCP Server |
| zod | ^3.24.4 | Validation schémas |

---

*Dernière mise à jour : 29 Mai 2026 — Itération 5 (persistance corrigée)*

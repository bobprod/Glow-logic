# Glow Logic - Agents ACP

## 🎯 Vue d'ensemble

Système d'agents IA basé sur l'Agent Communication Protocol (ACP) pour l'orchestration intelligente de l'éclairage DMX.

## 🤖 Agents Disponibles

### 1. Agent Audio/Lumière
**ID**: `agent-audio-lighting`

Analyse le spectre audio en temps réel et génère des réponses d'éclairage.

**Fonctionnalités**:
- Analyse des fréquences (basses, médiums, aigus)
- Conversion fréquences → couleurs RGB
- Détection de BPM
- Effets DROP (flash, stroboscope)
- Transitions fluides avec interpolation

**Utilisation**:
```typescript
const agent = new AudioLightingAgent();
const result = await agent.startRun({
  audio: { bass: 0.8, mid: 0.5, treble: 0.3, energy: 0.7, bpm: 128 }
});
```

### 2. Agent Scénographe
**ID**: `agent-scenographer`

Génère des suggestions de scènes d'éclairage basées sur le contexte.

**Fonctionnalités**:
- Moods prédéfinis (energetic, calm, dramatic, romantic, party, concert, theater, lounge)
- Adaptation au moment de la journée
- Génération de transitions
- Sauvegarde/chargement de scènes

**Utilisation**:
```typescript
const agent = new ScenographerAgent();
const scene = await agent.startRun({
  request: { type: "preset", mood: "concert" }
});
```

### 3. Agent Diagnostique
**ID**: `agent-diagnostics`

Surveille et diagnostique les problèmes d'éclairage DMX.

**Fonctionnalités**:
- Détection de fixtures hors ligne
- Vérification des adresses DMX
- Détection de conflits
- Alertes en temps réel
- Recommandations

**Utilisation**:
```typescript
const agent = new DiagnosticsAgent();
const report = await agent.startRun({ action: "full_check" });
```

### 4. Agent Apprentissage
**ID**: `agent-learning`

Apprend les préférences utilisateur et suggère des améliorations.

**Fonctionnalités**:
- Enregistrement des actions
- Détection de patterns
- Suggestions personnalisées
- Analytics d'utilisation

**Utilisation**:
```typescript
const agent = new LearningAgent();
await agent.startRun({
  action: "record",
  payload: { type: "scene_loaded", context: { sceneName: "Concert" } }
});
```

## 🎼 Orchestrateur

L'orch coordonne les 4 agents et fusionne leurs suggestions.

**Fonctionnalités**:
- Communication inter-agents
- Fusion de suggestions
- Application automatique
- Gestion des erreurs

**Utilisation**:
```typescript
const orchestrator = getOrchestrator();
const suggestion = await orchestrator.orchestrate({
  audio: audioData,
  sceneRequest: { type: "contextual" }
});
```

## 📡 API Endpoints

```
GET    /api/agents                    # Lister les agents
POST   /api/agents/:id/action         # Exécuter une action
POST   /api/orchestrator/orchestrate  # Lancer l'orchestration
GET    /api/diagnostics               # Rapport de diagnostic
```

## 🏗️ Architecture

```
packages/acp-agents/
├── src/
│   ├── agents/
│   │   ├── base-agent.ts           # Classe de base
│   │   ├── audio-lighting.ts       # Agent Audio/Lumière
│   │   ├── scenographer.ts         # Agent Scénographe
│   │   ├── diagnostics.ts          # Agent Diagnostique
│   │   └── learning.ts             # Agent Apprentissage
│   ├── orchestrator/
│   │   └── orchestrator.ts         # Orchestrateur ACP
│   ├── shared/
│   │   ├── types.ts                # Types TypeScript
│   │   └── api-client.ts           # Client API Glow Logic
│   └── index.ts                    # Point d'entrée
├── package.json
└── tsconfig.json
```

## 🚀 Démarrage

```bash
cd packages/acp-agents
npm install
npm run build
```

## 📊 Dashboard

Accéder au dashboard des agents : `http://localhost:3000/agents`

## 🔗 Intégration

Les agents communiquent avec le backend Glow Logic via :
- REST API (`/api/agents/*`)
- Socket.IO (pour les mises à jour en temps réel)
- MCP (pour l'intégration LLM)

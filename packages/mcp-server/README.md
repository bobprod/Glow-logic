# Glow Logic MCP Server

Serveur MCP (Model Context Protocol) pour le contrôle d'éclairage DMX via des modèles LLM.

## 🎯 Fonctionnalités

Ce serveur MCP expose les fonctionnalités de Glow Logic comme des outils que les LLM (Claude, GPT, etc.) peuvent utiliser pour contrôler l'éclairage.

### Outils Disponibles

| Outil | Description |
|-------|-------------|
| `dmx_set_channel` | Définir une valeur DMX individuelle |
| `dmx_set_group` | Régler l'intensité d'un groupe (A-F) |
| `dmx_set_color` | Définir une couleur RGB pour un groupe |
| `dmx_blackout` | Activer/désactiver le blackout |
| `dmx_set_bpm` | Régler le BPM pour les effets synchronisés |
| `patch_get` | Récupérer le patch DMX actuel |
| `patch_add` | Ajouter un fixture au patch |
| `patch_update` | Mettre à jour un fixture |
| `patch_delete` | Supprimer un fixture |
| `patch_localize` | Localiser un fixture (flash strobe) |
| `group_get_status` | État de tous les groupes |
| `group_set_config` | Configurer un groupe |
| `group_set_levels` | Régler les niveaux de plusieurs groupes |
| `scene_save` | Sauvegarder une scène |
| `scene_load` | Charger une scène |
| `scene_list` | Lister les scènes |
| `scene_delete` | Supprimer une scène |
| `scene_sequence` | Créer une séquence de scènes |

### Ressources

| Ressource | URI | Description |
|-----------|-----|-------------|
| DMX Patch | `glow-logic://patch` | Patch DMX actuel |
| Configuration | `glow-logic://config` | Configuration Glow Logic |
| Groups | `glow-logic://groups` | Configuration des groupes |
| Scenes | `glow-logic://scenes` | Scènes sauvegardées |
| Status | `glow-logic://status` | Statut du backend |

### Prompts

| Prompt | Description |
|--------|-------------|
| `lighting_scene_suggestion` | Suggérer des scènes d'éclairage |
| `lighting_transition` | Créer une transition entre scènes |
| `lighting_analysis` | Analyser la configuration actuelle |
| `lighting_emergency` | Gérer les urgences d'éclairage |

## 🚀 Installation

```bash
cd packages/mcp-server
npm install
npm run build
```

## ⚙️ Configuration

### Variable d'environnement

```bash
# URL du backend Glow Logic (défaut: http://localhost:3005)
GLOW_LOGIC_BACKEND_URL=http://localhost:3005
```

### Configuration Claude Desktop

Ajouter dans `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "glow-logic": {
      "command": "node",
      "args": ["C:/Users/BOB/Desktop/project dev/Glow logic/packages/mcp-server/dist/index.js"],
      "env": {
        "GLOW_LOGIC_BACKEND_URL": "http://localhost:3005"
      }
    }
  }
}
```

### Configuration VS Code (Copilot)

Ajouter dans `.vscode/mcp.json`:

```json
{
  "servers": {
    "glow-logic": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "GLOW_LOGIC_BACKEND_URL": "http://localhost:3005"
      }
    }
  }
}
```

## 📝 Utilisation

### Exemples de commandes pour le LLM

Une fois le serveur MCP connecté, vous pouvez demander au LLM:

- "Mets le groupe A en rouge à 80%"
- "Crée une scène Concert Rock"
- "Fais un blackout urgent"
- "Ajoute un PAR LED au patch à l'adresse 1"
- "Suggère des scènes pour une soirée lounge"
- "Analyse ma configuration d'éclairage"

### Développement

```bash
# Mode dev avec ts-node
npm run dev

# Build pour production
npm run build

# Exécuter le build
npm start
```

## 🔧 Backend requis

Le serveur MCP communique avec le backend Glow Logic via HTTP. Assurez-vous que:

1. Le backend tourne sur `http://localhost:3005`
2. Les endpoints suivants sont disponibles:
   - `POST /api/dmx/channel`
   - `POST /api/dmx/group`
   - `POST /api/dmx/color`
   - `POST /api/dmx/blackout`
   - `POST /api/dmx/bpm`
   - `GET /api/patch`
   - `POST /api/patch`
   - `PUT /api/patch/:id`
   - `DELETE /api/patch/:id`
   - `POST /api/patch/:id/localize`
   - `GET /api/settings`
   - `POST /api/settings`
   - `GET /api/scenes`
   - `POST /api/scenes`
   - `POST /api/scenes/load`
   - `DELETE /api/scenes/:name`
   - `POST /api/scenes/sequence`

## 📚 Ressources

- [Documentation MCP](https://modelcontextprotocol.io/)
- [SDK TypeScript MCP](https://github.com/modelcontextprotocol/typescript-sdk)
- [Glow Logic GitHub](https://github.com/bobprod/Glow-logic)

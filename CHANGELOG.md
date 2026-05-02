# Glow Logic — Journal des modifications

> Ce fichier est mis à jour à chaque session de travail.
> Un agent IA qui ouvre ce projet doit lire ce fichier **en premier** pour ne pas ré-analyser tout le code.

---

## Session 2026-05-02 — Launcher v3 + Settings complet

### 1. Launcher PowerShell (scripts/Launch-GlowLogic.ps1) — RÉÉCRITURE COMPLÈTE

**Problèmes résolus :**

| # | Symptôme | Cause racine | Correction |
|---|----------|-------------|------------|
| 1 | « Le terminateur manquant » / « Accolade fermante manquante » | Caractères Unicode (╔ ║ ╚ —) sans BOM UTF-8 dans un script PowerShell 5.1 | Réécriture en ASCII pur + fichier sauvegardé avec BOM `EF BB BF` via `new UTF8Encoding(true)` |
| 2 | `npm error code EBADPLATFORM` | `$ErrorActionPreference = 'Stop'` + appel `npm` → résolu sur `npm.ps1` qui traite stderr comme erreur fatale | Remplacement par `cmd /c "npm install --loglevel=warn"` pour contourner le wrapper PS |
| 3 | Vérification node_modules incorrecte | Le launcher cherchait `apps/server/node_modules` qui n'existe pas dans un workspace npm (hoisting vers la racine) | Vérification uniquement `node_modules` (racine) + `apps/web/node_modules/next` comme marqueur |
| 4 | Services non tués au redémarrage | L'ancien launcher vérifiait si les ports étaient libres et ne faisait rien s'ils l'étaient | Section [2/5] tue **toujours** les processus sur les ports 3000 et 3005 au démarrage |

**Fonctionnalités ajoutées :**
- Health checks HTTP sur toutes les routes (`/`, `/patch`, `/dmx-tester`, `/effects`, `/ai-lighting`)
- Rotation automatique des logs (conservation 7 jours, dossier `logs/`)
- Résumé final coloré avec URLs cliquables
- Ouverture automatique du navigateur quand le frontend est prêt

**Fichier:** `scripts/Launch-GlowLogic.ps1`

---

### 2. Launcher CMD (launch-glow-logic.cmd)

**Modifications :**
- Ajout d'un bloc d'erreur avec message + `pause` si PowerShell retourne un code non-zéro
- Permet à l'utilisateur de voir le message d'erreur avant fermeture de la fenêtre

**Fichier:** `launch-glow-logic.cmd`

---

### 3. Page Settings dédiée (apps/web/src/app/settings/page.tsx) — CRÉATION

**Remplacement du SettingsModal** (drawer 440px) par une **page dédiée** `/settings` avec layout à 2 colonnes.

**Architecture UI :**
```
┌─────────────────────────────────────────────────────────┐
│  ← Paramètres          Glow Logic v3.0.0  [●] [Sauver] │  ← Sticky header
├──────────────┬──────────────────────────────────────────┤
│  Protocoles  │                                          │
│  MIDI        │         Contenu de la section            │
│  IA & LLM    │         (scrollable, max-w-2xl)          │
│  Groupes DMX │                                          │  ← 2 colonnes
│  Interface   │                                          │
│  Sauvegarde  │                                          │
│  À propos    │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Sections (7) :**

| Section | Contenu |
|---------|---------|
| Protocoles | QLC+ host/port, ArtNet host/port/universe (ajout ArtNet host+port absent du modal) |
| MIDI | Device MIDI, canal, BPM auto, learn mode |
| IA & LLM | Clé API OpenAI (masquée), modèle, seuil audio, analyse Continue, audio source |
| **Groupes DMX** *(NOUVEAU)* | Groupes A–F : label, color picker, zone ID (0-9), toggle actif |
| Interface | Thème, langue, grille snap, animations, notifications, debug overlay |
| Sauvegarde | Auto-save, intervalle, export JSON, import JSON |
| À propos | Version, stack technique, liens GitHub/Docs |

**Groupes DMX — mapping par défaut :**
```
A → Face      (cyan  #22d3ee, zone 1)
B → Latéraux  (violet #a78bfa, zone 2)
C → Contres   (rose  #f472b6, zone 3)
D → Douche 1  (vert  #34d399, zone 4)
E → Douche 2  (orange #fb923c, zone 0, inactif)
F → Douche 3  (jaune #fbbf24, zone 0, inactif)
```
Ces zones correspondent à `GROUP_TO_ZONE_ID` dans `apps/web/src/lib/groupDispatch.ts`.

**Comportement :**
- Données chargées depuis `localStorage` au montage
- Sauvegarde vers `localStorage` + `POST /api/settings` (clés aplaties)
- `groups_config` sauvegardé en JSON stringifié
- Polling du statut backend toutes les 10s via `GET /api/settings`
- Raccourci clavier `Ctrl+S`
- Indicateur de statut live (icône Wifi vert/rouge)

**Fichier:** `apps/web/src/app/settings/page.tsx`

---

### 4. TopBar (apps/web/src/components/TopBar.tsx) — MISE À JOUR

**Modification :**
- Suppression de l'import `SettingsModal`
- Suppression du state `isSettingsOpen`
- Suppression du render `<SettingsModal />`
- Le bouton ⚙️ fait maintenant `router.push("/settings")` → navigue vers la page dédiée

**Fichier:** `apps/web/src/components/TopBar.tsx`

---

## Architecture globale (rappel rapide)

```
apps/
  web/           ← Next.js 16 + React 19 + Zustand + ReactFlow
    src/
      app/
        /                  ← Canvas Smart/Creator
        /patch             ← Patch DMX fixtures
        /dmx-tester        ← 512 canaux direct
        /effects           ← Pipeline d'effets
        /ai-lighting       ← IA + audio
        /fixtures          ← Scan OCR fixture
        /timeline          ← Timeline macros
        /settings          ← ← NOUVEAU : Page paramètres
      components/
        TopBar.tsx         ← Barre de navigation principale
        ui/SettingsModal   ← Ancien modal (conservé mais plus utilisé dans TopBar)
      lib/
        groupDispatch.ts   ← Dispatch DMX vers groupes A-F
        socket.ts          ← Client Socket.io → port 3005
      store/
        useStore.ts        ← Zustand root store
        slices/
          aiSlice.ts       ← Config IA par groupe
          patchSlice.ts    ← Fixtures patchées
  server/        ← Express 5 + Socket.io + OSC + ArtNet
    index.ts     ← GET/POST /api/settings, /api/patch, /api/fixtures, /api/projects
    services/
      qlc.ts     ← Bridge OSC → QLC+ (port 7700)
      database.ts ← SQLite (better-sqlite3)
```

**Flux DMX :**
```
WebUI → Zustand → Socket.io :3005 → Express → OSC :7700 → QLC+ → ArtNet → Lumières
```

---

## Tâches en attente (backlog)

- [ ] Backend : ajouter `artnet_host` et `artnet_port` au handler `/api/settings` (actuellement seul `artnet_universe` est géré)
- [ ] Backend : endpoint `/api/settings/status` pour statut live (QLC+, ArtNet connectés ?)
- [ ] MIDI : intégration bidirectionnelle AKAI APC Mini mk2 (LEDs retour)
- [ ] Timeline : keyframes couleur + intensité avec courbes d'interpolation
- [ ] Vérifier compilation TypeScript de la nouvelle page settings (`tsc --noEmit`)
- [ ] Supprimer `SettingsModal.tsx` si confirmé inutilisé (ou garder comme composant embarqué dans `/settings`)

---

## Convention pour les prochains agents

1. **Lire ce fichier en premier** — évite de ré-analyser tout le code depuis zéro
2. **Ports** : Web = 3000, API = 3005, QLC+ OSC = 7700
3. **Lancer le projet** : double-clic `launch-glow-logic.cmd` à la racine
4. **État de session** : tout l'état client est dans Zustand (`useStore`) + `localStorage`
5. **Groupes A-F** : mappés dans `groupDispatch.ts`, configurables dans `/settings`
6. **Hook CockroachDB** : erreur de syntaxe connue dans la session courante — ignorable, corrigée sur disque, se résout après redémarrage de Claude Code

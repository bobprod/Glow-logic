# 🔬 Audit multi-agents Glow Logic — Synthèse consolidée

> 5 agents Claude (Opus) ont analysé en parallèle : Navigation/TopBar, Smart Dashboard, Creator/3D, Backend/DMX, Store/Offline.
> Date : 2026-06-12. Aucun fichier modifié — analyse seule.

---

## 🎯 Les 5 problèmes les plus importants (tous domaines confondus)

| # | Problème | Domaine | Gravité | Pourquoi c'est critique |
|---|----------|---------|---------|--------------------------|
| **1** | **SQLite synchrone dans le hot-path DMX** : `getSafetyState()` fait 4+ lectures SQLite bloquantes **à chaque canal**, à 44 Hz × N canaux. | Backend | 🔴🔴 | Cause racine probable du jitter DMX sous charge. Le risque #1 en live. |
| **2** | **"Le module paramètre s'enlève"** : `selectFixture` (uiSlice 56-67) force l'ouverture de la sidebar, et fermer un panneau vide l'autre. | Creator/3D | 🔴🔴 | C'est le bug exact que tu as signalé. Cause trouvée. |
| **3** | **La disposition Smart "fuit" entre projets** : `smartWidgets` persisté en global ET dans le projet, et 3 `useEffect` écrasent les choix de l'utilisateur au reload. | Smart + Store | 🔴 | Rend la personnalisation impossible — bloque directement ta demande de drag&drop. |
| **4** | **TopBar surchargée** : ~22 éléments cliquables sur 64px, 3 niveaux mélangés (navigation + statut + actions). | Navigation | 🔴 | C'est la surcharge que tu vois sur la photo 1. |
| **5** | **Sélection non transitive** entre canvas, 3D et sidebar (3 systèmes d'ID incompatibles : `node-12` vs `fixture-7`). | Creator/3D | 🔴 | La 3D ne se synchronise pas avec le canvas — ta demande explicite. |

---

## ⚡ Quick wins (< 30 min chacun) — à faire en premier

1. **Supprimer le BPM dupliqué** — SmartDashboard 1537-1541 (le BPM global vit dans la TopBar). *5 min.*
2. **Découpler `selectFixture` de la sidebar** — retirer `isSidebarVisible:true` + `smartSidebarPanel:'inspector'` de uiSlice 56-67 → corrige "le module paramètre s'enlève". *20 min.*
3. **Neutraliser les useEffect qui écrasent `smartWidgets`** — SmartDashboard 194-214 et 389-414 → débloque toute la personnalisation Smart. *15 min.*
4. **Corriger les mojibake** — `Plan de ScÃ¨ne`, `ContrÃ´les`, `LatÃ©ral`, accents manquants TopBar → libellés FR propres. *15 min.*
5. **Supprimer le `console.log` OSC à 44 Hz** — qlc.ts 53-102 (bloque l'event loop en live). *5 min.*
6. **Supprimer le raycaster 3D global redondant** — VisualizerView 13-48 (double handler de clic). *15 min.*
7. **Cache court (200ms) sur l'état safety** — dmxRouter 85. *20 min.*

---

## 🟦 1. Navigation & TopBar

**Problème central** : 22 éléments, mélange navigation / statut / actions.

- 🔴 **Cluster statut unifié** : fusionner Backend + DMX + Laser + Pyro + Offline (5 indicateurs séparés, dont 2 non cliquables masqués en mobile) en **une seule pastille** "Système OK / 2 alertes" avec popover détaillé. *(1 j)*
- 🔴 **Menu overflow** : regrouper Aide / Tour / Support / Bibliothèque / Settings dans un menu `⋯`. Passe la barre de ~22 à ~10 éléments. *(0,5-1 j)*
- 🔴 **Popovers unifiés** : 3 popovers (Sync/Outils/Offline) ont 3 comportements de fermeture différents. Extraire `TopBarPopover` (click-outside + Escape + ARIA). *(0,5 j)*
- 🟡 Clarifier navigation Mode × Vue (SMART/CANVAS pointent au même endroit) ; rendre les raccourcis clavier découvrables.
- 🟢 Contrastes WCAG, centraliser l'état des panneaux dans uiSlice.

## 🟩 2. Smart Dashboard

**Bonne nouvelle** : `framer-motion` est **déjà installé** → drag&drop sans nouvelle dépendance. Les actions store (`reorderSmartWidgets`, `setSmartWidgets`) existent déjà. Le drag&drop natif fonctionne déjà sur les groupes DMX (GroupStrips 191-197) et les fixtures (StagePlan 256-261) — le savoir-faire est dans le code.

- 🔴 **Brancher le drag&drop** sur les sections avec `<Reorder.Group>` de framer-motion (remplace les boutons ▲▼). **Prérequis : faire le quick win #3 d'abord.** *(0,5-1 j)*
- 🔴 **Presets de disposition Live / Prépa / VJ** (calqués sur les `groupPresets` déjà existants). *(1 j)*
- 🟡 **Layout multi-colonnes** (champ `span: full|half`) → Groupes DMX + Plan de scène côte à côte sur grand écran. *(0,5-1 j)*
- 🟡 **Découper SmartDashboard.tsx** (1688 lignes) en VjDeck/ZoneControls/MiniPlaylist/Spectro. *(1 j)*
- 🟢 Sections détachables (pop-out, le pattern `VideoProjectionWindow` existe déjà).

## 🟪 3. Creator & 3D

- 🔴 **Découpler sélection / sidebar** (uiSlice 56-67) → corrige "le module paramètre s'enlève". *(30 min)*
- 🔴 **Unifier l'ID de sélection** (`node.id` canonique partout) → la 3D, le canvas et la sidebar se synchronisent enfin. *(2 h)*
- 🔴 **Source DMX unique pour la 3D** : il y a deux stores parallèles (`dmxChannelStore` de DmxSyncController vs `dmxEngine`) → la 3D peut ne pas refléter les réglages live. *(2-3 h)* ⚠️ Vérifier d'abord ce que lisent `ParLedFixture.tsx`/`MovingHeadFixture.tsx`.
- 🟡 `FixtureController` n'est qu'un wrapper de `FixtureInspectorPanel` (pas une vraie duplication, mais double surface) → en Creator, garder le panneau bas comme inspecteur principal.
- 🟡 Stabiliser les positions 3D (fallback sur `index` instable → projecteurs qui sautent).
- 🟢 fetch conditionnel + auto-select optionnelle (FixtureController 21-29).

## 🟧 4. Backend & DMX

- 🔴 **Cacher l'état Safety hors du hot-path** (un seul timer 1s au lieu d'une lecture SQLite par canal). *Le plus urgent.* *(2-3 h)*
- 🔴 **Sécuriser + throttler le socket `dmx_update`** (index.ts 1533) : aucune validation, ré-émet à tous les clients → amplificateur de trafic. *(3-4 h)*
- 🔴 **Exclusivité des ports** : `loadConfig` active python ET usbDmx sur le même port COM simultanément (warning seulement, ne désactive rien). *(1 j)*
- 🔴 **Robustifier le bridge Python** : chemins Python codés en dur (`C:\Users\AMIN\...`), pas de backoff, `kill_other_instances` PowerShell fragile. *(1 j)*
- 🟡 Keep-alive / re-send DMX périodique (perte UDP Art-Net = canal figé) ; chemin "frame entière" ; faire passer liveControl/smart par le Safety Gate.
- 🟢 Code mort (`buffersEqual`, `/api/dmx/live` cassé), `qlc_host` incohérent.

## 🟥 5. Store & Offline

- 🔴 **Séparer `globalPrefs` / `projectState`** : pas de frontière → la disposition fuit entre projets (corrige aussi #3). *(1 j)*
- 🔴 **Source unique** pour la liste des champs persistés (répétée 4×) et le n° de schéma (3 valeurs divergentes : front=5, serveur=3, SQLite=1). *(3 h)*
- 🔴 **Offline réellement restaurable** : les `fixtures` ne sont PAS sauvegardées (plan de scène vide hors-ligne après cold start) ; le backup n'est jamais relu ; la queue DMX est volatile. *(1 j)*
- 🟡 Supprimer `smartBlackout` (doublon de `blackout`) ; typer les slices (`any` partout) ; découper le god-slice smartMode (600 lignes, 4 responsabilités).
- 🟡 Intégrité SQLite : pas de FK, ids orphelins dans les groupes, normalisation faite à 3 endroits différents.
- 🟢 Guard quota localStorage, seed library paresseux, purge des timers.

---

## 🗺️ Plan d'implémentation recommandé

**Sprint 0 — Quick wins (1 jour)** : les 7 quick wins ci-dessus. Gros impact visible, faible risque.

**Sprint 1 — Stabilité live (2-3 jours)** : cache Safety (backend #1), sécuriser `dmx_update`, exclusivité ports. → l'app devient fiable en conditions réelles.

**Sprint 2 — Tes 3 demandes UX (3-4 jours)** :
- Drag&drop + presets de disposition Smart (après séparation global/projet du store)
- Cluster statut + menu overflow TopBar
- Unification ID de sélection + sync 3D↔canvas

**Sprint 3 — Dette & polish (3-4 jours)** : découpage SmartDashboard/smartSlice, offline complet, intégrité SQLite, accessibilité.

---

## 💡 Observations transverses

1. **Tes 3 demandes initiales sont toutes confirmées et réalisables** : la TopBar est bien surchargée, le BPM est bien dupliqué, le drag&drop des sections a déjà ses fondations (framer-motion + actions store), et le bug "module paramètre s'enlève" a sa cause racine identifiée (uiSlice).
2. **Le projet est bien structuré** — la plupart des problèmes sont de la dette de finition, pas des défauts d'architecture. Beaucoup de patterns nécessaires existent déjà ailleurs dans le code (drag&drop, pop-out, presets).
3. **Le risque #1 est invisible à l'œil** : le SQLite synchrone dans le hot-path DMX peut causer du jitter sur scène. À corriger avant tout vrai show.

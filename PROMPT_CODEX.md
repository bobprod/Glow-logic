# Prompt pour Codex — Glow Logic : Implémentation & Améliorations

## Contexte

Tu travailles sur **Glow Logic**, une régie multimédia temps réel unifiée (DMX, VJ, lasers, drones, pyrotechnie) avec interface web + backend Node.js.

Le projet est un monorepo situé dans le dossier `Glow-logic/` :
- `apps/web/` → Next.js 16 + React 19 + Zustand + Tailwind CSS v4 + Socket.IO client
- `apps/server/` → Express 5 + Socket.IO + SQLite (better-sqlite3) + TypeScript
- `apps/web/src/components/` → Composants principaux : `SmartDashboard.tsx`, `MacroTimeline.tsx`, `PatchPanel.tsx`, `TopBar.tsx`, etc.
- `apps/server/services/` → Services backend : `safetyGate.ts`, `showActions.ts`, `database.ts`, `fixtureResolver.ts`, etc.

## Fichiers de référence obligatoires à lire

Avant de commencer quoi que ce soit, tu **DOIS** lire ces fichiers dans cet ordre :

1. **`Glow-logic/glow_logic_ultimate_spec.md`** — Le cahier des charges complet (413 lignes). C'est la source de vérité.
2. **`Glow-logic/RECOMMENDATIONS_ITER_1.md`** — Les recommandations détaillées d'un agent IA d'analyse précédent (12 points classés par priorité, avec fichiers concernés et extraits de code).
3. **`Glow-logic/apps/web/src/store/useStore.ts`** — Le store Zustand central.
4. **`Glow-logic/apps/server/index.ts`** — Le serveur Express avec toutes les routes API.

## Ta mission

Tu es un agent de **codage et d'amélioration**. Ton objectif est de :

### 1. Prendre connaissance des recommandations existantes
Lis `RECOMMENDATIONS_ITER_1.md` et comprends chaque point. Ne les suis pas aveuglément — vérifie toi-même si elles sont toujours d'actualité.

### 2. Faire ta propre analyse critique
En plus des recommandations existantes, tu dois toi-même identifier :
- **Des bugs** dans le code actuel (logique, performance, sécurité, UX)
- **Des écarts** entre le cahier des charges et l'implémentation
- **Des incohérences** entre le frontend et le backend
- **Des fonctionnalités du MVP** qui sont mentionnées dans le cahier mais absentes du code
- **Des problèmes de qualité** (code mort, imports inutilisés, duplication, anti-patterns)

### 3. Prioriser et planifier
Classe tout ce que tu trouves par priorité :
- 🔴 **Haute** — Bloquant, crash, sécurité, ou exigence MVP critique manquante
- 🟡 **Moyenne** — Fonctionnalité importante mais pas bloquante
- 🟢 **Faible** — Polish, refactor, optimisation

### 4. Implémenter ou proposer
Pour chaque point 🔴 et 🟡 :
- Soit **implémente directement** le code (modifie les fichiers)
- Soit **décris précisément** ce qu'il faut faire si c'est trop complexe pour une seule session

Pour chaque point 🟢 :
- **Décris la solution** dans un rapport

## Points d'attention spécifiques

### Architecture
- Le store Zustand utilise des **slices** (`apps/web/src/store/slices/`). Si tu ajoutes un nouveau state, crée un slice dédié.
- Le backend utilise **better-sqlite3** avec des migrations `ALTER TABLE` dans `database.ts`.
- Le **Safety Gate** (`safetyGate.ts`) est un filtre déterministe non-IA. Toute modification doit rester codée en dur, jamais configurable par l'IA.
- Le **DMX Engine** (`dmxEngine.ts`) côté client tourne à 44 Hz avec un système de priority locks. Ne casse pas ce mécanisme.

### Code style
- TypeScript strict — pas de `any` sauf absolument nécessaire
- Les fichiers ont des fins de ligne mixtes (`\r\n` / `\r`). Utilise `Edit` avec les escapes exacts si tu modifies.
- Le projet utilise Tailwind CSS v4 (pas de `tailwind.config.js` classique)

### Tests à faire après chaque modification
- `npm run typecheck --workspace web` → doit passer à 0 erreur
- `npm run typecheck --workspace server` → doit passer à 0 erreur
- Vérifier que le backend démarre (`npm run dev` dans `apps/server/`)
- Vérifier que le frontend compile (`npm run dev` dans `apps/web/`)

## Format de sortie attendu

À la fin de ton travail, tu dois produire un rapport structuré :

```markdown
# Rapport Codex — Glow Logic

## Résumé exécutif
- Nombre de points analysés : X
- Nombre de bugs trouvés : X
- Nombre de fichiers modifiés : X
- Nombre de recommandations de l'itération 1 traitées : X/Y

## Points traités (🔴 et 🟡)

### 1. [Titre du point]
**Priorité :** 🔴 Haute  
**Fichiers modifiés :** `chemin/vers/fichier.ts`, `chemin/vers/autre.tsx`  
**Description :** Ce que tu as fait et pourquoi.  
**Code modifié :** (extrait ou référence aux lignes)

### 2. [Titre du point]
...

## Nouveaux points découverts (non dans RECOMMENDATIONS_ITER_1)

### A. [Titre]
**Priorité :** 🟡 Moyenne  
**Description :** Ce que tu as trouvé de nouveau.  
**Recommandation :** Ce qu'il faut faire.

## Points 🟢 (Faible priorité — à faire plus tard)

### B. [Titre]
**Description :** ...

## Points de la RECOMMENDATIONS_ITER_1 non traités

| # | Titre | Statut | Raison |
|---|-------|--------|--------|
| 3 | Visualiseur 3D laser/drone | Non traité | Trop complexe pour cette session |
| ... | ... | ... | ... |
```

## Règles absolues

1. **Ne supprime jamais** de fonctionnalité existante sans justification dans le cahier des charges.
2. **Ne modifie pas** le Safety Gate pour le rendre configurable ou IA-dépendant — il doit rester codé en dur.
3. **Ne casse pas** le DMX Engine 44 Hz — c'est le cœur du produit.
4. **Vérifie toujours** `tsc --noEmit` après modification TypeScript.
5. **Si tu n'es pas sûr** d'une modification, pose la question dans le rapport plutôt que de deviner.
6. **Documente** chaque changement non trivial avec un commentaire dans le code.

---

**Commence par lire les 4 fichiers de référence, puis analyse et agis.**

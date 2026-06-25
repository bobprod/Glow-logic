# C10 — Sécurité : authentification API locale + safety gate bloquant

**Dépend de :** C9 (badge/санté), C8a (menu Outils) recommandé | **Bloque :** tout premier show réel | **Priorité :** 🔴 P0 avant production (P1 tant que les sorties physiques dangereuses restent simulées)
**Fichiers à charger en contexte :**
- `apps/server/index.ts` (CORS, routes, Socket.IO)
- `apps/server/services/safetyGate.ts`
- `apps/server/services/dmxRouter.ts` (post-C9)
- `apps/server/services/database.ts` (`app_settings`)
- `apps/web/src/lib/socket.ts`, `apps/web/src/lib/config.ts`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

L'API (76 routes) et le Socket.IO sont ouverts en CORS `*` sans aucune authentification : n'importe quel appareil du réseau local (Wi-Fi de salle, invités) peut armer le laser, lire les projets, consommer les clés LLM. Le `safetyGate` est consultatif : `validateSafetyAction()` retourne `allowed: false` mais ne bloque rien. Objectif : un **token local de pairing** (modèle « clé d'appareil », zéro friction pour l'utilisateur légitime) + un safety gate **bloquant** au niveau du dispatch.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/server/middleware/auth.ts` |
| Modifier | `apps/server/index.ts` (middleware global, CORS restreint, auth Socket.IO, route bootstrap) |
| Modifier | `apps/server/services/safetyGate.ts` (enforcement) |
| Modifier | `apps/server/services/showActions.ts` + `services/liveControl.ts` (vérification avant exécution laser/pyro) |
| Modifier | `apps/web/src/lib/config.ts` + `apps/web/src/lib/socket.ts` (header/token) |
| Modifier | `apps/web/src/components/ui/SettingsModal.tsx` (onglet Sécurité : affichage/régénération du token, pairing) |

## 3. État existant

- `index.ts` : CORS `*`, JSON 10MB, aucune vérification sur aucune route ni sur la connexion socket.
- `safetyGate.ts` : rôles beginner/expert/admin, armement laser/pyro/drone/external_api, règles (pas d'armement par IA, laser plafonné 64/255, sorties physiques bloquées en MVP) — mais tout est **consultatif**.
- `app_settings` (SQLite) : stockage clé-valeur disponible pour le token.

## 4. Spécification comportementale

### Authentification (pairing local)

- **S1** — QUAND le serveur démarre et qu'aucun `api_token` n'existe dans `app_settings` ALORS il en génère un (32 octets aléatoires, hex) et le stocke. Le token n'est JAMAIS loggé.
- **S2** — QUAND une requête arrive sur `/api/*` ALORS le middleware exige `Authorization: Bearer <token>` — sauf trois exceptions : `GET /api/health` (nouveau, statut minimal sans données), `POST /api/auth/bootstrap` (S3), et les assets Next. Échec → `401 {error:'unauthorized'}`. Même règle pour la connexion Socket.IO (`auth.token` dans le handshake ; connexion refusée sinon).
- **S3** — QUAND `POST /api/auth/bootstrap` est appelé **depuis la machine locale** (adresse distante loopback `127.0.0.1`/`::1` uniquement) ALORS il retourne le token — c'est le pairing automatique du frontend servi sur la même machine. Depuis une autre IP → `403` et le pairing se fait manuellement : l'utilisateur saisit le token (affiché dans Réglages → Sécurité sur la machine régie) sur l'appareil distant (tablette), stocké en localStorage `glowlogic_auth`.
- **S4** — QUAND le frontend démarre ALORS `lib/config.ts` résout le token : localStorage → sinon bootstrap → sinon écran de pairing (champ de saisie + QR du token affichable depuis Réglages → Sécurité). Toutes les requêtes `fetch` et le socket utilisent ensuite ce token (un wrapper `apiFetch()` centralisé dans `lib/config.ts` remplace les `fetch` directs — migration mécanique).
- **S5** — QUAND l'utilisateur clique `Régénérer le token` (Réglages → Sécurité, confirmation requise) ALORS nouveau token, toutes les sessions distantes sont invalidées, la machine locale se re-bootstrape seule.
- **S6** — QUAND le serveur configure CORS ALORS `*` est remplacé par une liste : `http://localhost:3000` + les origines ajoutées explicitement (setting `allowed_origins`). Le serveur écoute sur `0.0.0.0` (accès tablette conservé) — c'est le token qui protège, le CORS limite les attaques par navigateur.

### Safety gate bloquant

- **S7** — QUAND une action de type laser/pyro/drone est demandée (routes `/api/safety/arm`, `/api/show-actions`, handlers `liveControl`) ALORS `safetyGate.validateSafetyAction()` est appelé **par le serveur** et un refus INTERROMPT l'exécution avec `403 {error, reason}` — plus aucun chemin de code n'exécute après un `allowed: false`. Audit : chaque refus est inscrit dans `supportLog` avec l'origine (IP, route).
- **S8** — QUAND `dmxRouter` (post-C9) dispatche vers une sortie marquée dangereuse ALORS — tant que le mapping canal→hazard n'existe pas — la règle MVP est conservée mais **centralisée dans le routeur** : si `safetyGate` indique `physicalDangerousOutputsEnabled === false`, les canaux appartenant aux fixtures de type `laser`/`pyro` (résolus via `fixtureResolver`) sont clampés à 0 côté serveur. Une seule source d'enforcement, plus de duplication par appelant.
- **S9** — QUAND l'armement laser ou pyro est actif ALORS il expire automatiquement après 30 minutes sans ré-armement (dead-man simple), avec toast côté frontend à l'expiration.

## 5. Modèle de données

```ts
// app_settings (SQLite) — nouvelles clés
api_token: string;            // hex 64 chars
allowed_origins: string;      // JSON array, défaut ["http://localhost:3000"]

// localStorage frontend
glowlogic_auth: { token: string };

// apps/server/middleware/auth.ts
export function requireAuth(req, res, next): void;     // Bearer check
export function isLoopback(req): boolean;
```

## 6. Critères d'acceptation

- **AC1** (S1-S2) : `curl http://<ip>:3005/api/projects` sans token → 401 ; avec token → 200 ; connexion socket sans token refusée.
- **AC2** (S3-S4) : sur la machine régie, l'app fonctionne sans aucune saisie (bootstrap transparent) ; depuis une tablette, l'écran de pairing accepte le token et tout fonctionne.
- **AC3** (S5) : régénérer le token coupe la tablette (401) jusqu'à re-pairing, sans casser la machine locale.
- **AC4** (S7) : armer le laser en rôle `beginner` → 403 + entrée supportLog ; aucun effet.
- **AC5** (S8) : avec les sorties dangereuses désactivées, une trame DMX visant un canal laser sort à 0 quel que soit le chemin d'appel (fader, pad, timeline, show-action).
- **AC6** (S9) : armement expiré après 30 min → désarmé + toast.
- **AC7** : `npm run build` (web) passe ; tests smoke backend (`apps/server/tests/api-smoke.ts`) mis à jour avec le token et passants.

## 7. Hors scope

- Pas de multi-utilisateurs, rôles par compte, ni HTTPS/TLS (réseau local de confiance + token ; TLS = itération ultérieure si accès hors machine).
- Pas de chiffrement de la base SQLite ni des clés LLM au repos.
- Pas de rate-limiting.
- Ne pas toucher : moteur DMX frontend, UI hors Réglages→Sécurité et écran de pairing.

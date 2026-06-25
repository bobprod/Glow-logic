# Welcome to Glow Logic

## How We Use Claude

Based on usage over the last 30 days:

Work Type Breakdown:
  Plan Design      ████████████░░░░░░░░  50%
  Debug Fix        █████░░░░░░░░░░░░░░░  25%
  Improve Quality  █████░░░░░░░░░░░░░░░  25%

Top Skills & Commands:
  /model  ████████████████████  6x/month

Top MCP Servers:
  ccd_session  ████████████████████  16 calls

## Your Setup Checklist

### Codebases
- [ ] glow-logic — github.com/bobprod/glow-logic
  - Monorepo : `apps/web` (Next.js 16 + React 18 + Zustand + Three.js, port 3000) et `apps/server` (Express + Socket.IO + SQLite, port 3005)
  - `npm install` à la racine, puis `npm run start` (ou raccourci bureau `Glow Logic.lnk`)
  - Docs clés : `README.md`, `docs/DEVELOPER_GUIDE.md`, `docs/API_REFERENCE.md`, `glow_logic_ultimate_spec.md` (cahier des charges)

### MCP Servers to Activate
- [ ] ccd_session — Claude Code Desktop session tooling (chapters, background task chips). Comes built-in with the Claude Code desktop app — no setup needed.

### Skills to Know About
- /model — switch the Claude model mid-session (e.g. for faster or deeper reasoning depending on the task)

## Team Tips

- **Toujours valider avant de considérer un chantier fini** : `npm run typecheck --workspaces`, `npm run lint --workspace web`, `npm run test:unit`, `npm run test:api`. Le gate complet release candidate : `npm run release:check`.
- **Smoke test terrain sans navigateur** : `npm run test:field` (démarre une API, vérifie auth, licence, safety, sync BPM, DMX, export/import `.glowproject`). À lancer avant tout show réel.
- **Problème connu Windows : `npm run build` échoue sur `spawn EPERM`** (antivirus / Controlled Folder Access). Diagnostic : `npm run doctor:eperm` + `docs/WINDOWS_EPERM_DIAGNOSTIC.md`. Ne pas perdre de temps à le re-déboguer.
- **Journal de session obligatoire** : chaque chantier est consigné dans `memory/YYYY-MM-DD.md` (quoi, fichiers touchés, validations passées). C'est la mémoire du projet entre sessions Claude — lis le fichier du jour avant de commencer.
- **Architecture à connaître** : le store Zustand est découpé en 8 slices (`apps/web/src/store/slices/`) ; le moteur DMX 44Hz vit dans `apps/web/src/lib/dmxEngine.ts` ; la base SQLite (8 tables : projects, fixtures, scenes, cue_lists, fixture_groups, venue_profiles, library_items, app_settings) est gérée par `apps/server/services/database.ts`.
- **Sécurité non négociable** : toute commande IA passe par le Safety Gate (`apps/server/services/safetyGate.ts`). Laser/pyro nécessitent un armement manuel explicite. Ne jamais contourner ce filtre, même pour un test.
- **Suivi d'itérations** : l'état du projet et les écarts restants sont dans `REANALYSIS_ITER_2.md` (score ~95% du cahier des charges). Vérifie ce fichier avant de proposer une nouvelle fonctionnalité — elle existe peut-être déjà.

## Get Started

Tâche de démarrage suggérée (issue de `REANALYSIS_ITER_2.md`, itération 3) :

1. Lance l'app (`npm run start`), ouvre http://localhost:3000, fais le Guided Tour (bouton **?** dans la TopBar).
2. Lance `npm run test:field` pour voir le pipeline de validation passer en entier.
3. Premier vrai chantier : **corriger la config ESLint v9** (`npm run lint` à la racine retourne `Premature close`) — écart N1 haute priorité documenté dans `REANALYSIS_ITER_2.md`. Petit, bien délimité, et te fait toucher la config du monorepo.

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->

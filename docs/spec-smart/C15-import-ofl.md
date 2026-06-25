# C15 — Import de profils Open Fixture Library (OFL)

**Dépend de :** Porte 1 (05-PLAN-VAGUE-2) | **Bloque :** — | **Priorité :** 🔴 P0 vague 2 (levier TTFL n°1)
**Fichiers à charger en contexte :**
- `apps/server/services/fixtureProfileParser.ts` (parser existant, `parseFixtureProfileFile` ligne ~198)
- `apps/server/index.ts` (endpoint `/api/fixtures/import-profile` ligne ~896)
- `apps/server/services/database.ts` (table fixtures, `saveFixture`)
- `apps/web/src/components/smart/SmartSidebar.tsx` (rôle `library`)
- `apps/web/src/types/dmx.ts` (DmxChannel types)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Aujourd'hui, patcher un projecteur exige soit le scan OCR/LLM d'un manuel, soit la saisie manuelle des canaux. L'**Open Fixture Library** (open-fixture-library.org) publie ~1000 profils communautaires en JSON librement réutilisables (licence MIT pour le schéma, données CC0/CC-BY) avec téléchargement par fixture au format `OFL JSON`. Importer ces profils fait tomber le time-to-first-light plus que n'importe quelle feature UI : « je cherche mon projecteur, je clique, il est patché ».

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/server/services/oflParser.ts` |
| Modifier | `apps/server/services/fixtureProfileParser.ts` (router les `.json` OFL vers oflParser) |
| Modifier | `apps/server/index.ts` (endpoint recherche locale + import par fichier inchangé) |
| Créer | `apps/web/src/components/smart/OflImportPanel.tsx` |
| Modifier | `apps/web/src/components/smart/SmartSidebar.tsx` (entrée dans le rôle `library`) |

## 3. État existant

- `parseFixtureProfileFile(fileName, buffer)` parse déjà `.qxf` (QLC+) et formats génériques ; l'endpoint `POST /api/fixtures/import-profile` (multipart `profile`) renvoie le profil parsé puis le frontend appelle `POST /api/fixtures` pour sauvegarder. Le smoke test couvre ce flux (`api-smoke.ts:161`).
- La sidebar rôle `library` (C8b) affiche des accordéons Fixtures/Nœuds/Looks/Médias.
- Pas d'accès internet garanti en salle : l'import doit marcher **par fichier local** d'abord, la recherche en ligne est un plus.

## 4. Spécification comportementale

### Backend — parser OFL

- **S1** — QUAND `parseFixtureProfileFile` reçoit un `.json` ALORS il tente `oflParser.parseOflJson(buffer)` ; si le JSON ne ressemble pas à un profil OFL (pas de clé `availableChannels` ni `modes`), comportement antérieur conservé (erreur formatée existante).
- **S2** — QUAND `parseOflJson` traite un profil OFL ALORS il produit la même structure `ParsedFixtureProfile` que les autres parsers : `name` (clé `name`), `manufacturer` (clé `manufacturerKey` ou champ `manufacturer.name` si présent), et pour CHAQUE entrée de `modes[]` un mode `{ name: mode.name, channels: [...] }` où chaque canal est résolu depuis `availableChannels` dans l'ordre de `mode.channels` (les `null` d'OFL = canal vide → type `custom`, nom `Non utilisé`).
- **S3** — QUAND un canal OFL est mappé ALORS la correspondance de types est : capability `Intensity`→`dimmer` ; `ColorIntensity` avec `color` Red/Green/Blue/White/Amber/UV → `red/green/blue/white/amber/uv` ; `Pan`/`Tilt` (et leurs `Fine`) → `pan`/`tilt` (fine : suffixe ` fine`, même type) ; `ShutterStrobe`→`strobe` ; `ColorWheel`/`WheelSlot` couleur → `color` ; gobo wheel → `gobo` ; `Prism`→`prism` ; `Zoom`→`zoom` ; `Focus`→`focus` ; `Speed`→`speed` ; tout le reste → `custom`. Les `capabilities[]` OFL (plages dmxRange + label) sont concaténées dans `function`/`notes` du canal (max 500 caractères, tronqué).
- **S4** — QUAND le profil contient des modes 16 bits (canaux Fine) ALORS ils sont conservés tels quels (le moteur gère déjà coarse+fine pour pan/tilt).

### Frontend — panneau d'import

- **S5** — QUAND l'utilisateur ouvre la sidebar rôle `library` ALORS un accordéon `Profils de projecteurs (OFL)` apparaît avec : zone drop/sélection de fichier `.json` (et `.qxf`, réutilise l'endpoint existant) + champ recherche en ligne.
- **S6** — QUAND un fichier est déposé ALORS `POST /api/fixtures/import-profile` → aperçu (nom, fabricant, liste des modes avec nb de canaux) → l'utilisateur choisit le mode et l'adresse DMX de départ (défaut : première adresse libre de l'univers 1, calculée depuis les fixtures existantes) → `POST /api/fixtures` → toast `Projecteur <nom> ajouté (<mode>, @<adresse>)` et la fixture apparaît dans la liste/plan.
- **S7** — QUAND l'utilisateur tape ≥ 3 caractères dans la recherche en ligne ET que le navigateur est en ligne ALORS le frontend interroge directement `https://open-fixture-library.org/api/v1/...` n'est PAS utilisé (API non garantie stable) — à la place : lien `Ouvrir open-fixture-library.org` (nouvel onglet, recherche pré-remplie) + hint `Téléchargez le format « OFL JSON » puis déposez-le ici`. (Décision : pas de dépendance à une API tierce non contractuelle ; l'import reste 2 clics.)
- **S8** — QUAND le navigateur est hors-ligne ALORS la zone fichier reste pleinement fonctionnelle et le lien en ligne est grisé avec hint `Hors ligne`.

## 5. Modèle de données

```ts
// apps/server/services/oflParser.ts
export interface OflParseResult { /* = ParsedFixtureProfile existant — réutiliser le type du fixtureProfileParser */ }
export function isOflJson(data: unknown): boolean;        // présence de availableChannels/modes
export function parseOflJson(buffer: Buffer): ParsedFixtureProfile; // throw Error("Profil OFL invalide: <raison>") sinon
```

Aucun nouvel état store : le panneau utilise un état local + les endpoints existants.

## 6. Wireframe textuel

```
Sidebar — rôle 📚 Bibliothèque
▾ Profils de projecteurs (OFL)
┌──────────────────────────────────┐
│ ⤓ Déposez un profil .json / .qxf │
│   ou [Choisir un fichier]        │
│ 🔍 [shehds led beam …        ]   │
│    ↳ Ouvrir open-fixture-library.org ↗
│      Téléchargez « OFL JSON »    │
│      puis déposez-le ici         │
└──────────────────────────────────┘
Aperçu après dépôt :
┌──────────────────────────────────┐
│ Beam 230 — Shehds                │
│ Mode  [16 canaux ▼]  Adresse [33]│
│ 16 canaux : Pan, Pan fine, Tilt… │
│        [Ajouter le projecteur]   │
└──────────────────────────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1-S3) : un fichier OFL JSON réel (ex. profil 2 modes avec pan/tilt fine, roue couleur, gobos) importé → tous les modes présents, types de canaux corrects (pan/tilt/dimmer/red…/gobo/strobe), capabilities dans les notes.
- **AC2** (S1) : un `.json` non-OFL → message d'erreur clair, pas de crash ; un `.qxf` → comportement antérieur intact (smoke test existant vert).
- **AC3** (S6) : flux complet fichier → aperçu → choix mode/adresse → fixture en base → visible dans la bibliothèque et patchable sur le plan ; l'adresse proposée par défaut ne chevauche aucune fixture existante.
- **AC4** (S7-S8) : lien externe avec recherche pré-remplie en ligne ; zone fichier fonctionnelle hors-ligne.
- **AC5** : test unitaire `apps/server/tests` ou `apps/web/tests` pour `parseOflJson` (fixture JSON minimale embarquée dans le test : 1 mode, 4 canaux dont 1 null) ; `test:api` vert.
- **AC6** : `npm run build` vert ; aucune dépendance npm ajoutée.

## 8. Hors scope

- Pas de téléchargement automatique depuis l'API OFL ni de mirror local de la bibliothèque (itération ultérieure si le besoin est prouvé).
- Pas de GDTF (format zip complexe — entrée backlog séparée si demandé).
- Pas de modification du scan OCR/LLM existant ni de la page /fixtures.
- Pas d'éditeur de profil (l'édition passe par la page fixtures existante).

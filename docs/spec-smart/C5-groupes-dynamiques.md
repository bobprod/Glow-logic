# C5 — Groupes DMX dynamiques, faders mappables, VU-mètres

**Dépend de :** C1, C3 (table de routage MIDI) | **Bloque :** C6 | **Priorité :** 🟡 P1
**Fichiers à charger en contexte :**
- `apps/web/src/components/SmartDashboard.tsx` (uniquement `renderGroupStrips` lignes ~1029-1118)
- `apps/web/src/store/slices/showPlayerSlice.ts`
- `apps/web/src/store/slices/projectSlice.ts`
- `apps/web/src/components/MidiListener.tsx`
- `apps/web/src/components/widgets/VerticalFader.tsx`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Les 6 groupes (Face, Douche 1-3, Latéral, Contre) sont codés en dur dans `showPlayerSlice.ts` : impossible d'adapter la console à un kit différent (4 groupes mariage, 8 groupes club + strobe). On rend les groupes dynamiques (CRUD + réorganisation), chaque fader mappable MIDI, avec VU-mètre d'activité DMX et presets de configuration.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/GroupStrips.tsx` (extraction de `renderGroupStrips`) |
| Modifier | `apps/web/src/store/slices/showPlayerSlice.ts` (modèle `DmxGroup`, migration) |
| Modifier | `apps/web/src/store/slices/projectSlice.ts` (sérialisation `dmxGroups` + presets) |
| Modifier | `apps/web/src/components/MidiListener.tsx` (routes `group_<id>_level` / `_mute`, absorption auto-map APC) |
| Modifier | `apps/web/src/components/SmartDashboard.tsx` (remplacer `renderGroupStrips` par `<GroupStrips />`) |

## 3. État existant (réfs vérifiées)

- `showPlayerSlice.ts` : `groupLevels` ligne 23 (Record clé = nom FR), défauts lignes 93-100 (`'Face': 100`, … `'Contre': 80`) ; `groupMutes` lignes 101-108 ; `groupColors` lignes 109-116 ; setters lignes 143-149 (clé = nom du groupe).
- `SmartDashboard.tsx` : `renderGroupStrips` ligne 1029 (master dimmer + 6 faders verticaux + pastille couleur + MUTE) ; alias backend `LIVE_GROUP_ALIASES` ~77-90 (mapping nom FR → zone backend).
- `MidiListener.tsx` : auto-map APC en dur — CC48 → `setGroupLevel('Face', …)` ligne 175, CC48-56 lignes 172-187, notes 64-71 → mutes lignes 188-198 ; après C3 ces blocs vivent dans la table `MIDI_ROUTES`.

## 4. Spécification comportementale

- **S1** — QUAND le store est hydraté sans `dmxGroups` ALORS les 6 groupes par défaut sont générés (`id` slug : `face`, `douche-1`, `douche-2`, `douche-3`, `lateral`, `contre`) en recopiant `groupLevels/Mutes/Colors` existants (migration `01-CONVENTIONS.md §5`). Les Records `groupLevels/Mutes/Colors` sont re-clés par `group.id` (plus par nom).
- **S2** — QUAND le widget Groupes est affiché ALORS `GroupStrips.tsx` rend : le Master Dimmer (inchangé) + un fader vertical par `dmxGroups` trié par `order`, chaque strip : pastille couleur (clic = color picker existant), fader, % en `font-mono`, bouton MUTE, **VU-mètre** (S6), badge 🎹 si mappé.
- **S3** — QUAND `smartEditMode === true` ALORS chaque strip affiche : poignée de drag (réordonner, met à jour `order`), icône ✎ (renommage inline, Enter valide / Échap annule), icône 🗑 (suppression avec confirmation `Supprimer le groupe "<nom>" ?` ; bloquée si `showLock`). Un bouton `+ Groupe` en fin de rangée crée un groupe (`nom = "Groupe <n>"`, couleur cyan, niveau 80, `fixtureIds: []`). Limite : 12 groupes max (bouton désactivé au-delà, tooltip `Maximum 12 groupes`).
- **S4** — QUAND un groupe est créé ou édité ALORS l'assignation des fixtures se fait dans l'inspecteur groupe de la sidebar (C3 `GroupInspectorPanel`) : section `FIXTURES DU GROUPE` avec liste à cocher des fixtures patchées (`fixtureIds`).
- **S5** — QUAND `midiLearnMode` est actif ALORS clic sur un fader → cible `group_<id>_level` (CC), clic sur MUTE → `group_<id>_mute` (Note On) ; pattern visuel `widgets/VerticalFader.tsx` existant. En lecture, les routes `group_` de la table `MIDI_ROUTES` pilotent `setGroupLevel(id, Math.round(data2 * 100 / 127))` et le toggle mute.
- **S6** — QUAND du DMX sort sur les canaux des fixtures d'un groupe ALORS le strip affiche un VU-mètre : barre verticale fine (3px) à côté du fader, hauteur = max des valeurs dimmer des fixtures du groupe (échantillonné à ≤ 10 Hz via un subscribe sur le dmxEngine ou un `setInterval` lisant `getChannel` — ne PAS s'abonner à 44 Hz dans React). Gradient vert → jaune (>70%) → rouge (>90%).
- **S7** — QUAND l'utilisateur ouvre le menu `Presets` (bouton dans le header du widget) ALORS il peut : `Sauvegarder la config actuelle…` (nom saisi → snapshot des `dmxGroups` + niveaux), `Charger <preset>` (remplace les groupes après confirmation), `Supprimer <preset>`. Presets persistés et inclus dans la sauvegarde projet.
- **S8** — QUAND l'auto-map APC héritée s'exécute ALORS elle cible désormais les groupes **par ordre** : CC48 → groupe `order 0`, CC49 → `order 1`, … CC53 → `order 5` ; notes 64-69 → mutes par ordre. S'il y a moins de groupes que de faders, les CC excédentaires sont ignorés.
- **S9** — QUAND un projet pré-C5 est chargé ALORS la migration S1 s'applique ; `LIVE_GROUP_ALIASES` (zones backend) est re-clé : chaque `DmxGroup` gagne un champ optionnel `backendZone?: string` initialisé depuis l'alias existant pour les 6 groupes par défaut, `undefined` pour les nouveaux (l'émission socket `smart:zone_intensity` n'est envoyée que si `backendZone` est défini).
- **S10** — **(Amendement audit global, voir `02-AUDIT-GLOBAL.md §5-A1)`** QUAND un groupe est créé/modifié/supprimé ALORS le CRUD est **synchronisé avec l'API backend existante `/api/fixture-groups`** (table SQLite `fixture_groups` : `id, name, role, color, fixture_ids`) : mise à jour optimiste du store puis `POST`/`DELETE` ; au chargement, `GET /api/fixture-groups` est la source de vérité (le localStorage n'est qu'un cache). Mapping : `DmxGroup.id` = id DB (converti en string), `DmxGroup.backendZone` ↔ colonne `role`. En cas d'échec réseau : toast warning `Groupe non synchronisé (hors ligne)` et re-tentative au prochain chargement. Interdit de créer un modèle de groupes client-only — il existe déjà 2 modèles (frontend en dur + table backend), C5 doit les UNIFIER, pas en ajouter un 3e.

## 5. Modèle de données

```ts
// showPlayerSlice.ts — ajouts/modifications
export interface DmxGroup {
  id: string;            // slug stable, généré à la création (nanoid ou slug du nom + suffixe)
  name: string;
  color: string;         // hex
  fixtureIds: string[];  // nodeIds des fixtures patchées
  order: number;
  backendZone?: string;  // alias zone backend (Face, Piste, Bar, Dancefloor, Fond)
}

dmxGroups: DmxGroup[];                                  // cache localStorage + projet — source de vérité = GET /api/fixture-groups (S10)
fetchDmxGroups: () => Promise<void>;                    // GET /api/fixture-groups au montage
addDmxGroup: () => void;                                // garde max 12
updateDmxGroup: (id: string, updates: Partial<DmxGroup>) => void;
deleteDmxGroup: (id: string) => void;
reorderDmxGroups: (fromOrder: number, toOrder: number) => void;

groupLevels: Record<string, number>;   // re-clé par DmxGroup.id
groupMutes: Record<string, boolean>;   // idem
groupColors: Record<string, string>;   // idem (redondant avec DmxGroup.color → DmxGroup.color devient la source, supprimer groupColors à la migration)

export interface GroupPreset {
  id: string;
  name: string;
  groups: DmxGroup[];
  levels: Record<string, number>;
}
groupPresets: GroupPreset[];                            // persisté + projet
saveGroupPreset: (name: string) => void;
applyGroupPreset: (id: string) => void;
deleteGroupPreset: (id: string) => void;
```

## 6. Wireframe textuel

```
GROUPES DMX (widget central) — mode normal
┌────────────────────────────────────────────────────────────────────┐
│ MASTER DIMMER ━━━━━━━━━━━━━━━━━━━━●━━ 100%        [Presets ▼]      │
├────────────────────────────────────────────────────────────────────┤
│  ●白      ●蓝      ●绿      ●红      ●白      ●蓝                  │ ← pastilles couleur
│  ┃▌      ┃▌      ┃▌      ┃▌      ┃▌      ┃▌                      │ ← fader + VU 3px
│  100%    100%     68%     80%     62%     61%                      │
│ [MUTE]  [MUTE]  [MUTE]  [MUTE]  [MUTE]  [MUTE]                     │
│  Face   Douche1 Douche2 Douche3 Latéral  Contre  🎹                │
└────────────────────────────────────────────────────────────────────┘
Mode édition : chaque strip → [⠿ drag] [✎ renommer] [🗑]   …  [+ Groupe]
Menu Presets : Sauvegarder la config actuelle… / Config Mariage / Config Club / 🗑
```

## 7. Critères d'acceptation

- **AC1** (S1, S9) : un état pré-C5 se charge avec 6 groupes identiques (niveaux, mutes, couleurs, zones backend conservés).
- **AC2** (S2, S3) : ajout/renommage/suppression/réorganisation de groupes en edit mode ; limite 12 ; suppression bloquée par showLock.
- **AC3** (S4) : assignation de fixtures à un groupe via l'inspecteur sidebar.
- **AC4** (S5) : MIDI Learn sur fader et mute d'un groupe créé dynamiquement ; le contrôleur physique les pilote.
- **AC5** (S6) : VU-mètres animés pendant qu'une scène joue, sans chute de FPS (échantillonnage ≤ 10 Hz).
- **AC6** (S7) : sauvegarde/chargement/suppression de presets de groupes, persistés dans le projet.
- **AC7** (S8) : l'APC mini pilote les 6 premiers groupes par ordre.
- **AC8** : `npm run build` passe.

## 8. Hors scope

- Ne pas toucher : `lib/dmxEngine.ts`, SceneController (C2), FixtureInspectorPanel hors section fixtures-du-groupe, MacroTimeline, TopBar, vue CREATOR.
- Pas de groupes imbriqués ni de sous-groupes.
- Pas de solo (uniquement mute, comme l'existant).
- Le routage DMX réel des niveaux de groupe vers les fixtures (logique `handleZoneChange` existante) n'est modifié que pour être re-clé par `group.id` — pas de refonte du dispatch.

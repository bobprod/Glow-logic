# C9 — Fiabilité des sorties DMX : erreurs visibles, badge par sortie

**Dépend de :** C1 | **Bloque :** — | **Priorité :** 🔴 P0 (inséré après C4, AVANT C5-C7)
**Fichiers à charger en contexte :**
- `apps/server/services/dmxRouter.ts`
- `apps/server/services/usbDmx.ts`, `apps/server/services/pythonDmx.ts`, `apps/server/services/qlc.ts`, `apps/server/services/artnet.ts`, `apps/server/services/qlcWsService.ts` (lire leurs `getStatus()`/états internes)
- `apps/server/index.ts` (handler socket `dmx_update`, émissions `dmx_bridge_status`)
- `apps/web/src/components/TopBar.tsx`
- `apps/web/src/store/slices/smartModeSlice.ts` (`dmxOutputs`)
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

Le `dmxRouter` backend dispatche chaque canal vers 5 sorties avec des `try {} catch {}` **silencieux** (lignes 51, 59, 66, 74, 82 de `dmxRouter.ts`) : l'utilisateur bouge un fader, l'UI réagit, et rien ne sort des projecteurs sans aucun signal. C'est le pire échec possible pour un logiciel de régie live. Objectif : chaque sortie a un état de santé visible en temps réel dans la TopBar, et toute transition OK→échec produit un toast immédiat.

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/server/services/outputHealth.ts` (collecteur d'état des sorties) |
| Modifier | `apps/server/services/dmxRouter.ts` (signaler les erreurs au collecteur au lieu de les avaler) |
| Modifier | `apps/server/index.ts` (émission socket `dmx_output_status` + endpoint `GET /api/dmx/output-status`) |
| Créer | `apps/web/src/components/smart/DmxStatusBadge.tsx` (badge TopBar + popover détail) |
| Modifier | `apps/web/src/components/TopBar.tsx` (remplacer le badge « DMX » statique, ligne ~545) |
| Modifier | `apps/web/src/store/slices/smartModeSlice.ts` (état `dmxOutputHealth`) |

## 3. État existant (réfs vérifiées)

- `dmxRouter.ts` : `setChannel` lignes 46-85 — 4 sorties actives (`pythonDmx` ligne 51, `qlcWs` 59, `sendDmxValue` OSC 64, `sendArtNetValue` 72, `usbDmx` 80), toutes en catch vide. `getOutputs()` ligne 41. Appelé à 44 Hz par le handler socket `dmx_update`.
- Existant côté statut : `usbDmx.getStatus().connected` (utilisé ligne 34), socket `dmx_bridge_status` déjà émis par `pythonDmx` (ready/error), `GET /api/qlc/engine-status` pollé par la TopBar (ligne ~99 de TopBar.tsx), `GET /api/dmx/usb-status`.
- TopBar : badge texte `DMX` statique ligne ~545, sans aucune donnée derrière.
- Particularités par sortie : Art-Net = UDP (échec d'envoi rare, la cible morte ne génère PAS d'exception → santé basée sur l'envoi seulement, fiabilité « best effort » à afficher comme telle) ; OSC QLC+ = idem UDP ; USB/Python = erreurs réelles détectables + état de connexion.

## 4. Spécification comportementale

### Backend — collecte

- **S1** — QUAND le serveur démarre ALORS `outputHealth.ts` expose un singleton avec, pour chaque sortie (`python`, `qlcOsc`, `qlcWs`, `artNet`, `usbDmx`) : `{ enabled: boolean; state: 'ok' | 'degraded' | 'error' | 'off'; lastOkAt: number | null; lastErrorAt: number | null; lastErrorMessage: string | null; errorCount: number }`.
- **S2** — QUAND `dmxRouter.setChannel` attrape une exception d'une sortie ALORS il appelle `outputHealth.reportError(outputId, err)` (et `reportOk(outputId)` sur succès). Contraintes de performance à 44 Hz : `reportOk` ne fait qu'écrire un timestamp (pas d'allocation, pas de log) ; `reportError` log au plus 1 fois par 5 s par sortie dans `supportLog`.
- **S3** — QUAND on évalue l'état d'une sortie ALORS : `off` = désactivée dans la config ; `error` = exception attrapée dans les 5 dernières secondes OU connexion rapportée morte par le service (`usbDmx.getStatus().connected === false`, bridge Python non-ready) ; `degraded` = erreurs présentes mais plus récentes que 5 s avec des succès depuis ; `ok` sinon. Les sorties UDP (artNet, qlcOsc) ne peuvent être que `ok`/`off`/`error d'envoi local` — leur popover affiche la mention `Envoi best-effort (UDP, pas d'accusé de réception)`.
- **S4** — QUAND l'état agrégé change OU toutes les 5 s (heartbeat) ALORS le serveur émet le socket `dmx_output_status` avec le snapshot complet des 5 sorties. JAMAIS d'émission par canal ni à 44 Hz. Un endpoint `GET /api/dmx/output-status` retourne le même snapshot (état initial au chargement de la page).

### Frontend — visibilité

- **S5** — QUAND le frontend reçoit `dmx_output_status` ALORS `dmxOutputHealth` (smartModeSlice, NON persisté) est mis à jour. Le badge `DMX` de la TopBar devient `DmxStatusBadge` : point de couleur + texte `DMX`. Couleur agrégée : vert = toutes les sorties activées sont `ok` ; ambre = au moins une `degraded` ou aucune sortie activée ; rouge = au moins une sortie activée en `error` ; gris éteint si `previewMode === true` (cohérence C6-S8, le tooltip dit alors `Preview : sorties coupées`).
- **S6** — QUAND l'utilisateur clique le badge ALORS un popover liste les 5 sorties : nom lisible (`USB DMX (UTD-10)`, `Bridge Python (COMx)`, `Art-Net`, `QLC+ OSC`, `QLC+ WebSocket`), dot d'état, dernier succès (`il y a 3 s`, `font-mono`), dernier message d'erreur (1 ligne, ellipsis), et un bouton `Configurer…` qui ouvre le menu Outils → la section Sorties DMX (réutilise `setOpenTool` de C1 ou l'onglet DMX de la SettingsModal — choisir l'existant le plus direct, ne pas créer de nouvelle modal).
- **S7** — QUAND une sortie activée passe de `ok`/`degraded` à `error` ALORS un toast `error` est affiché une seule fois par transition : `Sortie <nom> en échec — <message court>` (anti-spam : pas de re-toast tant que la sortie n'est pas repassée `ok` au moins 10 s). QUAND elle repasse `ok` après une erreur ALORS toast `success` : `Sortie <nom> rétablie`.
- **S8** — QUAND le socket frontend↔backend est déconnecté ALORS le badge passe rouge avec tooltip `Backend déconnecté — aucune sortie DMX` (prioritaire sur tout le reste ; réutiliser l'état de connexion socket existant du dot backend C1-S2, ne pas créer un deuxième listener).

## 5. Modèle de données

```ts
// apps/server/services/outputHealth.ts
export type OutputId = 'python' | 'qlcOsc' | 'qlcWs' | 'artNet' | 'usbDmx';
export interface OutputState {
  enabled: boolean;
  state: 'ok' | 'degraded' | 'error' | 'off';
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  errorCount: number;
}
export interface OutputHealthSnapshot { outputs: Record<OutputId, OutputState>; at: number; }

reportOk(id: OutputId): void;
reportError(id: OutputId, err: unknown): void;
getSnapshot(config: OutputConfig): OutputHealthSnapshot;
onChange(cb: (snap: OutputHealthSnapshot) => void): void;  // déclenché sur changement d'état agrégé (debounce 250ms)
```

```ts
// smartModeSlice.ts — ajout (NON persisté, exclu du partialize)
dmxOutputHealth: OutputHealthSnapshot | null;
setDmxOutputHealth: (snap: OutputHealthSnapshot) => void;
```

## 6. Wireframe textuel

```
TOPBAR                          Popover (clic badge)
… 🕐 02:21:50  ●DMX  LASER …    ┌──────────────────────────────────────┐
        rouge ──┘               │ SORTIES DMX                          │
                                │ ● USB DMX (UTD-10)   il y a 2 s   ok │
                                │ ● Bridge Python COM5  ERREUR         │
                                │   └ Write timeout (x12)              │
                                │ ● Art-Net             il y a 0 s  ok │
                                │   └ best-effort UDP                  │
                                │ ○ QLC+ OSC            désactivée     │
                                │ ○ QLC+ WebSocket      désactivée     │
                                │              [ Configurer… ]         │
                                └──────────────────────────────────────┘
Toast transition : 🔴 « Sortie Bridge Python en échec — Write timeout »
```

## 7. Critères d'acceptation

- **AC1** (S1-S3) : débrancher le dongle USB pendant qu'une scène joue → badge rouge en ≤ 5 s, popover montre l'erreur, `supportLog` contient au plus 1 entrée par 5 s.
- **AC2** (S4) : aucune émission socket `dmx_output_status` à plus de ~1/s en régime stable (vérifiable par compteur dans les devtools réseau) ; FPS du moteur 44 Hz inchangé.
- **AC3** (S5) : badge vert quand tout va bien, gris en previewMode, rouge si socket backend coupé (S8).
- **AC4** (S6) : popover liste les 5 sorties avec horodatages ; `Configurer…` ouvre la config existante.
- **AC5** (S7) : une panne génère exactement 1 toast (pas de spam à 44 Hz) ; le rétablissement génère 1 toast success.
- **AC6** : `GET /api/dmx/output-status` retourne le snapshot ; rechargement de page → badge correct sans attendre le premier heartbeat.
- **AC7** : `npm run build` (web) passe ; le serveur démarre sans erreur.

## 8. Hors scope

- Ne pas modifier la logique d'envoi des sorties elles-mêmes (`usbDmx`, `pythonDmx`, `artnet`, `qlc`) au-delà de l'appel à `reportOk/reportError` — pas de retry, pas de file d'attente, pas d'accusé de réception Art-Net (ArtPoll = itération ultérieure).
- Pas d'authentification API (chantier C10).
- Pas de modification du `dmxEngine` frontend ni de ses locks.
- Ne pas toucher : SceneController, Inspecteur, StagePlan, MacroTimeline.

# 🔧 DIRECTIVES — Codex OpenAI : Glow Logic Phase Finale

**Contexte:** Tu as déjà terminé 2 sessions avec succès (smooth DMX + audit + corrections). Il reste 5 écarts critiques à corriger pour atteindre 100% de conformité avec le cahier des charges.

**Repo:** `https://github.com/bobprod/Glow-logic.git` (branch: `main`)
**Token:** Configuré dans le remote git
**Build:** `npm run typecheck --workspaces` et `npm run verify` doivent passer

---

## 🔴 ÉCART 1 : Ajouter `laserArmed` / `pyroArmed` dans le Store Zustand

### Problème
Le Safety Gate fonctionne côté serveur (`apps/server/services/safetyGate.ts`) mais le frontend n'a pas de state pour refléter l'armement. Le cahier Section 5 exige ces champs dans le store.

### Fichier à créer : `apps/web/src/store/slices/safetySlice.ts`

```typescript
import { StateCreator } from 'zustand';

export interface SafetySlice {
  laserArmed: boolean;
  pyroArmed: boolean;
  operatorRole: 'beginner' | 'expert' | 'admin';
  
  setLaserArmed: (armed: boolean) => void;
  setPyroArmed: (armed: boolean) => void;
  setOperatorRole: (role: 'beginner' | 'expert' | 'admin') => void;
}

export const createSafetySlice: StateCreator<SafetySlice> = (set) => ({
  laserArmed: false,
  pyroArmed: false,
  operatorRole: 'beginner',
  
  setLaserArmed: (armed) => set({ laserArmed: armed }),
  setPyroArmed: (armed) => set({ pyroArmed: armed }),
  setOperatorRole: (role) => set({ operatorRole: role }),
});
```

### Fichier à modifier : `apps/web/src/store/useStore.ts`
Ajouter `SafetySlice` dans le combine des slices.

### Fichier à modifier : `apps/web/src/components/TopBar.tsx`
Ajouter des indicateurs visuels (LED rouge/verte) pour `laserArmed` et `pyroArmed` dans la top bar.

### API à ajouter : `apps/server/index.ts`
- `GET /api/safety/status` — retourne `{ laserArmed, pyroArmed, operatorRole }`
- `POST /api/safety/arm` — body `{ type: 'laser' | 'pyro', state: boolean }`
- Protéger par `safetyGate.ts` (vérifier rôle admin)

### Tests
- `npm run typecheck --workspaces` ✅
- `npm run verify` ✅
- Vérifier visuellement que les indicateurs apparaissent dans la TopBar

---

## 🔴 ÉCART 2 : Ajouter `masterDimmer` (0-255) dans le Store

### Problème
Le cahier Section 5 exige `masterDimmer: number` (0-255). Actuellement seul `masterVolume` (0-1 audio) existe.

### Fichier à modifier : `apps/web/src/store/slices/smartModeSlice.ts`

Ajouter dans l'interface et le state initial :
```typescript
masterDimmer: number; // 0-255
setMasterDimmer: (val: number) => void;
```

### Fichier à modifier : `apps/web/src/components/SmartDashboard.tsx`
Ajouter un slider Master DMX (0-255) dans le mixeur de groupes. Quand il change, scaler proportionnellement les valeurs DMX de tous les groupes.

### Fichier à modifier : `apps/web/src/components/FixtureController.tsx`
Le Master Dimmer doit scaler la valeur envoyée : `actualValue = Math.round(value * (masterDimmer / 255))`.

### Tests
- `npm run typecheck --workspaces` ✅
- Build Next.js ✅
- Vérifier que le slider Master Dimmer scale les groupes

---

## 🔴 ÉCART 3 : Ajouter `dmxOutputs` dans le Store

### Problème
Le cahier Section 5 exige `dmxOutputs: { qlcWs: boolean; artNet: boolean; usbDmx: boolean }`. Actuellement c'est du state local React dans `SettingsModal.tsx`.

### Fichier à modifier : `apps/web/src/store/slices/uiSlice.ts`

Ajouter :
```typescript
dmxOutputs: { qlcWs: boolean; artNet: boolean; usbDmx: boolean };
setDmxOutputs: (outputs: Partial<dmxOutputs>) => void;
```

### Fichier à modifier : `apps/web/src/components/ui/SettingsModal.tsx`
Remplacer le state local React par le store Zustand. Utiliser `useStore(state => state.dmxOutputs)` et `setDmxOutputs()`.

### Fichier à modifier : `apps/web/src/lib/dmxEngine.ts`
Quand un output est désactivé, ne pas envoyer les valeurs sur cette interface.

### Tests
- `npm run typecheck --workspaces` ✅
- Vérifier que SettingsModal lit/écrit dans le store
- Vérifier que dmxEngine respecte les outputs désactivés

---

## 🔴 ÉCART 4 : Ajouter `networkState` dans le Store

### Problème
Le cahier Section 5 exige `networkState: { adapters: any[]; activeAdapter: any | null; discoveredNodes: any[] }`. Absent du store.

### Fichier à modifier : `apps/web/src/store/slices/uiSlice.ts`

Ajouter :
```typescript
networkState: {
  adapters: any[];
  activeAdapter: any | null;
  discoveredNodes: any[];
};
setNetworkState: (state: Partial<networkState>) => void;
```

### Fichier à modifier : `apps/web/src/components/ui/DmxSetupWizard.tsx`
Remplacer le state local par le store. Quand le wizard scanne les cartes réseau, stocker dans `networkState.adapters`.

### Tests
- `npm run typecheck --workspaces` ✅
- Vérifier que le wizard scanne et stocke dans le store

---

## 🔴 ÉCART 5 : Aligner les Interfaces TypeScript

### Problème
Les interfaces du code ne correspondent pas au cahier Section 4.

### Fichier à créer/modifier : `apps/web/src/types/dmx.ts`

Créer les interfaces conformes au spec :
```typescript
export interface DmxChannel {
  channel: number; // 1-indexed
  name: string;
  type: "dimmer" | "pan" | "tilt" | "color" | "gobo" | "prism" | "zoom" | "strobe" | "effect";
  minVal: number;  // 0
  maxVal: number;  // 255
  defaultVal: number;
}

export interface FixtureProfile {
  id: string;
  manufacturer: string;
  model: string;
  modes: {
    name: string;
    channels: DmxChannel[];
  }[];
}

export interface PatchedFixture {
  id: string;
  name: string;
  profileId: string;
  activeMode: string;
  universe: number;
  startAddress: number;
  gridPosition: { x: number; y: number; z: number };
}

export interface Keyframe {
  timeMs: number;
  value: number;
}

export interface AutomationTrack {
  id: string;
  fixtureId: string;
  channelType: string;
  keyframes: Keyframe[];
}

export interface MediaClip {
  id: string;
  name: string;
  type: "audio" | "video";
  fileUrl: string;
  startMs: number;
  durationMs: number;
}

export interface TimelineProject {
  id: number;
  name: string;
  bpm: number;
  durationMs: number;
  clips: MediaClip[];
  automations: AutomationTrack[];
}
```

### Fichiers à refactoriser
- `apps/web/src/components/FixtureController.tsx` — Remplacer `DmxChannel` local par l'import de `types/dmx.ts`
- `apps/web/src/components/PatchPanel.tsx` — Remplacer `nodeId` par `id`, ajouter `profileId`, `activeMode`, `gridPosition`
- `apps/web/src/store/slices/timelineSlice.ts` — Remplacer `TimelineClip` par `MediaClip`/`TimelineProject`
- `apps/web/src/components/MacroTimeline.tsx` — Aligner les types avec `TimelineProject`

### Tests
- `npm run typecheck --workspaces` ✅ (doit passer avec 0 erreur)
- `npm run verify` ✅
- `npm run build` ✅

---

## 🟡 BONUS : Corriger le Guided Tour

### Problème
Le cahier Section 8 demande 2 étapes séparées pour `.scene-pads-grid` (lancer + config). Actuellement fusionné en 1 étape.

### Fichier : `apps/web/src/components/ui/GuidedTour.tsx`

Séparer l'étape `.scene-pads-grid` en 2 :
```typescript
{
  target: '.scene-pads-grid',
  title: 'Grille de Pads',
  body: 'Cliquez sur ces pads pour lancer des scènes de couleurs instantanées.',
  placement: 'bottom'
},
{
  target: '.scene-pads-grid',
  title: 'Configuration du Pad',
  body: 'Faites un clic droit sur un pad pour lui assigner un thème de couleur, une icône d\'effet, ou une touche MIDI.',
  placement: 'bottom'
}
```

---

## 🟢 BONUS : Corriger ESLint

### Fichier : `apps/web/eslint.config.mjs`

Si `npm run lint` retourne "Premature close", downgrader temporairement à ESLint 8 :
```bash
npm uninstall eslint @eslint/js
npm install eslint@8 eslint-config-next@14
```

Ou créer `.eslintrc.json` :
```json
{
  "extends": "next/core-web-vitals"
}
```

---

## 🧪 PROTOCOLE DE TEST FINAL

Avant chaque commit, exécuter dans cet ordre :

```bash
# 1. TypeScript
cd apps/web && npx tsc --noEmit
cd apps/server && npx tsc --noEmit

# 2. Build
cd apps/web && npm run build

# 3. Tests API
cd apps/server && npm run test:api

# 4. Lint (si corrigé)
cd apps/web && npm run lint

# 5. Vérification manuelle
# - Ouvrir http://localhost:3000
# - Vérifier TopBar (laser/pyro indicators)
# - Vérifier SmartDashboard (Master Dimmer slider)
# - Vérifier SettingsModal (dmxOutputs persiste)
# - Vérifier DmxSetupWizard (networkState persiste)
```

---

## 📝 ORDRE DE TRAVAIL SUGGÉRÉ

1. **Slice Safety** (30 min) — Créer `safetySlice.ts` + API routes
2. **Slice DMX** (30 min) — Ajouter `masterDimmer` + `dmxOutputs` + `networkState`
3. **Interfaces** (45 min) — Créer `types/dmx.ts` + refactoriser
4. **UI** (45 min) — TopBar indicators, SmartDashboard Master Dimmer, SettingsModal
5. **Tests** (30 min) — typecheck, build, vérification manuelle

**Total estimé :** 2h30 - 3h

---

## 🎯 CRITÈRE DE SUCCÈS

- [ ] `laserArmed` / `pyroArmed` visibles dans TopBar
- [ ] `masterDimmer` slider visible dans SmartDashboard
- [ ] `dmxOutputs` persiste dans SettingsModal
- [ ] `networkState` persiste dans DmxSetupWizard
- [ ] Interfaces `DmxChannel`, `FixtureProfile`, `PatchedFixture`, `MediaClip`, `TimelineProject` créées
- [ ] `npm run typecheck --workspaces` → 0 erreur
- [ ] `npm run build` → Succès
- [ ] Git push → `git push origin main`

**Note :** Si un écart prend plus de 45 min, le documenter et passer au suivant. On pourra revenir en itération 2.

---

## 🚀 RAPPEL : GITHUB

```bash
# Config déjà faite
git remote -v
# origin  https://github.com/bobprod/Glow-logic.git

# Push à la fin
git add .
git commit -m "feat: Phase 5 compliance — safety store + masterDimmer + dmxOutputs + networkState + types"
git push origin main
```

**Token :** Déjà dans le remote URL. Ne pas le partager.

---

*Fin des directives — Itération 2, Phase Finale*

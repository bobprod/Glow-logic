# Plan d'implémentation — Améliorations de la Timeline (MacroTimeline)

> **Pour l'agent IA qui exécute ce plan :** ce document est autonome. Lis-le en entier avant de coder. Chaque étape indique le fichier exact, l'emplacement, et le code à insérer. Respecte les conventions existantes (Tailwind, lucide-react, Zustand, TypeScript strict). À la fin, lance le type-check et le dev server pour vérifier.

---

## Contexte

**Glow Logic** est une application de contrôle de spectacle DMX/LED/laser (Next.js 16, React 18, Zustand, Three.js, Tailwind).

Le composant **`MacroTimeline`** (`apps/web/src/components/MacroTimeline.tsx`, ~1350 lignes) est la timeline ancrée en bas de l'`AppShell`. Elle gère des pistes (LIGHTS, VISUALS, FX), des marqueurs de cue, des pistes d'automation avec keyframes, et un panneau d'outils d'arrangement (scenes/cues/chasers/automations/visualiseur 3D).

**Problème initial :** la timeline a une hauteur fixe (`h-72` = 288px). L'utilisateur veut pouvoir l'agrandir (travail de détail) et la rétrécir (laisser la place au canvas), plus un ensemble de fonctionnalités professionnelles manquantes.

**Objectif :** 7 améliorations livrées ci-dessous, sans régression sur les fonctions existantes (play/pause, drag de clip, édition de keyframe, loop region).

---

## Stack & conventions à respecter

| Élément | Convention |
|---------|-----------|
| Styling | Tailwind classes inline. Couleurs hex dans `style={{}}` quand dynamique. |
| Icônes | `lucide-react` — importer en haut du fichier |
| État global | Zustand (`useStore`), slices dans `apps/web/src/store/slices/` |
| Persistance | Champ ajouté au `partialize` dans `apps/web/src/store/useStore.ts` |
| Port dev | **3000** (fallback 3001). Backend = 3005. |
| Type-check | `cd apps/web && npx tsc --noEmit` doit passer à zéro erreur |

---

## Fichiers à modifier

1. `apps/web/src/store/slices/uiSlice.ts` — état `timelineHeight`
2. `apps/web/src/store/useStore.ts` — persistance de `timelineHeight`
3. `apps/web/src/components/MacroTimeline.tsx` — toutes les fonctionnalités UI
4. `apps/web/src/components/smart/OutputHealthWidget.tsx` — bugfix socket

---

## Étape 1 — État `timelineHeight` (uiSlice)

**Fichier :** `apps/web/src/store/slices/uiSlice.ts`

Dans l'interface `UISlice`, ajouter (à côté des autres champs UI, ex. après `setMidiArmed`) :

```ts
timelineHeight: number;
setTimelineHeight: (height: number) => void;
```

Dans l'implémentation `createUISlice`, ajouter :

```ts
timelineHeight: 288,
setTimelineHeight: (height) => set({ timelineHeight: Math.max(120, Math.min(600, height)) }),
```

> Bornes : min **120px** (compact), max **600px**, défaut **288px** (= `h-72`).

---

## Étape 2 — Persistance (useStore)

**Fichier :** `apps/web/src/store/useStore.ts`

Dans l'objet retourné par `partialize`, ajouter une ligne (ex. après `showLock`) :

```ts
timelineHeight: state.timelineHeight,
```

---

## Étape 3 — MacroTimeline : imports & état local

**Fichier :** `apps/web/src/components/MacroTimeline.tsx`

**3a. Imports d'icônes** — ajouter `GripHorizontal, Magnet, Music` à l'import existant de `lucide-react` (ligne 4) :

```ts
import { Box, Maximize2, Play, Pause, SkipBack, SkipForward, Trash2, X, ZoomIn, ZoomOut, Flag, Plus, SlidersHorizontal, GripHorizontal, Magnet, Music } from 'lucide-react';
```

**3b. Destructuring du store** — ajouter `timelineHeight, setTimelineHeight, bpm` aux valeurs déjà extraites de `useStore`.

**3c. État local** — à côté des autres `useState` du composant :

```tsx
const [snapEnabled, setSnapEnabled] = useState(false);
const [bpmGridVisible, setBpmGridVisible] = useState(false);
const [isResizingPanel, setIsResizingPanel] = useState(false);
const resizeStartY = useRef(0);
const resizeStartH = useRef(288);
```

---

## Étape 4 — Helper de snap + handlers de resize

Ajouter, dans le corps du composant (zone des `useCallback`/`useEffect`) :

```tsx
const snapMs = useCallback((ms: number) => {
    if (!snapEnabled) return ms;
    const beatMs = bpm > 0 && bpmGridVisible ? 60000 / bpm : 0;
    const gridRes = viewDuration <= 30000 ? 100 : viewDuration <= 120000 ? 500 : 1000;
    const snapRes = beatMs > 0 ? beatMs : gridRes;
    return Math.round(ms / snapRes) * snapRes;
}, [snapEnabled, bpm, bpmGridVisible, viewDuration]);

const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPanel(true);
    resizeStartY.current = e.clientY;
    resizeStartH.current = timelineHeight;
}, [timelineHeight]);

useEffect(() => {
    if (!isResizingPanel) return;
    const onMove = (e: MouseEvent) => {
        const delta = resizeStartY.current - e.clientY; // tirer vers le haut = agrandir
        setTimelineHeight(resizeStartH.current + delta);
    };
    const onUp = () => setIsResizingPanel(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
}, [isResizingPanel, setTimelineHeight]);
```

> `snapMs` est la fonction de quantification réutilisée partout (drop clip, resize clip, drag keyframe). Résolution auto selon le zoom ; si BPM grid actif, snap au beat.

---

## Étape 5 — Pan horizontal (Shift+scroll)

Remplacer le `handleWheel` existant pour distinguer Shift (pan) du scroll normal (zoom) :

```tsx
const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) {
        const panAmount = (e.deltaY > 0 ? 1 : -1) * viewDuration * 0.1;
        setViewStart(Math.max(0, Math.min(viewStart + panAmount, duration - viewDuration)));
    } else {
        const factor = e.deltaY < 0 ? 1.2 : 0.85;
        const newZoom = Math.max(1, Math.min(20, zoom * factor));
        setZoom(newZoom);
    }
}, [zoom, setZoom, viewStart, viewDuration, duration, setViewStart]);
```

---

## Étape 6 — Appliquer le snap

Aux 3 endroits où une position temporelle est calculée à partir de la souris, envelopper le résultat avec `snapMs(...)` :

- **Drop de clip** (`handleTrackDrop`) :
  ```tsx
  snapMs(Math.max(0, Math.min(dropMs - dragOffsetMs, duration - clip.duration)))
  ```
- **Resize de clip** (`handleResizeMove`) :
  ```tsx
  const snapped = snapMs(ms);
  if (clip && snapped > clip.startTime + 1000) { /* … */ }
  ```
- **Drag de keyframe** (handler keyframe move) :
  ```tsx
  timeMs: snapMs(getAutomationMsFromClientX(e.clientX))
  ```

---

## Étape 7 — Conteneur redimensionnable + drag handle

Remplacer le conteneur à hauteur fixe `h-72` par une poignée de redimensionnement suivie d'un conteneur à hauteur dynamique :

```tsx
{/* Drag Handle */}
<div
    className={`relative h-1.5 bg-[#12141A] border-t border-slate-700 cursor-ns-resize flex items-center justify-center group/handle z-40 shrink-0 ${isResizingPanel ? 'bg-cyan-500/10' : 'hover:bg-cyan-500/5'}`}
    onMouseDown={handlePanelResizeStart}
    onDoubleClick={() => setTimelineHeight(timelineHeight <= 150 ? 288 : 120)}
>
    <GripHorizontal className={`w-5 h-3 transition-colors ${isResizingPanel ? 'text-cyan-400' : 'text-slate-600 group-hover/handle:text-cyan-400'}`} />
</div>
<div className="macro-timeline-container relative bg-[#12141A] /* …classes existantes… */" style={{ height: timelineHeight }}>
```

> Double-clic sur la poignée = bascule compact (120) ↔ défaut (288).

---

## Étape 8 — Boutons Snap & BPM (barre de contrôles)

Dans la barre de contrôles, **avant** les boutons de zoom, ajouter :

```tsx
<button
    onClick={() => setSnapEnabled(v => !v)}
    title="Snap to grid"
    className={`p-1.5 rounded transition-colors ${snapEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
>
    <Magnet className="w-3.5 h-3.5" />
</button>
<button
    onClick={() => setBpmGridVisible(v => !v)}
    title="Grille BPM"
    className={`p-1.5 rounded transition-colors ${bpmGridVisible ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
>
    <Music className="w-3.5 h-3.5" />
</button>
```

---

## Étape 9 — Overlay grille BPM

Dans le corps des pistes, **avant** la ligne de playhead, rendre les lignes de beat quand `bpmGridVisible && bpm > 0` :

```tsx
{bpmGridVisible && bpm > 0 && (() => {
    const beatMs = 60000 / bpm;
    const lines = [];
    const firstBeat = Math.ceil(viewStart / beatMs);
    const lastBeat = Math.floor((viewStart + viewDuration) / beatMs);
    for (let b = firstBeat; b <= lastBeat; b++) {
        const ms = b * beatMs;
        const pct = msToPct(ms);
        const isBar = b % 4 === 0; // mesure toutes les 4 noires
        lines.push(
            <div key={b} className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${pct}%`, width: '1px', background: isBar ? 'rgba(167,139,250,0.35)' : 'rgba(167,139,250,0.12)' }} />
        );
    }
    return <>{lines}</>;
})()}
```

---

## Étape 10 — Courbe d'automation (SVG)

Dans chaque lane d'automation (`<div className="flex-1 relative cursor-crosshair">`), **après** le label et **avant** le `.map` des keyframes, ajouter une courbe SVG reliant les keyframes selon leur easing. Le helper `applyEasing(t, easing)` existe déjà dans ce fichier (≈ ligne 61).

```tsx
{/* Automation curve SVG */}
{track.keyframes.length >= 2 && (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        {(() => {
            const sorted = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
            const points: string[] = [];
            const fillPoints: string[] = [];
            const h = 32;
            for (let i = 0; i < sorted.length; i++) {
                const kf = sorted[i];
                const next = sorted[i + 1];
                const x = msToPct(kf.timeMs);
                const y = h - (kf.value / 255) * (h - 4) - 2;
                points.push(`${x},${y}`);
                fillPoints.push(`${x},${y}`);
                if (next && kf.easing !== 'linear' && kf.easing !== 'hold') {
                    const steps = 8;
                    for (let s = 1; s < steps; s++) {
                        const t = s / steps;
                        const eased = applyEasing(t, kf.easing ?? 'linear');
                        const ix = x + (msToPct(next.timeMs) - x) * t;
                        const iv = kf.value + (next.value - kf.value) * eased;
                        const iy = h - (iv / 255) * (h - 4) - 2;
                        points.push(`${ix},${iy}`);
                        fillPoints.push(`${ix},${iy}`);
                    }
                }
                if (next && kf.easing === 'hold') {
                    const nx = msToPct(next.timeMs);
                    points.push(`${nx},${y}`);
                    fillPoints.push(`${nx},${y}`);
                }
            }
            const firstX = msToPct(sorted[0].timeMs);
            const lastX = msToPct(sorted[sorted.length - 1].timeMs);
            const fillPath = `${fillPoints.join(' ')} ${lastX},${h} ${firstX},${h}`;
            return (
                <>
                    <polygon points={fillPath} fill={track.color} opacity="0.08" vectorEffect="non-scaling-stroke" />
                    <polyline points={points.join(' ')} fill="none" stroke={track.color} strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
                </>
            );
        })()}
    </svg>
)}
```

> Ajouter `z-10` aux boutons keyframe et au label pour qu'ils restent au-dessus du SVG.

---

## Étape 11 — Minimap / overview

Juste **avant** le bloc « Hints » en bas, ajouter une barre minimap :

```tsx
{/* Minimap */}
<div className="relative h-3 bg-[#0a0b0f] border-t border-slate-800 flex-shrink-0 cursor-pointer"
    onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const newStart = Math.max(0, Math.min(pct * duration - viewDuration / 2, duration - viewDuration));
        setViewStart(newStart);
    }}>
    {clips.map(clip => {
        const left = (clip.startTime / duration) * 100;
        const width = Math.max(0.5, (clip.duration / duration) * 100);
        const colors: Record<string, string> = { LIGHTS: '#22d3ee', VISUALS: '#a78bfa', FX: '#f59e0b' };
        return <div key={clip.id} className="absolute top-0.5 bottom-0.5 rounded-sm opacity-60" style={{ left: `${left}%`, width: `${width}%`, background: colors[clip.track] ?? '#22d3ee' }} />;
    })}
    {markers.map(m => (
        <div key={m.id} className="absolute top-0 bottom-0 w-px bg-yellow-400/40" style={{ left: `${(m.time / duration) * 100}%` }} />
    ))}
    <div className="absolute top-0 bottom-0 border border-cyan-400/50 bg-cyan-400/10 rounded-sm" style={{ left: `${(viewStart / duration) * 100}%`, width: `${(viewDuration / duration) * 100}%` }} />
    <div className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: `${(elapsed / duration) * 100}%` }} />
</div>
```

> **Pièges de typage (vérifiés) :** la propriété d'un marqueur est `m.time` (PAS `m.timeMs` — type `CueMarker` dans `timelineSlice.ts`). La position du playhead est la variable `elapsed` (PAS `currentTime`).

---

## Étape 12 — Mettre à jour le texte d'aide (Hints)

Compléter la ligne de hints existante avec les nouveaux raccourcis :

```
… · Scroll = zoom · Shift+scroll = pan · Snap = magnétisme grille
```

---

## Étape 13 — Bugfix OutputHealthWidget (socket cleanup)

**Fichier :** `apps/web/src/components/smart/OutputHealthWidget.tsx` (≈ ligne 78)

Le composant s'abonne à `dmx_output_status` mais se désabonne du mauvais event. Corriger le cleanup :

```ts
// avant
socket.off("dmx_output_health", handler);
// après
socket.off("dmx_output_status", handler);
```

---

## Vérification (à exécuter à la fin)

1. **Type-check :**
   ```bash
   cd apps/web && npx tsc --noEmit
   ```
   Doit retourner **zéro erreur**.

2. **Dev server :**
   ```bash
   npm run dev --workspace apps/web
   ```
   App sur `http://localhost:3000` (fallback 3001). Vérifier le code 200.

3. **Tests manuels dans le navigateur :**
   - [ ] Glisser la poignée haut/bas → resize fluide ; double-clic → bascule 120/288.
   - [ ] Zoomer (scroll), puis **Shift+scroll** → pan horizontal.
   - [ ] Activer **Snap** (aimant), glisser un clip → s'aligne sur la grille.
   - [ ] Activer la **grille BPM** (note) avec un BPM > 0 → lignes de beat, mesures plus marquées.
   - [ ] Créer une piste d'automation + ≥2 keyframes avec easing varié → la courbe SVG suit l'easing, remplissage sous la courbe.
   - [ ] **Minimap** : clic pour repositionner la fenêtre ; clips/markers/playhead/viewport visibles.
   - [ ] Aucune erreur console ; play/pause, drag de clip, édition keyframe, loop region toujours OK.

---

## Récapitulatif des 7 améliorations

| # | Fonctionnalité | Fichier principal |
|---|----------------|-------------------|
| 1 | Panneau redimensionnable (drag handle, 120–600px, double-clic) | uiSlice + useStore + MacroTimeline |
| 2 | Pan horizontal (Shift+scroll) | MacroTimeline `handleWheel` |
| 3 | Snap-to-grid (clips + keyframes, auto-résolution) | MacroTimeline `snapMs` |
| 4 | Grille BPM (beats + mesures) | MacroTimeline overlay |
| 5 | Courbe d'automation SVG (easing + remplissage) | MacroTimeline lane |
| 6 | Minimap / overview cliquable | MacroTimeline |
| 7 | Bugfix cleanup socket OutputHealth | OutputHealthWidget |

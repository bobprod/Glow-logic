# Plan d'exécution minutieux — Timeline Phase 2 & 3 + Fix moteur P0

> **POUR L'AGENT IA QUI CODE :** ce document est autonome et exécutable directement. Chaque tâche a un ID (A1, B2, D1…), un fichier exact, un emplacement (ancre de code à chercher, pas un n° de ligne figé — le fichier évolue), le code **AVANT → APRÈS**, et un critère de validation. Travaille tâche par tâche dans l'ordre indiqué. Après CHAQUE groupe (A, B, C, D, E), lance `cd apps/web && npx tsc --noEmit` et corrige avant de continuer. Ne passe pas à la tâche suivante si le type-check échoue.

## Conventions du projet (à respecter absolument)
- **Styling :** Tailwind inline. Couleurs hex dynamiques dans `style={{}}`.
- **Icônes :** `lucide-react`, importées en tête de `MacroTimeline.tsx`.
- **État global :** Zustand. Slices dans `apps/web/src/store/slices/`. Pour persister un champ : l'ajouter à `partialize` dans `apps/web/src/store/useStore.ts`.
- **Undo/redo :** toute action structurelle du slice timeline passe par `pushHistory({label, undo, redo})` + garde `if (!isReplayingHistory())`. Voir `addClip`/`deleteClip` dans `timelineSlice.ts` comme modèle exact.
- **Port dev :** 3000 (fallback 3001). Backend : 3005.
- **Critère global de fin :** `npx tsc --noEmit` à zéro erreur + tests manuels de la section.

## Ordre d'exécution
1. **Groupe A** (correctness moteur côté UI) → 2. **Groupe D** (bug hauteur, très visible) → 3. **Groupe B** (features) → 4. **Groupe E** (UX/UI) → 5. **Groupe C** (nettoyage) → 6. **P0-ENGINE** (boucle refresh serveur, le plus impactant, séparé).

---

# GROUPE A — Corrections de justesse (fichier : `apps/web/src/components/MacroTimeline.tsx`)

## A1 — Supprimer la dérive du playhead (rAF au lieu de setInterval)

**Pourquoi :** `setInterval(50ms)` dérive (l'event-loop ne tient pas 50ms pile) → désync visuelle/DMX sur un show long.

**Étape 1 — ajouter un ref de timestamp.** Près des autres refs (`intervalRef`), ajouter :
```tsx
const rafRef = useRef<number | null>(null);
const lastTickRef = useRef<number>(0);
```

**Étape 2 — remplacer le bloc Timer.** Chercher le commentaire `// ── Timer ──` et remplacer tout le `useEffect` suivant.

AVANT :
```tsx
    // ── Timer ──────────────────────────────────────────────────
    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => {
                    const next = prev + 50;
                    if (isLoopEnabled && loopStart !== null && loopEnd !== null && next >= loopEnd) return loopStart;
                    return next > duration ? duration : next;
                });
            }, 50);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isPlaying, duration, isLoopEnabled, loopStart, loopEnd]);
```

APRÈS :
```tsx
    // ── Timer (requestAnimationFrame, drift-free) ───────────────
    useEffect(() => {
        if (!isPlaying) {
            if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            return;
        }
        lastTickRef.current = performance.now();
        const loop = (now: number) => {
            const delta = now - lastTickRef.current;
            lastTickRef.current = now;
            setElapsed(prev => {
                const next = prev + delta;
                if (isLoopEnabled && loopStart !== null && loopEnd !== null && next >= loopEnd) return loopStart;
                return next > duration ? duration : next;
            });
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
    }, [isPlaying, duration, isLoopEnabled, loopStart, loopEnd]);
```

> Note : `elapsed` devient un float (ms fractionnaires). C'est sans impact — tout l'affichage passe par `formatTime()` qui `Math.floor`. Si un calcul ailleurs suppose un entier, wrappe avec `Math.round(elapsed)`.

**Validation A1 :** lancer la lecture 3 min, comparer le compteur à un chrono externe → écart < 100ms (avant : plusieurs centaines de ms).

## A2 — Source unique de vérité pour le playhead (optionnel si A1 suffit)

**Pourquoi :** `elapsed` (local) et `playheadMs` (store) sont synchronisés par 2 effets qui s'écrivent mutuellement → fragile.

**Décision pragmatique :** garder `elapsed` local comme moteur d'affichage (déjà piloté par A1), mais **supprimer la boucle de réécriture inverse**. Chercher :
```tsx
    useEffect(() => {
        setTimelinePlaybackState(useStore.getState().timelinePlaying, elapsed);
    }, [elapsed, setTimelinePlaybackState]);
```
La conserver (elle pousse `elapsed → store`, sens unique, c'est OK). Vérifier qu'**aucun** effet ne fait l'inverse (`setElapsed(playheadMs)`). Si oui, le supprimer. Ne pas introduire de double binding.

**Validation A2 :** pas de régression de lecture ; `playheadMs` du store suit bien la lecture (vérifiable via React devtools / un log).

## A3 — « Follow playhead » : l'auto-scroll ne doit plus écraser le pan manuel

**Pourquoi :** l'auto-scroll recadre `viewStart` à chaque tick → annule le Shift+scroll pendant la lecture (régression Phase 1).

**Étape 1 — état local.** Près des autres `useState` :
```tsx
const [followPlayhead, setFollowPlayhead] = useState(true);
```

**Étape 2 — garder l'effet auto-scroll sous condition.** AVANT :
```tsx
    // Auto-scroll playhead into view
    useEffect(() => {
        if (elapsed < viewStart || elapsed > viewEnd) {
            setViewStart(Math.max(0, Math.min(elapsed, duration - viewDuration)));
        }
    }, [duration, elapsed, viewDuration, viewEnd, viewStart]);
```
APRÈS :
```tsx
    // Auto-scroll playhead into view (only when follow is on)
    useEffect(() => {
        if (!followPlayhead) return;
        if (elapsed < viewStart || elapsed > viewEnd) {
            setViewStart(Math.max(0, Math.min(elapsed, duration - viewDuration)));
        }
    }, [followPlayhead, duration, elapsed, viewDuration, viewEnd, viewStart]);
```

**Étape 3 — couper le follow quand l'utilisateur navigue.** Dans `handleWheel`, dans la branche `if (e.shiftKey)` (pan), ajouter `setFollowPlayhead(false);`. Idem dans le `onClick` de la minimap (ajout Phase 1) : `setFollowPlayhead(false);`.

**Étape 4 — bouton toggle.** Importer `Crosshair` depuis `lucide-react`. Dans la barre de contrôles (près des boutons SNAP/BPM), ajouter :
```tsx
<button
    onClick={() => setFollowPlayhead(p => !p)}
    title="Suivre le playhead"
    className={`text-[9px] font-bold px-2 py-1 rounded border transition-all flex items-center gap-1 ${followPlayhead ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'text-slate-500 border-slate-700 hover:text-slate-300'}`}
>
    <Crosshair className="w-3 h-3" /> FOLLOW
</button>
```

**Validation A3 :** lecture en cours + zoom + Shift+scroll → la vue reste où on l'a posée ; clic FOLLOW → la vue re-suit le playhead.

## A4 — Alléger le gros effet de sync (early-return si rien ne change)

**Pourquoi :** l'effet qui active/désactive les widgets QLC + clips DMX dépend de `elapsed` → tourne à chaque frame (après A1) et refait `filter`/`Set` même sans changement.

**Fix :** dans cet effet (chercher `activeWidgetsRef` / `newActiveKeys`), après avoir construit `newActiveKeys` et `newActiveDmxClipIds`, **avant** les boucles d'émission socket, ajouter une comparaison shallow avec les refs courantes et early-return si identiques :
```tsx
const sameSet = (a: Set<string>, b: Set<string>) =>
    a.size === b.size && [...a].every(x => b.has(x));
if (sameSet(newActiveKeys, activeWidgetsRef.current) &&
    sameSet(newActiveDmxClipIds, activeDmxClipsRef.current)) {
    return; // rien de neuf : ne pas ré-émettre
}
```
> Garder intacts les appels `dmxEngine.setChannel(...)` d'automation au-dessus (idempotents/peu coûteux) — ne garder par l'early-return QUE le bloc d'émission socket activate/deactivate.

**Validation A4 :** lecture fluide ; les logs `[Timeline] Déclenchement/Désactivation` n'apparaissent qu'aux vraies transitions de clip, pas en continu.

**→ Type-check du Groupe A, puis continuer.**

---

# GROUPE D — Bug de hauteur des pistes (le plus visible) — `MacroTimeline.tsx`

## D1 — Hauteur de ligne uniforme + scroll vertical (au lieu de stretch élastique)

**Pourquoi (confirmé) :** les 3 pistes principales utilisent `flex-1` (élastique) tandis que les lanes d'automation sont en `h-8` (fixe). Dans le même conteneur flex-col, agrandir le panneau ne grossit que les pistes `flex-1` ; les lanes restent figées. C'est le bug de la capture.

**Étape 1 — conteneur scrollable.** Chercher le conteneur du corps des pistes :
```tsx
<div ref={tracksBodyRef} className="flex-1 relative flex flex-col overflow-hidden">
```
Remplacer `overflow-hidden` par `overflow-y-auto`:
```tsx
<div ref={tracksBodyRef} className="flex-1 relative flex flex-col overflow-y-auto">
```

**Étape 2 — pistes principales en hauteur fixe.** Chercher `{TRACKS.map(track => (` puis la div de ligne :
```tsx
className="flex-1 border-b border-[#262c36] flex overflow-hidden"
```
Remplacer `flex-1` par une hauteur fixe + `shrink-0` :
```tsx
className="h-12 shrink-0 border-b border-[#262c36] flex overflow-hidden"
```
(`h-12` = 48px ; ajuste si besoin mais garde identique pour les 3.)

**Étape 3 — lanes d'automation cohérentes.** Chercher `{automationTracks.map(track => {` puis la div `timeline-automation-lane h-8 ...`. Garder une hauteur fixe mais ajouter `shrink-0` pour qu'elle ne soit jamais compressée :
```tsx
className={`timeline-automation-lane h-9 shrink-0 flex border-b overflow-hidden ${...}`}
```
> Si le SVG de courbe (Phase 1) utilise `const h = 32;` en dur, le passer à `36` pour matcher `h-9` (36px), sinon la courbe sera légèrement décalée verticalement.

**Validation D1 :**
- Agrandir le panneau (poignée) → toutes les lignes gardent leur hauteur ; l'espace en plus révèle plus de lignes via scroll, aucune ligne ne s'étire.
- Rétrécir sous la hauteur totale → une scrollbar verticale apparaît, toutes les lignes restent atteignables.

**→ Type-check du Groupe D.**

---

# GROUPE B — Fonctionnalités manquantes

## B1 — Persister `snapEnabled` / `bpmGridVisible`

**Fichier 1 :** `apps/web/src/store/slices/uiSlice.ts`. Dans l'interface `UISlice` (à côté de `timelineHeight`) :
```ts
snapEnabled: boolean;
setSnapEnabled: (v: boolean) => void;
bpmGridVisible: boolean;
setBpmGridVisible: (v: boolean) => void;
```
Dans `createUISlice` :
```ts
snapEnabled: false,
setSnapEnabled: (v) => set({ snapEnabled: v }),
bpmGridVisible: false,
setBpmGridVisible: (v) => set({ bpmGridVisible: v }),
```

**Fichier 2 :** `apps/web/src/store/useStore.ts`, dans `partialize` (après `timelineHeight: state.timelineHeight,`) :
```ts
snapEnabled: state.snapEnabled,
bpmGridVisible: state.bpmGridVisible,
```

**Fichier 3 :** `MacroTimeline.tsx`. Supprimer les 2 `useState` locaux :
```tsx
const [snapEnabled, setSnapEnabled] = useState(false);
const [bpmGridVisible, setBpmGridVisible] = useState(false);
```
Et les lire depuis le store (ajouter `snapEnabled, setSnapEnabled, bpmGridVisible, setBpmGridVisible` au `useStore()` destructuring). Les usages `setSnapEnabled(p => !p)` doivent devenir `setSnapEnabled(!snapEnabled)` (le setter du store ne prend pas de callback). Idem BPM.

**Validation B1 :** activer Snap + grille BPM, recharger la page (F5) → les deux restent actifs.

## B2 — Édition des marqueurs (rename / recolor / drag / undo)

**Fichier 1 :** `apps/web/src/store/slices/timelineSlice.ts`.
- Interface : ajouter `updateMarker: (id: string, updates: Partial<CueMarker>) => void;`
- Câbler les 3 actions via history (modèle = `addClip`). Remplacer :
```ts
addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
deleteMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),
```
par :
```ts
addMarker: (marker) => {
    const before = get().markers;
    const after = [...before, marker];
    if (!isReplayingHistory()) pushHistory({ label: `Marker ajoute: ${marker.name}`, undo: () => set({ markers: before }), redo: () => set({ markers: after }) });
    set({ markers: after });
},
updateMarker: (id, updates) => {
    const before = get().markers;
    const target = before.find((m) => m.id === id);
    if (!target) return;
    const after = before.map((m) => (m.id === id ? { ...m, ...updates } : m));
    if (!isReplayingHistory()) pushHistory({ label: `Marker modifie: ${target.name}`, coalesceKey: `marker:${id}`, undo: () => set({ markers: before }), redo: () => set({ markers: after }) });
    set({ markers: after });
},
deleteMarker: (id) => {
    const before = get().markers;
    const deleted = before.find((m) => m.id === id);
    if (!deleted) return;
    const after = before.filter((m) => m.id !== id);
    if (!isReplayingHistory()) pushHistory({ label: `Marker supprime: ${deleted.name}`, undo: () => set({ markers: before }), redo: () => set({ markers: after }) });
    set({ markers: after });
},
```

**Fichier 2 :** `MacroTimeline.tsx`.
- Ajouter `updateMarker` au destructuring du store.
- **Drag :** sur le drapeau de marqueur (bloc `markers.map` dans la règle), ajouter `onMouseDown` qui démarre un drag (état local `draggingMarkerId`), un `useEffect` mousemove qui fait `updateMarker(id, { time: snapMs(getRulerMs2(e.clientX)) })` (réutilise la logique de `getRulerMs`), et mouseup qui termine. Modèle = le drag de keyframe (`draggingKeyframe`) déjà présent.
- **Rename/recolor :** un petit popover au double-clic sur le drapeau : `<input>` pour `name` → `updateMarker(id,{name})` ; rangée de pastilles `MARKER_COLORS` (déjà défini en tête de fichier) → `updateMarker(id,{color})`.

**Validation B2 :** glisser un marqueur, le renommer, changer sa couleur, `Ctrl+Z` → chaque action se défait via l'historique.

## B3 — Drag vertical de keyframe (valeur), en plus du drag horizontal (temps)

**Fichier :** `MacroTimeline.tsx`.

**Étape 1 — helper valeur depuis Y.** À côté de `getAutomationMsFromClientX`, ajouter (la hauteur de lane = 36px après D1) :
```tsx
const LANE_H = 36;
const getAutomationValueFromClientY = useCallback((clientY: number, laneTop: number) => {
    const yInLane = Math.max(2, Math.min(clientY - laneTop, LANE_H - 2));
    const v = (1 - (yInLane - 2) / (LANE_H - 4)) * 255;
    return Math.max(0, Math.min(255, Math.round(v)));
}, []);
```

**Étape 2 — capturer le top de la lane au mousedown.** Dans `handleKeyframeMouseDown`, stocker le rect de la lane parente :
```tsx
const handleKeyframeMouseDown = (e: React.MouseEvent, trackId: string, keyframeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const laneEl = (e.currentTarget as HTMLElement).closest('.timeline-automation-lane') as HTMLElement | null;
    keyframeLaneTopRef.current = laneEl ? laneEl.getBoundingClientRect().top : 0;
    setSelectedAutomationTrackId(trackId);
    setSelectedKeyframe({ trackId, keyframeId });
    setDraggingKeyframe({ trackId, keyframeId });
};
```
Ajouter le ref : `const keyframeLaneTopRef = useRef(0);`

**Étape 3 — mettre à jour temps ET valeur dans le mousemove.** Dans l'effet `draggingKeyframe`, remplacer le `updateAutomationKeyframe` :
```tsx
const handleMove = (e: MouseEvent) => {
    const patch: { timeMs?: number; value?: number } = {};
    if (!e.shiftKey) patch.timeMs = snapMs(getAutomationMsFromClientX(e.clientX)); // Shift = bloque le temps
    patch.value = getAutomationValueFromClientY(e.clientY, keyframeLaneTopRef.current);
    updateAutomationKeyframe(draggingKeyframe.trackId, draggingKeyframe.keyframeId, patch);
};
```
Ajouter `getAutomationValueFromClientY` aux deps de l'effet.

**Validation B3 :** glisser un keyframe verticalement → sa valeur (0-255) change et la courbe SVG suit ; horizontalement → le temps change ; Shift+drag vertical → temps figé, valeur seule.

## B4 — Champs numériques loop in/out

**Fichier :** `MacroTimeline.tsx`. Près du bouton LOOP (chercher `LOOP {loopStart`), quand `loopStart !== null`, afficher 2 `<input>` éditables affichant `formatTime(loopStart)` / `formatTime(loopEnd)`. Ajouter un parseur inverse :
```tsx
const parseTime = (s: string): number | null => {
    const m = s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
    if (!m) return null;
    return (+m[1]) * 60000 + (+m[2]) * 1000 + (m[3] ? +m[3].padEnd(2,'0') * 10 : 0);
};
```
`onBlur`/`onKeyDown Enter` → `setLoopStart(parseTime(val) ?? loopStart)` (idem end), clampé `[0, duration]` et `start < end`.

**Validation B4 :** saisir `01:30.00` dans le champ in → la région loop se cale précisément.

## B5 — Contrôle BPM (champ + tap-tempo)

**Fichier :** `MacroTimeline.tsx`. `bpm`/`setBpm` viennent de `smartModeSlice` (déjà dans le store). Ajouter `setBpm` au destructuring. Près du bouton grille BPM :
```tsx
<input type="number" min={20} max={300} value={Math.round(bpm)}
    onChange={(e) => setBpm(Math.max(20, Math.min(300, +e.target.value || 0)))}
    className="w-12 text-[9px] bg-black/40 border border-slate-700 rounded px-1 py-0.5 text-slate-200" />
<button onClick={handleTap} title="Tap tempo"
    className="text-[9px] font-bold px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-white/5">TAP</button>
```
Logique tap (état local `tapTimesRef = useRef<number[]>([])`) :
```tsx
const handleTap = () => {
    const now = performance.now();
    const arr = tapTimesRef.current.filter(t => now - t < 2000);
    arr.push(now);
    tapTimesRef.current = arr;
    if (arr.length >= 2) {
        const intervals = arr.slice(1).map((t, i) => t - arr[i]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setBpm(Math.max(20, Math.min(300, Math.round(60000 / avg))));
    }
};
```

**Validation B5 :** taper TAP en rythme → le BPM se cale ; la grille BPM (si visible) s'ajuste.

## B6 — Waveform audio (DIFFÉRÉ — plan séparé)
Ne pas implémenter ici. Effort majeur (décodage audio, dessin waveform, scrub-sync). Réutilisera `apps/web/src/lib/ShowAudioEngine.ts`. À planifier séparément après A/B/C/D/E.

**→ Type-check du Groupe B.**

---

# GROUPE E — UX/UI (densité & lisibilité) — `MacroTimeline.tsx`

## E1 — Simplifier le panneau « AUTOMATIONS DMX » (carte compacte)
Dans le rendu de l'onglet « Auto » (chercher le 2e `automationTracks.map`, celui du panneau de droite) : garder la rangée d'en-tête (checkbox, pastille couleur, label, badge canal, corbeille) ; replier la rangée temps/canal/type/couleur derrière un chevron (état local `expandedTrackId`), repliée par défaut ; remplacer la rangée de pills d'horodatage par un simple `{track.keyframes.length} keyframes`.

**Validation E1 :** chaque piste = une carte compacte ; détails dépliables à la demande.

## E2 — Lisibilité des lanes (clusters + label déplacé)
Dans la lane (1er `automationTracks.map`) : (a) si l'écart pixel entre 2 keyframes < 6px au zoom courant, n'afficher qu'un badge cluster au lieu des diamants superposés ; (b) déplacer le label de piste (actuellement flottant `z-10` sur la courbe) dans la colonne gauche `w-14` « AUTO » : y mettre la pastille `track.color` + label abrégé, et retirer le label flottant.

**Validation E2 :** au dézoom, plus de grappes illisibles ; la zone de courbe est dégagée.

## E3 — Minimap plus lisible
Sur la minimap (Phase 1, chercher `{/* Minimap */}`) : passer `h-3` → `h-5` ; blocs clips `opacity-60` → `opacity-90` ; cadre viewport : bordure explicite `border border-cyan-400/70`.

**Validation E3 :** minimap lisible d'un coup d'œil, cadre viewport net.

## E4 — Regrouper la barre de contrôles
Insérer des séparateurs `<div className="w-px h-4 bg-slate-700 mx-1" />` entre les groupes : [transport] | [zoom] | [snap/bpm/follow] | [loop]. Vérifier que chaque bouton icône a un `title`.

**Validation E4 :** barre lisible, groupes visuellement distincts.

**→ Type-check du Groupe E.**

---

# GROUPE C — Nettoyage (données/logs factices)

## C1 — Données de démo factices
**Fichier :** `apps/web/src/store/slices/timelineSlice.ts`. Dans `createTimelineSlice`, remplacer les valeurs initiales `clips`, `markers`, `automationTracks` (les entrées `INTRO BUILD`, `mkr-1`, `auto-dimmer-6`…) par `[]`. (Si on veut un show de démo : le mettre derrière une action explicite « Charger démo », hors scope ici.)

**Validation C1 :** en `localStorage` vierge (navigation privée), la timeline démarre vide.

## C2 — Faux logs « AI Inspector » (dédupliqués)
**Fichiers :** `MacroTimeline.tsx` (const `TIMELINE_INSPECTOR_INIT_LOGS`) et `apps/web/src/store/slices/uiSlice.ts` (const `DEFAULT_AI_INSPECTOR_LOGS`). D'abord `grep` lequel est réellement rendu, supprimer les entrées factices, initialiser `aiInspectorLogs: []`. Empty-state : afficher un littéral « Aucun évènement » dans le composant, pas des faux logs.

**Validation C2 :** au démarrage vierge, aucun faux log type « Moving Head 2 missed RDM ping ».

**→ Type-check du Groupe C + test navigation privée.**

---

# P0-ENGINE — Boucle de refresh DMX serveur (le plus impactant, à part)

> **Périmètre serveur, plus délicat. Ne pas mélanger avec les groupes UI ci-dessus.** Fichier principal : `apps/server/services/dmxRouter.ts` (+ `index.ts` handler `dmx_update`). À faire en PR dédiée avec tests.

**Pourquoi :** vérifié — `dmxRouter.ts` n'a AUCUNE boucle de refresh : chaque message `dmx_update` fan-out immédiatement vers les 5 sorties. À l'échelle → event-loop saturé, strobes qui flickent, sorties désynchronisées.

**Conception cible (modèle console pro) :**
1. `dmxRouter.setChannel(u, ch, v)` n'émet PLUS directement. Il écrit dans un buffer en mémoire `pending: Map<universe, Uint8Array(512)>` + marque l'univers « dirty ».
2. Une boucle `setInterval(() => flush(), 25)` (≈40Hz) draine les univers dirty : pour chacun, construit le buffer 512 et l'envoie **une fois** par sortie (Python, qlcOsc, qlcWs, artNet, usbDmx).
3. Conserver la transmission différentielle au niveau sortie si pertinent, mais la cadence est désormais fixe (40Hz), pas dictée par l'arrivée des messages.
4. (Étape 2, optionnelle) Art-Net Sync packet (OpCode `0x5200` ArtSync) après l'envoi des univers dirty, pour déclencher les fixtures en lockstep.
5. Synchroniser le flush USB-DMX sur la même horloge (supprimer son `setInterval(23ms)` indépendant ; le faire piloter par le flush central).

**Tests à ajouter (manquants aujourd'hui) :** `apps/server/services/__tests__/dmxRouter.test.ts` — vérifier : (a) N writes sur le même canal entre 2 flushs = 1 seul envoi ; (b) la cadence de flush ≈40Hz ; (c) HTP : si deux sources écrivent le même canal, la plus haute valeur (ou la priorité définie) gagne.

**Validation P0 :** show avec strobe + chase sur USB **et** Art-Net → plus de scintillement ni de désync entre sorties ; CPU serveur stable sous charge (256 canaux actifs).

---

# Récapitulatif des fichiers touchés

| Groupe | Fichiers |
|---|---|
| A (justesse UI) | `MacroTimeline.tsx` |
| B (features) | `MacroTimeline.tsx`, `timelineSlice.ts`, `uiSlice.ts`, `useStore.ts` |
| C (nettoyage) | `timelineSlice.ts`, `uiSlice.ts`, `MacroTimeline.tsx` |
| D (bug hauteur) | `MacroTimeline.tsx` |
| E (UX/UI) | `MacroTimeline.tsx` |
| P0 (moteur) | `apps/server/services/dmxRouter.ts`, `apps/server/index.ts`, `artnet.ts`, `usbDmx.ts` + tests |

# Vérification finale (après tous les groupes UI A–E + C)
1. `cd apps/web && npx tsc --noEmit` → zéro erreur.
2. `npm run dev --workspace apps/web` → app sur :3000, code 200.
3. Dérouler chaque bloc « Validation » ci-dessus.
4. Aucune erreur console ; aucune régression sur les features Phase 1 (resize, pan, snap, grille BPM, courbe SVG, minimap).
---

# Etat d'execution - 2026-06-24

## Statut global
- Groupe A - Correctness moteur UI : fait.
- Groupe D - Hauteur/scroll des pistes : fait.
- Groupe B - Fonctionnalites timeline : fait.
- Groupe E - UX/UI timeline : fait.
- Groupe C - Nettoyage donnees demo/logs IA : fait.
- P0-ENGINE - Buffer + flush DMX serveur : fait en version prudente.

## Details implementes
- `MacroTimeline.tsx` : timer remplace par `requestAnimationFrame`, follow playhead activable/desactivable, pan manuel qui coupe le follow, early-return de sync quand les sets actifs ne changent pas.
- `MacroTimeline.tsx` : tracks principales en hauteur fixe, lanes automation fixes avec scroll vertical, minimap agrandie, viewport plus visible.
- `MacroTimeline.tsx` : snap et grille BPM lus depuis Zustand, bouton FOLLOW, BPM input, TAP tempo, inputs loop in/out, separators de groupes de controles.
- `MacroTimeline.tsx` : markers editables avec drag horizontal, rename/recolor, suppression, et actions branchees sur le store.
- `MacroTimeline.tsx` : keyframes automation deplacables en temps + valeur, Shift+drag pour verrouiller le temps, clustering visuel des keyframes proches.
- `MacroTimeline.tsx` : panneau Automations DMX compact avec details deployables et compteur de keyframes.
- `timelineSlice.ts` : `updateMarker` ajoute, `addMarker/updateMarker/deleteMarker` passent par history undo/redo, et donnees demo initiales supprimees.
- `uiSlice.ts` + `useStore.ts` : `snapEnabled` et `bpmGridVisible` ajoutes/persistes ; faux logs AI Inspector supprimes.
- `dmxRouter.ts` : `setChannel` n'emet plus directement ; ecrit dans un buffer pending + dirty channels ; flush central `25ms` environ 40 Hz.
- `dmxRouter.ts` : live state expose via `getLiveUniverse`, Safety Gate conservee dans le hot path, sortie Python/QLC/Art-Net/USB appelee au flush.
- `usbDmx.ts` : ajout `setExternalFlush()` et `flushNow()` pour que le routeur puisse piloter l'USB sur l'horloge centrale.
- `index.ts` : `/api/dmx/live` lit le nouvel etat live du routeur ; sortie Python activee quand le bridge est pret.

## Validations executees
- `npm run typecheck --workspace web` : OK.
- `npm run lint --workspace web` : OK.
- `npm run typecheck --workspace server` : OK.
- `npm run typecheck --workspaces` : OK.
- `npm run test:api` : OK, smoke tests fixtures, library, safety, show-actions, project-packages.
- `npm run build --workspace web` : compilation Next.js OK, puis blocage Windows connu `spawn EPERM` apres compilation.

## Points restants / limites
- Validation materielle DMX a faire sur vrai setup USB/Art-Net avec strobe + chase + 256 canaux actifs.
- Tests unitaires dedies `dmxRouter` non ajoutes dans ce passage ; le smoke API existant passe.
- Art-Net Sync packet (`OpCode 0x5200`) reste optionnel/non implemente.
- HTP/priorites multi-sources non implementees : le comportement actuel reste last-write-wins dans le buffer pending.
- `graphify update .` non execute : commande `graphify` introuvable dans ce shell.
- Build production bloque encore sur `spawn EPERM`, independant du parsing `timelineSlice.ts` ; redemarrer/supprimer cache `.next` cote machine si Turbopack affiche un ancien message.

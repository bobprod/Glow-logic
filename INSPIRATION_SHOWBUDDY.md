# Inspiration — Show Buddy Active / DMXIS → Glow Logic

> Veille concurrentielle sur **Show Buddy Active** (manuel v2.0) et la **DMXIS Knowledge Base** (même éditeur, DB Audioware). Objectif : lister ce qu'on **reprend en concept** (UX/features — non protégeables) pour combler les lacunes de `AUDIT_GLOW_LOGIC.md`. On ne copie **ni code, ni assets, ni format de fichier fixtures, ni le namespace OSC `/dmxis/*`** ; pas de décompilation. Document de référence pour Codex/Claude.
>
> Maj : 2026-06-24.

## Contexte produit (leçon stratégique)
DB Audioware vend **deux** produits, soit deux modes assumés :
- **Show Buddy Active** = busking (presets/banques déclenchés à la main, pied/MIDI/OSC, + plug-in VST/AU calé sur le DAW).
- **Show Buddy Setlist** = « DAW simplifié » : joue les **backing tracks audio**, les cues lumière/MIDI se déclenchent **automatiquement sur la waveform**, mains-libres.

→ Ça valide le split de Glow Logic **Smart (busking) vs Creator/timeline (design)**. La timeline doit viser le cas **Setlist** : *charger un morceau → poser des cues sur la waveform → ça joue tout seul* (rejoint l'opportunité IA #3 de l'audit : générateur de timeline synchro au beat).

---

## A. Backlog FEATURES (priorisé : impact sur l'audit × réutilisation de l'existant)

### A1 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Oscillateur-à-Chase = l'Effect Engine UI manquant
> Fichiers : `lib/oscillatorEngine.ts` (moteur pur + test), `lib/oscillatorDriver.ts` (boucle 40Hz), `store/slices/oscillatorSlice.ts`, `components/smart/OscillatorPanel.tsx` (monté dans le VJ Deck de SmartDashboard). Vérif : `tsc` 0 err, `npm run test:osc` PASS, `test:unit` non-régression OK. Reste possible : presets de shapes (cercle/figure-8 pan-tilt), sync au playhead timeline.

Sélection de canaux → oscillateur **Sine/Square/Triangle/Saw** avec : **Amount**, **Chase** (déphasage réparti sur la sélection = chases auto), **Speed en mesures musicales**, **Shape** (morph d'onde). Sur pan/tilt → cercles/figure-8 instantanés.
- **Comble** : audit 🔴 « pas d'effect engine UI » (#1 fonctionnel).
- **Réutilise** : `apps/web/src/lib/EffectEngine.ts`, `apps/web/src/lib/trajectoryGenerator.ts` (déjà en lib, sans UI).
- **Le truc à voler** : *Chase = phase répartie sur la sélection* + *Speed en mesures, pas en ms*.

### A2 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Channel Masking → presets « mixables » (console tracking)
> Additif & rétro-compatible. `SmartPad.enabledChannels?: number[]` (undefined = tous appliqués = comportement actuel ; `[]` = neutre). Actions `setSceneMask/clearSceneMask/toggleSceneChannel` (undo/redo). Filtre au chargement dans `triggerSmartPad` (filtre dmxValues + dmxCommands avant `dmxEngine.setChannel`). UI : `components/smart/SceneMaskEditor.tsx` montée dans `PadConfigModal`. Vérif : tsc 0, test:unit + test:osc non-régression OK. Reste : Timeline n'a que `dmxCommands` (pas `dmxValues`) → masking pas encore hérité côté Creator ; **débloque A5 (Flash)**.

Un preset ne transmet QUE ses canaux **activés** ; les autres restent inchangés. Permet des banques séparées (couleurs / mouvements / vidéos) **superposables** → des centaines de looks à partir de quelques presets.
- **Comble** : audit 🔴 cue stacks/submasters + la dette « modèle scène dupliqué Smart/Creator ».
- **Saut conceptuel** : passer de *preset console* (last-write-wins) à *tracking console* (looks empilables). **Débloque aussi A5 (Flash).**
- **Branche** : `timelineSlice.ts` (modèle scène/clip), `dmxEngine.ts` (précédence canal).

### A3 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Crossfade intelligent par preset
> `lib/crossfadeEngine.ts` (moteur 40Hz + `crossfadeValueAt` pure testée). Au déclenchement d'une scène, si `fadeSeconds>0` (barre master B1), fondu **lisse** des canaux continus (dimmer/RGB/pan-tilt…) et **snap à mi-course** des discrets (gobo/couleur/prism/macro). Respecte le masque A2 + masterDimmer ; flash reste instantané ; `fadeSeconds===0` = comportement actuel. Vérif : tsc 0, test:crossfade + unit/osc OK.
> ✅ **Hérité par la TIMELINE (Chantier 2, 2026-06-25)** : `TimelineClip` gagne `enabledChannels?`/`fadeSeconds?` (optionnels) ; au déclenchement d'un clip, filtrage masque A2 + `startCrossfade` (A3) avec source `timeline` ; `crossfadeEngine.startCrossfade` accepte une source optionnelle (défaut inchangé). UI Fade+masque dans `SceneClipPanel`. **Invariant** : clip sans masque ni fade = `forEach` instantané d'avant. Premier pas vers l'unification du modèle scène (dette #1).

Fade par preset (override master), **selon le type de canal** : RGB/pan-tilt glissent, roues gobo/couleur **snappent à mi-fondu** ; resync des oscillateurs pendant le fade.
- **Comble** : audit « follow/fade times » des cue stacks.
- **Branche** : `apps/web/src/store/slices/showPlayerSlice.ts`, `dmxEngine.ts`.

### ✅ Horloge audio Timeline LIVRÉE (Chantier 1, 2026-06-25) — le déblocage Setlist
> `ShowAudioEngine` gagne l'API piste maître (`loadTrack`/`playTrack`/`pauseTrack`/`seekTrack`/`getAudioPositionMs`/`hasTrack`/`isTrackPlaying`), FFT/beat préservés. `MacroTimeline` : contrôle « Charger audio », transport branché (play/pause/seek pilotent l'`<audio>`), et **boucle RAF à 2 branches** : piste qui joue → playhead = position audio ; sinon → accumulation delta **inchangée** (invariant prouvé, pas de feedback loop). Charger un morceau → la timeline se cale dessus. **Débloque** la waveform visuelle + l'édition de cues A4 ci-dessous. Vérif : tsc 0, non-régression des 5 moteurs OK.
> ✅ **Waveform visuelle LIVRÉE (Chantier 3, 2026-06-25)** : `components/timeline/WaveformView.tsx` (canvas natif, HiDPI) lit `ShowAudioEngine.getWaveformData(url)`, dessine l'enveloppe pour la **fenêtre visible** (aligné zoom/pan), trace le playhead, **clic/drag = seek**. Lane fine sous la règle, rendue **uniquement si une piste est chargée** (invariant : sans piste, rien). Charger un morceau → voir la forme d'onde → scrub. Vérif : tsc 0, 5 moteurs OK.

### A4 — ✅ LIVRÉ (2026-06-25, équipe d'agents) — Édition de cues en GROUPE (Setlist)
> Actions bulk marqueurs (`addMarkers`/`updateMarkers`/`moveMarkers`/`deleteMarkers`) avec **un seul undo par groupe** (coalesce). `MacroTimeline` : `selectedMarkerIds` local, **Shift+clic** multi-select, **Ctrl+drag** box-select, drag de groupe, **Alt** = dupliquer, **Delete** = supprimer groupe, **Échap** = désélection, copier/coller. Gestes **non-conflictuels** (seek/loop/pan/add-marker/drag-single préservés ; raccourcis clips neutralisés si marqueurs sélectionnés). Invariant : sélection vide/single = comportement actuel. Vérif : tsc 0, 5 moteurs OK. _Reste : copier-coller inter-morceaux (trackSequences)._

### A4 (réf.) — Édition de cues en GROUPE sur la waveform (Setlist) + waveform = horloge
- Box-select dans la waveform (hors labels/handles) → déplace un **groupe** de cues.
- **Ctrl-drag = dupliquer** une séquence (répéter un refrain).
- **Ctrl-C / Ctrl-V inter-morceaux** (copier un groupe, repositionner le playhead, coller).
- Cas : « le mix change de quelques mesures → repositionner toute la séquence ».
- **Comble** : timeline « show driver » + cas Setlist mains-libres ; débloque le B6 « waveform audio » différé du `PLAN_EXECUTION_TIMELINE.md`.
- **Branche** : `apps/web/src/components/MacroTimeline.tsx`, `apps/web/src/lib/ShowAudioEngine.ts`.

### A5 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Boutons Flash (momentané)
> `SmartPad.flash?: boolean`. `flashPadOn` snapshot les valeurs courantes (`dmxEngine.getChannel`) puis applique le pad (respecte le masque A2 + masterDimmer) ; `flashPadOff` restaure + purge (Map transitoire `flashSnapshots`). UI : toggle dans `PadConfigModal` + handlers `onPointerDown/Up/Leave` conditionnés à `pad.flash` dans `ScenePad`. Rétro-compat : flash absent = toggle inchangé. Vérif : tsc 0, test:unit + test:osc OK.

Presse = preset activé, relâche = retour à l'état précédent. **Recette = preset masqué (juste blinder/strobe) + preset "off"**. Mappable MIDI. Blinder de foule, strobe, hazer à la demande.
- **Dépend de A2 (masking).** Petit effort, fort impact busking.
- **Branche** : `smartModeSlice.ts` (pads), MIDI learn existant.

### A6 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Macros (raccourcis busking)
> `lib/macrosEngine.ts` (NAMED_COLORS + `colorByName` + `linearSpread`, testé). `components/smart/MacrosPanel.tsx` (monté VJ deck) : presets couleur RGB/W, fan de dimmer (spread linéaire), center pan/tilt, blackout sélection — sur les projecteurs sélectionnés, via `dmxEngine.setChannel`. Purement additif. Vérif : tsc 0, test:macros OK, **rendu live confirmé**.
> ✅ **SHAPES LIVRÉ** : section SHAPES (Cercle / Figure-8 / Sweep) sur pan-tilt des têtes sélectionnées, en créant des oscillateurs A1. Ajout d'un champ `phase` à `OscillatorConfig` (défaut 0, invariant) → cercle = pan/tilt déphasés de 90°. tsc 0, test:osc + non-régression OK.

Menus : **Fan**, **Shapes** (cercles/figure-8 sur pan/tilt via oscillateurs), **Select** (auto-sélection pan/tilt), **Repeat last fixture**, **Global edits** (set front light pour tout le show), **Color set** (RGB → couleur nommée).
- Accélère patch + programmation. SBA les stocke en `.py` (scriptable) — on peut commencer par un menu d'actions câblées.

### A7 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Table de re-patch (show générique)
> `services/patchTable.ts` (parse/resolve/serialize, syntaxe `F:C` · `S/E:C` · `F:C1,C2`, testé). `dmxRouter` : helper `applyPhysical` (sécurité sur canal **physique**), résolution patch pour univers 1 si table non vide, sinon 1:1. `setPatch/getPatchSpec`, chargé depuis settings dans `loadConfig`. API `GET/POST /api/patch`. **Invariant table vide = 1:1** prouvé, test:dmx vert. Vérif : serveur tsc 0, test:patch + test:dmx OK.
> ✅ **UI LIVRÉE** : `components/smart/PatchEditor.tsx` (GET/POST `/api/patch` via `apiFetch`, textarea de spec + validation ligne par ligne, Enregistrer / Réinitialiser 1:1, toasts) montée dans `PatchPanel` (vue PATCH). tsc 0, unit OK.
Patch 1:1 par défaut, override : `FADER:CH`, ranges `START/END:CH`, 1 fader→N canaux, plusieurs fixtures sur un fader. Permet un show qui marche quel que soit l'adressage du club/théâtre.
- Feature touring. **Branche** : StagePlan/patch (`proView === 'patch'`).

### A8 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — OSC bidirectionnel avec feedback
> Service serveur `services/oscControl.ts` (namespace propre `/glow/*`) : reçoit `/glow/ch/<u>/<c>` → `dmxRouter.setChannel` (safety-gated), `/glow/blackout` & `/glow/bpm` → events socket existants ; **feedback** throttlé (~5Hz) renvoyant l'état DMX vers la cible OSC. Config via settings (`osc_control_enabled/port/host`), **no-op en test**, wiring additif `index.ts`. Vérif : serveur tsc 0, test:dmx OK. Reste : feedback labels master%/noms de scènes (état client à ponter).

### A9 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Master « intelligent » (+ Speed global à venir)
> `lib/masterScale.ts` : `applyMaster(value, type, masterDimmer)` n'atténue que les canaux d'intensité (dimmer/RGB/W/strobe), ignore pan/tilt/gobo/roues. Remplace `scaleValue` dans triggerSmartPad (instant + fade A3) + flashPadOn, avec résolution de type par canal. **Invariant master=255 → 0 régression** (le fix ne se manifeste qu'en atténuant : les têtes ne dérivent plus). Vérif : tsc 0, test:master + non-régression des 4 autres moteurs OK.
> ✅ **Speed global LIVRÉ** : `effectSpeed` (uiSlice, clamp 0.1..8, persisté) = multiplicateur de vitesse des oscillateurs, **indépendant du tempo** ; `oscillatorValue` accepte `opts.speedMultiplier` (défaut 1, invariant) ; contrôle SPEED dans le groupe MASTER de la TopBar (0.25..4x). tsc 0, test:osc (cas speedMultiplier) + non-régression OK.

### A10 — ✅ v1 LIVRÉ (2026-06-25, équipe d'agents) — Pixel-mapping (champ analytique → fixtures RGB)
> `lib/pixelMapEngine.ts` : `pixelColorAt(cfg, t, x, y)` = champ de couleur **pur/testable** (solid/sweep/pulse/rainbow, hexToRgb robuste). `lib/pixelMapDriver.ts` (40Hz, modèle oscillatorDriver) : normalise la bounding box des positions de grille, échantillonne par fixture RGB → `dmxEngine` (source background). `store/slices/pixelMapSlice.ts` (persisté) + `components/smart/PixelMapPanel.tsx` (toggle/type/couleurs/vitesse) montés dans le VJ deck. **Invariant** : `enabled=false` (défaut) → 0 émission (2 barrières). Vérif : tsc 0, test:pixelmap + 5 moteurs OK. ✅ **v3 LIVRÉ (2026-06-25)** : calque **vidéo** dans le projecteur (HTMLVideoElement autoplay/loop, dessiné après l'image en cover, helper drawCover) + upload vidéo dans PixelMapPanel. DMX/lumières (pixelMapDriver) inchangés. Pixel-mapping complet : champ -> lumières + image + texte + vidéo -> projecteur. tsc 0, test:pixelmap OK.
> ✅ **v2 LIVRÉ (2026-06-25)** : `renderPixelMapToCanvas` (fond = champ v1 échantillonné 48×48 + calque **image** cover + calque **texte** centré, garde défensive si pas de ctx). `PixelMapProjector.tsx` = overlay/fenêtre **projecteur** plein écran (canvas rAF, image, fullscreen/close ; `null` si fermé), calqué sur `VideoProjectionWindow`. Contrôles texte/image/Projecteur dans `PixelMapPanel`. **Le DMX reste sur le moteur v1** (`pixelColorAt`/`pixelMapDriver` inchangés → 0 régression lumières) ; lumières + projection partagent la même config. Vérif : tsc 0, test:pixelmap + 5 moteurs OK.

### A10 (réf.) — Pixel-mapping FX en calques (gros module, différenciant)
Calques rect/cercle/star/starfield/**texte**/**image**/**vidéo**/**mask**, gradients HSB, rotate/spin/scroll, **sound-trigger + oscillateur sur n'importe quel contrôle**, pixel-mappé vers RGB + sortie projecteur. La media-gen actuelle est un stub.

### A11 — Sync tempo type host → Ableton Link
Concept du VST (oscillateurs calés sur le tempo/position du DAW). Version web : **Ableton Link** pour caler le tempo sans plug-in.

---

## B. Backlog ERGONOMIE FRONTEND

> État actuel : **3 vues** = Smart (busking) / Creator (sous-vues `proView` canvas·patch·visualizer) / Live (`LivePerformanceView`, plein écran) + MacroTimeline persistante. **3 vues = OK** (SBA a 3 écrans Controls/Effects/Perform + visualiseur). La Live view réutilise `SceneController`/`GroupStrips` → pas de 3e éditeur redondant, à garder. Règle SBA : **des écrans = des phases de travail, pas des façons parallèles de faire la même chose.** Risque réel = modèle look dupliqué (cf. audit), pas le nombre de vues.

### B1 — ✅ LIVRÉ (2026-06-24, équipe d'agents) — Barre Master/Transport persistante (toutes vues)
> Groupe MASTER compact dans `TopBar` (persistante 3 vues) : slider Master Dimmer (lié à `masterDimmer` 0..255, qui pilote vraiment `scaleValue` sur la sortie DMX) + champ Fade (`fadeSeconds` ajouté à uiSlice + partialize). BPM/Tap/Blackout intacts (additif). **Testé live** : master réglé à 50% persiste SMART→CREATOR. tsc 0, tests OK.

Aujourd'hui éparpillé : Show Lock + Edit Mode + MIDI Learn (header SmartDashboard), BPM/Tap (timeline), Blackout (Live). → **Une seule barre** partagée : Master dimmer · Blackout · BPM/Tap · Fade · Speed · MIDI Learn. Plus gros gain de cohérence.
- **Branche** : `TopBar.tsx` + `AppShell.tsx`.

### B2 — ✅ LIVRÉ (2026-06-25, équipe d'agents) — Sélection unifiée visualiseur ↔ contrôles ↔ faders
> Une seule source de vérité (`uiSlice.selectedFixtureIds`). Setters unifiés (`selectFixture`/`toggleFixtureSelection`) ; les writers 3D (`FixtureRenderer`), plan (`StagePlan`) et canvas (`AppShell`) écrivent tous le même état (multi-select Shift/Ctrl) ; tous les readers (Macros/Oscillator/SceneMask/FixtureController + surlignages) lisent ce tableau. Additif (interactions conservées). Comble la dette « 3 îlots ». Vérif : tsc 0, non-régression des 5 moteurs OK.
Dans SBA, sélectionner dans le visualiseur pilote faders + contrôles context-sensitive. Chez nous, visualizer / canvas / FixtureController = îlots séparés. → **Sélection globale** dans le store, lue par toutes les vues.
- **Branche** : `reactFlowSlice.ts` / un `selectionSlice`, `FixtureController.tsx`, `VisualizerView.tsx`.

### B3 — ✅ LIVRÉ (2026-06-25, équipe d'agents) — Panneau de contrôle context-sensitive
> `FixtureQuickStrip` : en multi-sélection, valeur **commune** affichée si identique, sinon état **MIXTE** (badge « — » + slider grisé `opacity-50`) ; l'édition s'applique à **toutes** les fixtures sélectionnées (déjà le cas). Helpers `isMixed`/`getAggregatedValue` gardés par `targets.length<=1`. Invariant : sélection unique/nulle = comportement legacy (lecture/écriture identiques). Capitalise sur B2. Vérif : tsc 0, non-régression OK.

### B4 — ✅ LIVRÉ (2026-06-25, équipe d'agents) — Mode « Hide unused / Focus »
> `uiSlice.focusMode` (persisté) + toggle « Focus » (icône Filter) dans l'en-tête du `FixtureController`. Actif → n'affiche que les fixtures utilisées (`channels.length > 0`), filtrage à l'affichage (store non muté), empty-state. Invariant : OFF (défaut) = toutes les fixtures. Vérif : tsc 0, non-régression OK.

### B5 — Live view = scène (gros boutons, fort contraste, zéro chrome)
Pousser `LivePerformanceView` : cibles tactiles larges, typo grosse, blackout géant, lisible à 2 m. Le plein écran est déjà là.

### B6 — Réduire la densité décorative
Beaucoup d'emoji (🎹🎬🎛), glows, gradients, badges. SBA est plat/fonctionnel. Pour un outil de scène : **lisibilité > déco** — iconographie lucide cohérente, moins de halos, hiérarchie typo nette.

### B7 — Nommer les vues par tâche
Sélecteur haut niveau lisible comme un workflow — **DESIGN · BUSK · LIVE** — avec canvas/patch/3D clairement subordonnés à Design (pas des onglets d'apparence égale).

---

## C. Mapping audit → quoi prioriser
| Lacune audit | Item à prendre |
|---|---|
| 🔴 Pas d'effect engine UI | **A1** |
| 🔴 Cue stacks / busking incomplets | **A2 + A3 + A4 + A5** |
| 🔴 Pas de submasters | **A2** (masking = looks empilables) |
| Modèle scène dupliqué Smart/Creator | **A2 + B2** (modèle look partagé + sélection unifiée) |
| 🟠 Pas de pixel-mapping | **A10** |
| Modes « fragmentés » | **B1 + B2 + B7** (master persistant, sélection partagée, nommage workflow) |

## Reco d'ordre
**A1** (réutilise l'existant, comble le #1) → **A2** (débloque submasters + A5 + unifie le modèle) → **B1** (cohérence ergo immédiate) → **A3/A4** (show driver) → reste selon roadmap.

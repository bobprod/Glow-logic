# Audit Glow Logic — Points forts, points faibles & fonctionnalités déterminantes

> **Audit du logiciel entier** (pas seulement la timeline). Produit par une revue à 3 agents experts — un par domaine (moteur temps réel / IA & innovation / parité fonctionnelle pro) — puis synthétisé et **vérifié contre le code** par le lead. Les affirmations déterminantes ont été contrôlées par lecture directe du source. Ce document est autonome : n'importe quel agent IA peut le lire à froid pour comprendre où en est Glow Logic et quoi construire ensuite.
>
> **Légende :** ✅ = vérifié dans le code · ⚠️ = affirmation d'agent non re-vérifiée individuellement · 🔴 critique · 🟠 important · 🟡 mineur.

---

## Résumé exécutif

Glow Logic est aujourd'hui **un excellent contrôleur DMX / surface de jeu VJ-DJ avec une vraie brique IA différenciante**, mais **pas encore une console de spectacle « show driver » de niveau pro**. Trois constats structurants :

1. **Moteur** — solide sur la résilience (offline, safety, protocoles bas niveau corrects) mais **il manque la boucle de refresh DMX 40Hz côté serveur** (✅ confirmé) — risque #1 en production (strobes qui scintillent, sorties désynchronisées).
2. **IA** — des briques réelles et rares (fixture-ID par vision+LLM, audio-réactif temps réel, contrôle en langage naturel câblé), mais aussi des coquilles (média generation = stub, autopilot = UI seule) et aucune boucle d'apprentissage.
3. **Fonctionnel** — il manque les piliers du travail live : **effect engine UI, cue stacks/busking, submasters**, et le modèle de données « scène » est **dupliqué** entre les modes Smart et Creator.

---

## Domaine G — Moteur temps réel & pipeline de sortie

### Points forts
- **Priorité à 3 niveaux + verrouillage canal** — précédence background/timeline/manuel ; une saisie manuelle verrouille le canal ~1,2 s pour qu'un fondu timeline ne le détourne pas. `apps/web/src/lib/dmxEngine.ts:24-34,79-110` (précédence type HTP, côté client).
- **Résilience offline** — écritures DMX persistées en localStorage quand le socket tombe, vidées à la reconnexion, survit au reload, et **testé unitairement**. `apps/web/src/lib/dmxOfflineQueue.ts`, `dmxEngine.ts:309-329`.
- **Transmission différentielle** — seuls les canaux modifiés sont envoyés. `dmxEngine.ts:331-352`.
- **Safety gate pragmatique** — état safety caché 250 ms côté serveur pour ne pas bloquer le hot-path DMX ; laser bridé à 64/255 ; geofence drone ; IA/API interdites d'armement. `apps/server/services/safetyGate.ts:36,39-173`.
- **Protocoles bas niveau corrects** — vrai DMX512 UART (BREAK→MAB→startcode) à ~44Hz sur USB ; paquet Art-Net ArtDmx conforme. `apps/server/services/usbDmx.ts:199-235`, `artnet.ts:28-54`.
- **Protection crash** — handlers globaux uncaughtException/unhandledRejection + reconnexion série. `apps/server/index.ts:111-129`.

### Points faibles
- **🔴 ✅ PAS de boucle de refresh côté serveur.** `apps/server/services/dmxRouter.ts` n'a aucun timer/refresh/flush (vérifié). Chaque `dmx_update` fan-out immédiatement vers les 5 sorties. À l'échelle (256 canaux × 44Hz × 5 sorties ≈ 56k I/O/s) l'event-loop sature → pics de latence, strobes qui flickent, désync strobe/chase multi-sorties. **Risque #1 production. Sévérité : HAUTE.**
- **Pas de merge HTP/LTP serveur** — last-write-wins ; deux sources sur un même canal clignotent (multi-opérateur, ou timeline + manuel). `dmxRouter.ts`. MOY-HAUTE.
- **Pas de paquets Art-Net Sync / pas d'horloge de trame globale** — sorties cadencées par l'arrivée des messages, pas un 40Hz fixe ; le flush USB (23 ms) et Art-Net ne sont pas synchronisés → jitter inter-sorties. `artnet.ts:28-54`, `usbDmx.ts:180-189`. MOY.
- **Fondus côté client envoyés sur le réseau** — `DmxFader` tourne sur rAF navigateur ; si l'onglet/la tablette throttle, les fondus saccadent côté serveur. `apps/web/src/lib/DmxFader.ts`. BAS-MOY.
- **Aucun test sur le chemin de sortie serveur** — `dmxRouter/artnet/usbDmx/qlcWsService` non testés. MOY-HAUTE.

### Lacunes déterminantes (ce que les consoles pro ont, pas Glow Logic)
Boucle de refresh 40Hz serveur · moteur de merge HTP/LTP · Art-Net Sync + horloge de trame unifiée · sACN/E1.31 · RDM · timecode LTC/MTC/MIDI-clock en entrée (le service `syncClock` est minimal) · moteur de fondu côté serveur · enregistrement/inspection de l'état univers.

---

## Domaine H — IA & innovation

### Ce qui est réellement construit (réel vs mock)
- **✅ RÉEL — Fixture auto-ID (OCR + LLM vision/texte).** Tesseract + LLM multi-fournisseur (OpenAI/Anthropic/custom), fallback vision→texte, réparation JSON robuste, normalisation de 23 types. `apps/server/services/ocr.ts`, `fixture-ai.ts:36-382`, endpoints `index.ts:1127-1278`. **Vrai différenciateur** — quasi inexistant ailleurs en DMX.
- **✅ RÉEL — Diagnostic matériel IA.** État ports/process en direct → dépannage LLM (FR). `anomalyDetector.ts:130-208`, `index.ts:230-240`.
- **✅ RÉEL — Moteur audio-réactif.** FFT Web Audio (basses/médiums/aigus), beat detection + BPM live → dispatch DMX par groupe. `apps/web/src/lib/ShowAudioEngine.ts:184-370`. Limité à 3 presets en dur (jazz/tv/club).
- **✅ RÉEL — Géométrie shape/trajectoire + effets.** Lissajous/cercle/sweep/free pan-tilt ; générateur d'effets rAF. `trajectoryGenerator.ts:45-126`, `EffectEngine.ts`. Déterministe, pas IA.
- **✅ RÉEL & CÂBLÉ (l'agent s'était trompé) — Orchestrator en langage naturel.** ⚠️ L'agent affirmait « pas de backend » ; **vérifié faux** : `OrchestratorController.tsx` appelle `/api/llm/chat` (`:301`), qui existe (`index.ts:534`), parse la réponse et exécute via `dmx_update` (`:369`). Le contrôle NL fonctionne de bout en bout. La vraie lacune : **aucune validation safety sur ce chemin d'exécution**, et pas de schéma d'action structuré.
- **🟠 STUB — Génération média.** ✅ vérifié : `mediaGenerator.ts` n'a AUCUN appel fournisseur réel (pas de fetch/http ; tous `configured:false`) ; il ne fabrique que des métadonnées de job + un storyboard en dur. L'UI laisse croire à une génération qui n'arrive jamais. `mediaGenerator.ts:4-171`, `index.ts:665-688`.
- **🟠 UI SEULE — Autopilot.** Toggle `smartAutoPilot` + réticule cosmétique + évènements timeline mockés ; aucune boucle de décision autonome. `SmartSyncHub.tsx:70-160`.

### Points forts
Fixture-ID vision+LLM, audio→DMX faible latence en navigateur, dépannage assisté IA, et la prise en compte safety des actions IA sont réels et rares dans cette catégorie.

### Points faibles
Autopilot/média = coquilles ; le mapping audio est heuristique réglé à la main (pas d'apprentissage) ; aucune boucle de feedback (les corrections n'améliorent rien) ; estimateur BPM basique (pas de confiance/changement de tempo) `ShowAudioEngine.ts:240-252` ; validation safety appliquée à SmartSyncHub mais **pas** au chemin d'exécution de l'Orchestrator.

### Opportunités IA classées (impact × faisabilité, en réutilisant l'existant)
1. **Approfondir l'Orchestrator** (déjà fonctionnel) — schéma d'action structuré + validation safety-gate sur `/api/llm/chat`. Réutilise `safetyClient`, `dmxEngine`. HAUT × HAUT.
2. **Auto-sélection de preset par l'audio** — un LLM léger choisit périodiquement le preset selon l'empreinte audio live. Réutilise `ShowAudioEngine`. HAUT × HAUT.
3. **Générateur de timeline synchro au beat** — upload d'un morceau → sections/beats → clips+keyframes auto. Réutilise `ShowAudioEngine`+`trajectoryGenerator`+`EffectEngine`. HAUT × HAUT.
4. **Génération safety-aware** (budgets de danger dans le prompt + gate). Réutilise `safetyGate`. MOY-HAUT.
5. **Chorégraphie multi-groupes en NL** (trajectoires décalées en phase). Réutilise `trajectoryGenerator`+`showActions`. MOY.
6. **Génération média réelle** (câbler Replicate/Veo). MOY × MOY-BAS.
7. **Boucle d'apprentissage fixture-ID** (logger les corrections → affiner le prompt/fine-tune). MOY.

---

## Domaine I — Parité fonctionnelle & workflow pro

### Points forts
Split **Smart (busking) vs Creator (design)** sans distraction ; 64 pads de scène (4×16) + MIDI learn (`smartModeSlice.ts:46-51`) ; canvas node à 8 types (`AppShell.tsx`) ; visualiseur 3D avec toggle live/preview de sécurité ; groupes DMX + zones + master dimmer ; undo/redo partiel avec coalescing (`history.ts:32-49`) ; backup offline ; raccourcis style Ableton.

### Points faibles & lacunes déterminantes (classées par impact sur de vrais shows)
1. **🔴 Pas d'effect engine UI** — strobe/pulse/chase/sweep à faire à la main en keyframes. ~80 % du travail live. **Rédhibitoire** pour clubs/festivals. (`EffectEngine.ts` existe en lib mais sans UI de génération.)
2. **🔴 Cue stacks / busking incomplets** — `CueClipPanel.tsx` isolé de la timeline & de Smart ; pas de go/back, follow times, file d'attente. Les cues ne peuvent pas piloter le show.
3. **🔴 Pas de submasters / playback faders** — un seul master global ; impossible de lancer des séquences parallèles.
4. **🟠 Pas d'import GDTF** — patcher N fixtures = N saisies manuelles/OCR.
5. **🟠 Pas de pixel-mapping** — exclut les murs/matrices LED.
6. **🟠 Pas de timecode (SMPTE/LTC/MTC)** — BPM-only ; bloque théâtre/broadcast.
7. **🟡 Groupes plats (pas de hiérarchie), pas d'édition blind/preview, undo partiel, pas de pad XY pour pan/tilt live, pas de multi-utilisateur.**

### Verdict cohérence des deux modes : **utile mais fragmenté**
Le split est clair en intention mais les « scènes » sont **dupliquées** : pads Smart (`smartModeSlice`) vs clips timeline (`timelineSlice`) sans synchro bidirectionnelle ; les cues sont Creator-only et orphelins ; les groupes Smart n'alimentent pas les nodes Creator. Un designer ne peut pas tester une timeline en Smart ; un performer ne peut pas voir un pad sur la timeline. **Unifier le modèle de données scène/clip est une priorité structurelle.**

---

## Roadmap consolidée

**P0 — justesse (avant tout marketing « pro ») :**
- G : boucle de refresh 40Hz serveur + horloge de trame unifiée (corrige le scintillement strobe/chase) — le fix d'ingénierie à plus forte valeur.
- G : paquets Art-Net Sync (peu coûteux, gros gain visuel) ; ajouter des tests sur le chemin de sortie.
- H : ajouter la validation safety-gate au chemin d'exécution de l'Orchestrator (il exécute déjà des commandes sans garde).

**P1 — fonctionnalités déterminantes (transformer « contrôleur » en « show driver ») :**
- I : effect engine UI (encapsuler `EffectEngine.ts`/`trajectoryGenerator.ts`).
- I : cue stacks + busking (go/back, follow/fade times) intégrés à Smart.
- I : unifier le modèle scène/clip entre Smart & Creator.
- H : générateur de timeline synchro au beat + auto-sélection de preset (réutilise `ShowAudioEngine`).

**P2 — portée & échelle :**
- I : import GDTF ; submasters/playback faders ; pixel-mapping.
- G : sACN/E1.31 ; timecode LTC/MTC (étendre `syncClock`).
- H : génération média réelle ; boucle d'apprentissage fixture-ID.

**Nettoyage (déjà couvert dans le plan timeline, groupe C) :** retirer les données de démo factices et les faux logs « AI Inspector » pour ne pas confondre les vraies features IA avec des mocks.

---

## Vérification de l'audit lui-même
Les affirmations déterminantes ont été contrôlées dans le code : pas de boucle de refresh dans `dmxRouter.ts` (✅ confirmé) ; `/api/llm/chat` existe et l'Orchestrator exécute des commandes (✅ confirmé — corrige l'affirmation « pas de backend » de l'agent) ; le média generator n'a aucun appel fournisseur réel (✅ stub confirmé). Les ⚠️-affirmations restantes (ex. isolement des cue stacks, lacunes de couverture undo) doivent être relues dans le fichier concerné avant d'implémenter le correctif correspondant.

---

## Documents liés
- `PLAN_EXECUTION_TIMELINE.md` — guide de code minutieux pour la timeline (Phase 2/3 + fix moteur P0).
- `PLAN_TIMELINE_IMPROVEMENTS.md` — plan de la Phase 1 (7 améliorations déjà livrées).

# 🔧 Recommandations Glow Logic — Itération 1

> **Source :** Agent IA d'analyse (session d'évaluation du cahier des charges vs implémentation Codex + tests fonctionnels frontend/backend).  
> **Date d'analyse :** Juin 2026  
> **Itération :** 1  
> **Statut global :** L'implémentation est très avancée (~85-90% du MVP fonctionnel). Ces recommandations visent à combler les écarts restants et à améliorer la robustesse.

---

## 📋 Contexte de l'analyse

L'agent IA a effectué les actions suivantes :
1. **Lecture complète** du cahier des charges `glow_logic_ultimate_spec.md` (413 lignes).
2. **Exploration exhaustive** de la structure du projet monorepo (`apps/web` + `apps/server`).
3. **Analyse comparative** point par point entre le cahier et le code implémenté.
4. **Tests fonctionnels** : démarrage backend (port 3005), frontend (port 3000), appels API REST, vérification Socket.IO, typecheck TypeScript.
5. **Analyse du launcher** : raccourci bureau `Glow Logic.lnk`, chaîne WScript → VBScript → PowerShell → cmd.exe.

**Résultat des tests :**
- ✅ Frontend Next.js 16 compile et répond (HTTP 200)
- ✅ Backend Express répond sur toutes les routes testées
- ✅ TypeScript : 0 erreur côté web, 0 erreur côté server
- ⚠️ Port 3005 déjà utilisé au lancement (processus orphelin)
- ⚠️ Port OSC 57121 en conflit (QLC+ integration partielle)
- ⚠️ Endpoint `/api/diagnose` lent (timeout 30s)

---

## 🔴 Priorité Haute — À corriger en premier

### 1. Ajouter un script de stop robuste utilisable depuis Git Bash
**Problème :** Le launcher PowerShell (`launcher:stop`) ne fonctionne pas dans Git Bash car `powershell` n'est pas reconnu. Les processus node restent orphelins sur les ports 3000/3005/9999/57121.

**Recommandation :**
- Créer un script shell/Bash `scripts/stop-glow-logic.sh` (ou `.cmd` compatible Git Bash) qui :
  - Détecte et tue les processus `node.exe` sur les ports 3000, 3005, 9999
  - Tue les processus Python exécutant `dmx_bridge.py`
  - Tue `qlcplus.exe` si présent
  - Utilise `netstat -ano` + `taskkill` (déjà fonctionnel en test)

**Fichiers concernés :** `scripts/Stop-GlowLogic.ps1`, `package.json` (ajouter un script `stop:bash`)

---

### 2. Corriger l'encodage des caractères spéciaux
**Problème :** Des caractères accentués sont mal encodés dans le code source. Exemple trouvé :
```tsx
// SmartDashboard.tsx ligne ~86
"LatÃ©ral": "Fond",  // Devrait être "Latéral"
```

**Recommandation :**
- Faire un grep sur tout le projet pour trouver les séquences `Ã©`, `Ã¨`, `Ã `, etc.
- Les remplacer par les caractères UTF-8 corrects (`é`, `è`, `à`, etc.)
- Vérifier que les fichiers sont bien encodés en UTF-8 sans BOM

**Commande de détection suggérée :**
```bash
grep -rn 'Ã©\|Ã¨\|Ã \|Ãª\|Ã§' apps/web/src apps/server/
```

---

### 3. Finaliser le Visualiseur 3D (simulation laser & drone)
**Problème :** Le cahier des charges (Section 2, MVP 2) exige que lasers, drones et pyrotechnie soient en **mode simulation** dans un visualiseur 3D. Actuellement, `VisualizerView.tsx` et `MiniOverlay.tsx` existent avec Three.js, mais ce n'est qu'un visualiseur de scène basique. La simulation de faisceaux laser et de trajectoires drones n'est pas implémentée.

**Recommandation :**
- Étendre `VisualizerView.tsx` pour afficher :
  - Des faisceaux laser simulés (lignes colorées avec attenuation)
  - Des drones avec trajectoires animées dans le volume geofencé
  - Des effets pyrotechnie (particules)
- Connecter le Safety Gate (`safetyGate.ts`) pour que le visualiseur reflète les blocages (ex: drone hors geofence = alerte visuelle rouge)
- Utiliser `@react-three/fiber` et `@react-three/drei` (déjà dans les dépendances)

**Fichiers concernés :** `apps/web/src/components/VisualizerView.tsx`, `apps/web/src/components/three/MiniOverlay.tsx`

---

## 🟡 Priorité Moyenne — À implémenter ensuite

### 4. Améliorer le VJ Deck avec shaders WebGL/Three.js
**Problème :** Le cahier (Phase 6) demande des shaders de rendu procédural sur GPU. `MediaGeneratorPanel` et `VideoProjectionWindow` existent, mais le VJ Deck principal n'intègre pas encore de shaders procéduraux temps réel.

**Recommandation :**
- Ajouter un canvas WebGL dans le VJ Deck (`SmartDashboard.tsx` → widget `vjDeck`)
- Implémenter 2-3 shaders de base : noise gradient, audio-reactive waves, strobe sync BPM
- Connecter au BPM du store (`bpm` dans `smartModeSlice.ts`)
- Prévoir un pipeline de rendu qui ne bloque pas le thread principal (WebGL offscreen ou requestAnimationFrame)

**Fichiers concernés :** `apps/web/src/components/SmartDashboard.tsx`, `apps/web/src/components/ui/VideoProjectionWindow.tsx`

---

### 5. Structurer le format d'export `.glowproject`
**Problème :** Le cahier (Section 9.B) demande un format d'export/import unique `.glowproject` ou `.glowshow`. Actuellement, l'API `/api/library/export` exporte du JSON brut, mais il n'y a pas de packaging complet incluant SQLite + assets + manifest.

**Recommandation :**
- Créer une fonction d'export qui génère un ZIP contenant :
  - `project.db` (copie de la base SQLite)
  - `assets/` (images, vidéos, profils fixtures importés)
  - `manifest.json` (version, nom, date, checksums)
- Créer une fonction d'import qui lit ce ZIP et restaure tout
- Ajouter les routes API : `POST /api/projects/export`, `POST /api/projects/import`

**Fichiers concernés :** `apps/server/services/database.ts`, `apps/server/index.ts` (nouvelles routes)

---

### 6. Optimiser ou protéger l'endpoint `/api/diagnose`
**Problème :** L'endpoint de diagnostic système est très lent (timeout à 30s lors du test). Cela peut bloquer le frontend ou épuiser les ressources.

**Recommandation :**
- Ajouter un timeout côté serveur dans `anomalyDetector.ts` (ex: 10s max par check)
- Ajouter un cache mémoire (diagnostic recalculé toutes les 60s max)
- Côté client, ajouter un timeout fetch (ex: 15s) avec message d'erreur gracieux
- Découper le diagnostic en endpoints plus petits si possible

**Fichiers concernés :** `apps/server/services/anomalyDetector.ts`, `apps/web/src/components/ui/SupportCenterModal.tsx` (si appelant)

---

### 7. Corriger la configuration ESLint
**Problème :** `npm run lint` retourne `Premature close` dans l'environnement de test. La config ESLint v9 avec Next.js 16 semble incompatible ou incomplète.

**Recommandation :**
- Vérifier que `eslint.config.mjs` est correctement configuré pour Next.js 16 + ESLint 9
- Si le problème persiste, downgrader temporairement à ESLint 8 avec `.eslintrc.json`
- Ou désactiver le lint dans les scripts de build si bloquant

**Fichiers concernés :** `apps/web/eslint.config.mjs`, `apps/web/package.json`

---

## 🟢 Priorité Faible — Polish et améliorations

### 8. Ajouter `laserArmed` et `pyroArmed` dans le store Zustand frontend
**Problème :** Le cahier (Section 5) mentionne `laserArmed` et `pyroArmed` dans le store. Actuellement, le Safety Gate les gère côté backend, mais le frontend n'a pas de state dédié pour refléter visuellement l'état d'armement (boutons grisés/rouges, indicateurs).

**Recommandation :**
- Ajouter un slice `safetySlice.ts` dans le store Zustand avec :
  - `laserArmed: boolean`
  - `pyroArmed: boolean`
  - `operatorRole: 'beginner' | 'expert' | 'admin'`
- Synchroniser via polling ou Socket.IO depuis `/api/safety`
- Afficher des indicateurs visuels dans le `TopBar` ou `SmartDashboard`

**Fichiers concernés :** `apps/web/src/store/slices/` (nouveau), `apps/web/src/components/TopBar.tsx`

---

### 9. Créer les raccourcis bureau manquants
**Problème :** Seul `Glow Logic.lnk` existe sur le bureau. Les raccourcis `Glow Logic (Debug).lnk` et `Glow Logic - Stop.lnk` sont absents.

**Recommandation :**
- Exécuter `scripts/Create-DesktopShortcut.ps1` pour recréer les 3 raccourcis
- Ou créer manuellement les raccourcis avec les propriétés suivantes :
  - **Debug** : cible = `launch-glow-logic.cmd`, style = normal, icône = `assets/launcher-icon.ico`
  - **Stop** : cible = `wscript.exe`, arguments = `"stop-silent.vbs"`, icône = `%SystemRoot%\System32\shell32.dll,131`

**Fichiers concernés :** `scripts/Create-DesktopShortcut.ps1`, `stop-silent.vbs`

---

### 10. Ajouter un guard contre le double-lancement
**Problème :** Double-cliquer 2 fois sur `Glow Logic.lnk` lance 2 instances qui se battent pour les ports.

**Recommandation :**
- Dans `launch-silent.vbs`, ajouter une vérification WMI avant le lancement :
  ```vbscript
  Set WMI = GetObject("winmgmts:\\.\root\cimv2")
  Set procs = WMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe'")
  For Each p in procs
      If InStr(p.CommandLine, "Glow-logic") > 0 Then
          WshShell.Popup "Glow Logic est déjà en cours d'exécution.", 3, "Glow Logic", 48
          WScript.Quit 0
      End If
  Next
  ```
- Alternative : créer un fichier `.lock` dans le dossier projet et le supprimer au stop

**Fichiers concernés :** `launch-silent.vbs`

---

### 11. Gérer le port OSC 57121 dans le launcher
**Problème :** QLC+ tente de binder le port OSC 57121 mais il est parfois déjà pris. Le script `Launch-GlowLogic.ps1` ne libère pas ce port.

**Recommandation :**
- Ajouter `57121` dans la liste des ports à libérer dans `Launch-GlowLogic.ps1`
- Ajouter `57121` dans la liste des ports à surveiller dans `Stop-GlowLogic.ps1`

**Fichiers concernés :** `scripts/Launch-GlowLogic.ps1`, `scripts/Stop-GlowLogic.ps1`

---

### 12. Ajouter `masterDimmer` et `networkState` au store Zustand
**Problème :** Le cahier (Section 5) spécifie `masterDimmer: number` et `networkState` dans le store. Ces champs ne sont pas explicitement présents dans les slices actuelles.

**Recommandation :**
- Ajouter `masterDimmer` dans `smartModeSlice.ts` ou un nouveau slice
- Ajouter `networkState` (adapters, activeAdapter, discoveredNodes) dans `uiSlice.ts` ou un slice réseau
- Connecter au backend via `/api/network/adapters`

**Fichiers concernés :** `apps/web/src/store/slices/smartModeSlice.ts`, `apps/web/src/store/slices/uiSlice.ts`

---

## 📊 Tableau récapitulatif des écarts MVP

| Section cahier | Exigence | Statut implémentation | Action recommandée |
|----------------|----------|----------------------|-------------------|
| 2 — Refactoring UI | SmartDashboard unique | ✅ Complet | — |
| 2 — Refactoring UI | Suppression ChaserEditor/CueList/SceneBuilder | ✅ Complet | — |
| 3 — Safety Gate | Filtre déterministe | ✅ Complet | — |
| 3 — Safety Gate | Armement manuel | ✅ Complet | Polish UI (rec. #8) |
| 3 — Safety Gate | Limite laser 64/255 | ✅ Complet | — |
| 3 — Safety Gate | Geofencing drones | ✅ Complet | — |
| 4 — Modèles de données | Interfaces TypeScript | ✅ Complet | — |
| 5 — Store Zustand | Structure avec slices | ✅ Complet | Ajouter champs manquants (rec. #12) |
| 6 — API REST | Toutes les routes | ✅ Complet | — |
| 6 — Socket.IO | dmx_update, dmx_sync | ✅ Complet | Vérifier acp_message |
| 7 — Moteur temps réel | 44 Hz + Override 3 niveaux | ✅ Complet | — |
| 8 — Guided Tour | 6 étapes | ✅ 8 étapes (bonus) | — |
| 9.A — Licence | Service local | ✅ Complet | — |
| 9.B — Projets/Shows/Venues | Tables séparées | ✅ Complet | Format `.glowproject` (rec. #5) |
| 9.C — Bibliothèques | 3 niveaux | ✅ Complet | — |
| 9.D — Mode Offline | PWA + localStorage + SQLite | ✅ Complet | — |
| 9.E — Crash Recovery | Autosave + snapshot | ✅ Complet | — |
| 9.F — Logs/Diagnostic | Journal + export | ✅ Complet | Optimiser diagnose (rec. #6) |
| 9.G — Documentation | Tours + tooltips | ✅ Complet | — |
| 9.H — Permissions | Rôles + Safety Gate | ✅ Complet | — |
| 11 — Phase 6 | VJ Deck shaders GPU | ⚠️ Partiel | Rec. #4 |
| 11 — Phase 6 | Visualiseur 3D laser/drone | ⚠️ Partiel | Rec. #3 |
| 11 — Phase 6 | Proxy media IA | ⚠️ Partiel | Rec. #4 |
| Launcher | Raccourcis complets | ⚠️ Partiel | Rec. #9, #10, #11 |

---

## 🎯 Ordre de travail suggéré pour l'agent IA suivant

Si un agent IA reprend ce projet, voici l'ordre optimal :

1. **Fix immédiats** (30 min) :
   - Rec. #2 : corriger l'encodage des caractères
   - Rec. #9 : créer les raccourcis bureau manquants
   - Rec. #11 : ajouter le port 57121 au launcher

2. **Robustesse** (1h) :
   - Rec. #1 : script de stop Git Bash
   - Rec. #10 : guard double-lancement
   - Rec. #6 : optimiser `/api/diagnose`

3. **Fonctionnalités MVP manquantes** (2-4h) :
   - Rec. #3 : visualiseur 3D laser/drone
   - Rec. #4 : shaders VJ Deck
   - Rec. #5 : format `.glowproject`

4. **Polish** (1h) :
   - Rec. #7 : ESLint
   - Rec. #8 : state safety frontend
   - Rec. #12 : champs store manquants

---

*Fin du document — Itération 1*

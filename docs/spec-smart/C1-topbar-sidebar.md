# C1 — TopBar compacte + libération de la sidebar SMART

**Dépend de :** — | **Bloque :** C2, C3, C5 | **Priorité :** 🔴 P0
**Fichiers à charger en contexte :**
- `apps/web/src/components/SmartDashboard.tsx`
- `apps/web/src/components/TopBar.tsx`
- `apps/web/src/store/slices/uiSlice.ts`
- `docs/spec-smart/01-CONVENTIONS.md`

## 1. Contexte

La sidebar gauche de la vue SMART gaspille ~25% de la largeur écran : bloc de texte statique « Capture scenes », onglet « Automations » redondant avec la MacroTimeline, carte « Live Status » verbeuse mélangeant infos temps réel et boutons d'action. Objectif : déplacer les infos dans la TopBar (compactes), les actions dans un menu « Outils », et libérer la sidebar entière pour les chantiers C2 (contrôleur de scènes) et C3 (inspecteur).

## 2. Fichiers touchés

| Action | Fichier |
|--------|---------|
| Créer | `apps/web/src/components/smart/SmartSidebar.tsx` |
| Créer | `apps/web/src/components/smart/SmartToolsModals.tsx` |
| Modifier | `apps/web/src/components/SmartDashboard.tsx` |
| Modifier | `apps/web/src/components/TopBar.tsx` |
| Modifier | `apps/web/src/store/slices/uiSlice.ts` |

## 3. État existant (réfs vérifiées)

Dans `SmartDashboard.tsx` :
- Onglet sidebar « Automations » : ligne ~3145 (ancre texte `Automations`).
- Bloc « Capture scenes » : ligne ~3154 ; bloc « Automations timeline » : ligne ~3169.
- Carte « Live Status » + boutons : lignes ~3178-3252 (ancres : commentaire `{/* Fixed Bottom: Live Status Card & Diagnostics */}` à 3178, texte `Live Status` à 3189, boutons `Diagnostic IA du DMX` ~3235, `Preflight show` ~3245, `Recovery show` ~3252).
- Modals à extraire (elles restent fonctionnelles, seul leur emplacement change) :
  - Diagnostic : ~2502-2620 (ancre `Rapport de Diagnostic IA` à 2513), s'appuie sur `runDiagnostics` (~526), états `isDiagnosing`, `diagnosis`.
  - Preflight : ~2622-2729 (ancre `Preflight show end-to-end` à 2633), s'appuie sur `refreshPreflightData` (~454), `handlePreflightSnapshot` (~2262), `exportPreflightReport` (~2271).
  - Recovery : ~2732-2850 (ancre `setShowRecoveryGuide(false)` à 2749), s'appuie sur `openRecoveryGuide` (~2224), `handleRecoverySnapshot` (~2231), `handleRecoverySave` (~2237), `formatRecoveryAge` (~106).

Dans `TopBar.tsx` :
- Sélecteur CANVAS / FIXTURES / 3D : lignes ~474-505 (ancre commentaire `{/* CANVAS / FIXTURES / 3D — always visible */}` à 474) — affiché quel que soit `appMode`.
- BLACKOUT : ~471. Indicateurs laser/pyro : ~549-557. `appMode` lu ligne ~49.

Dans `uiSlice.ts` : `isSidebarVisible` (~38), `appMode` (~32). Pas de champ `smartSidebarPanel`.

## 4. Spécification comportementale

- **S1** — QUAND `appMode === 'smart'` ALORS le sélecteur CANVAS/FIXTURES/3D de la TopBar n'est pas rendu (il reste rendu tel quel en mode `creator`). Fichier : `TopBar.tsx`.
- **S2** — QUAND la vue SMART est affichée ALORS la TopBar montre, à la place du sélecteur (zone centre-droite), trois indicateurs compacts :
  - **Backend** : un dot 8px (`bg-green-400` si le socket backend est connecté, `bg-red-400` sinon) avec tooltip `Backend connecté` / `Backend déconnecté`. État de connexion : réutiliser la même source que l'actuel « BACKEND CONNECTED » de la carte Live Status (état socket dans SmartDashboard — le remonter via le store ou un hook partagé, pas de duplication de socket).
  - **Scène active** : badge `text-[10px] font-mono` affichant le nom du pad actif (`smartPads.find(p => p.qlcWidget === smartActiveScene)?.name`), ou `—` si aucun. Largeur max 90px, ellipsis.
  - Le BPM existe déjà dans la TopBar : ne pas le dupliquer.
- **S3** — QUAND l'utilisateur clique le bouton « 🔧 Outils » (icône lucide `Wrench`, zone droite de la TopBar, visible uniquement en mode smart) ALORS un dropdown s'ouvre avec trois entrées : `Diagnostic IA du DMX`, `Preflight show`, `Recovery show`. Chaque entrée ouvre la modal correspondante. Le dropdown se ferme au clic extérieur et à Échap.
- **S4** — QUAND on extrait les modals ALORS les trois modals Diagnostic/Preflight/Recovery vivent dans `smart/SmartToolsModals.tsx` (un composant exportant `<SmartToolsModals />` + un petit store local ou des props d'ouverture pilotées par le store). Leur logique (fetchs, snapshots, export rapport) est déplacée à l'identique — zéro changement fonctionnel. `SmartDashboard.tsx` et `TopBar.tsx` peuvent tous deux les ouvrir ; l'état d'ouverture (`openTool: 'diagnostic' | 'preflight' | 'recovery' | null`) va dans `uiSlice`.
- **S5** — QUAND la vue SMART est affichée ALORS la sidebar gauche est rendue par le nouveau composant `smart/SmartSidebar.tsx` : header fin (28px) + zone de contenu pleine hauteur avec scroll. Contenu selon `smartSidebarPanel` : `'scenes'` → placeholder `« Contrôleur de scènes (C2) »` ; `'inspector'` → placeholder `« Inspecteur (C3) »`. Les chantiers C2/C3 rempliront ces slots.
- **S6** — QUAND C1 est terminé ALORS les éléments suivants n'existent plus dans `SmartDashboard.tsx` : onglet « Automations », blocs « Capture scenes » / « Automations timeline », carte « Live Status », boutons Diagnostic/Preflight/Recovery de la sidebar. Les onglets restants de l'ancienne sidebar (« Contrôles », « IA ») disparaissent aussi : la sidebar n'a plus d'onglets, son contenu est piloté par `smartSidebarPanel`. Le contenu utile de l'onglet « IA » (s'il contient des actions non redondantes) est déplacé dans le dropdown Outils sous un séparateur ; s'il n'est que décoratif, le supprimer.
- **S7** — QUAND l'utilisateur masque la sidebar (toggle existant `isSidebarVisible` dans la TopBar) ALORS le comportement actuel est conservé (la zone centrale prend toute la largeur).

## 5. Modèle de données

```ts
// uiSlice.ts — ajouts
smartSidebarPanel: 'scenes' | 'inspector';            // défaut 'scenes'
setSmartSidebarPanel: (panel: 'scenes' | 'inspector') => void;
openTool: 'diagnostic' | 'preflight' | 'recovery' | null;  // défaut null — NON persisté (exclure du partialize)
setOpenTool: (tool: 'diagnostic' | 'preflight' | 'recovery' | null) => void;
```

`smartSidebarPanel` est persisté ; `openTool` ne l'est pas.

## 6. Wireframe textuel

```
TOPBAR (mode SMART)
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡] GLOW  [SMART|CREATOR] │ BPM 128.0 [tap] SYNC  🚨BLACKOUT  ● Bass pulse   │
│                           │                       ↑backend dot ↑scène active │
│   …droite : 🕐 02:21:50  DMX  LASER  PYRO  OFFLINE  💾  🔧Outils ▾  ⚙  📁   │
└──────────────────────────────────────────────────────────────────────────────┘
                                              🔧 Outils ▾
                                              ┌──────────────────────┐
                                              │ 🩺 Diagnostic IA DMX │
                                              │ ✈ Preflight show     │
                                              │ ♻ Recovery show      │
                                              └──────────────────────┘
SIDEBAR (mode SMART, après C1 — placeholders)
┌──────────────────┐
│ SCÈNES LIVE      │  ← header SmartSidebar
├──────────────────┤
│                  │
│  [slot C2/C3]    │  ← pleine hauteur, scroll
│                  │
└──────────────────┘
```

## 7. Critères d'acceptation

- **AC1** (S1) : en mode SMART, CANVAS/FIXTURES/3D absents de la TopBar ; en mode CREATOR, inchangés.
- **AC2** (S2) : dot backend + badge scène active visibles en mode SMART ; le badge affiche le nom du pad actif après déclenchement d'un pad.
- **AC3** (S3) : le dropdown Outils ouvre chacune des 3 modals ; fermeture clic extérieur + Échap.
- **AC4** (S4) : les 3 modals fonctionnent à l'identique (diagnostic lance le fetch, preflight affiche la checklist, recovery liste les snapshots) depuis le menu Outils.
- **AC5** (S5, S6) : la sidebar ne contient plus ni texte « Capture scenes », ni « Live Status », ni boutons Diagnostic/Preflight/Recovery, ni onglets ; elle rend `SmartSidebar` avec le placeholder scenes.
- **AC6** (S7) : le toggle sidebar de la TopBar fonctionne toujours.
- **AC7** : `npm run build` dans `apps/web` passe sans erreur TS.

## 8. Hors scope

- Ne pas toucher : `lib/dmxEngine.ts`, `MacroTimeline.tsx`, `MidiListener.tsx`, les render functions `renderGroupStrips`/`renderStagePlan`/`renderPadsGrid`/`renderApcVirtual`/`renderVjDeck`/`renderMiniPlaylist`/`renderSpectro` (chantiers C2/C5/C6), la vue CREATOR et ses proViews.
- Ne pas implémenter le contrôleur de scènes (C2) ni l'inspecteur (C3) — placeholders uniquement.
- Ne pas réorganiser/reformater le reste de `SmartDashboard.tsx`.

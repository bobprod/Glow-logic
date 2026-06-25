# Glow Logic - Lanceurs Desktop

## 🚀 Démarrage rapide

### Option recommandée : double-clique le raccourci "Glow Logic"

1. Sur ton bureau, double-clique sur **"Glow Logic"**
2. Le backend et le frontend démarrent en arrière-plan (aucune fenêtre console)
3. Une notification Windows apparaît quand tout est prêt
4. Le navigateur s'ouvre automatiquement sur `http://localhost:3000`

---

## 📁 Fichiers

| Fichier | Rôle |
|---------|------|
| `Glow Logic.lnk` (bureau) | **Principal** — lance tout silencieusement, avec belle icône |
| `Glow Logic (Debug).lnk` (bureau) | Lance avec console visible (pour voir les logs) |
| `Glow Logic - Stop.lnk` (bureau) | Arrête tous les services |
| `launch-silent.vbs` | Lanceur silencieux (appelé par le raccourci) |
| `launch-glow-logic.cmd` | Lanceur console interactif (avec ASCII art 🎨) |
| `stop-glow-logic.cmd` / `stop-silent.vbs` | Arrête les services |
| `scripts/Create-DesktopShortcut.ps1` | Recrée les raccourcis si besoin |

---

## 🔧 Recréer les raccourcis

Si les raccourcis sont manquants ou cassés :

```powershell
# Dans le dossier Glow-logic
powershell -ExecutionPolicy Bypass -File scripts\Create-DesktopShortcut.ps1
```

Ou via le `.cmd` interactif :
1. Double-clique `launch-glow-logic.cmd`
2. Choisis l'option **2** (Créer un raccourci)

---

## 🐛 Debug

Problème ? Lance le mode **Debug** :

```
Double-clique "Glow Logic (Debug).lnk"
```

Tu verras :
- La console PowerShell avec les étapes de démarrage
- Les ports utilisés (3000 = web, 3005 = API)
- Les erreurs éventuelles

---

## 🎯 Architecture

```
[Glow Logic.lnk]  →  wscript.exe  →  launch-silent.vbs
                                            ↓
                              PowerShell (hidden)
                                            ↓
                         ┌──────────────────┴──────────────────┐
                         ↓                                     ↓
                   cmd.exe (serveur)                     cmd.exe (web)
                   port 3005                              port 3000
```

Aucune fenêtre console ne s'affiche. Tout tourne en arrière-plan.

---

## 🛑 Arrêter

- Double-clique **"Glow Logic - Stop.lnk"** sur le bureau
- Ou : `powershell -File scripts\Stop-GlowLogic.ps1`

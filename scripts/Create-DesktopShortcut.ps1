# Create-DesktopShortcut.ps1 — Crée les raccourcis bureau Glow Logic
# Usage : powershell -ExecutionPolicy Bypass -File scripts\Create-DesktopShortcut.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$desktop  = [Environment]::GetFolderPath('Desktop')
$icoPath  = Join-Path $repoRoot 'assets\launcher-icon.ico'
$vbsPath  = Join-Path $repoRoot 'launch-silent.vbs'
$cmdPath  = Join-Path $repoRoot 'launch-glow-logic.cmd'

Write-Host ''
Write-Host '   GLOW LOGIC — Raccourcis bureau' -ForegroundColor Cyan
Write-Host '   ================================' -ForegroundColor DarkGray
Write-Host ''

# ── Vérifications préalables ──────────────────────────────────
if (-not (Test-Path $icoPath)) {
    Write-Host "   [ERREUR] Icone introuvable : $icoPath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $vbsPath)) {
    Write-Host "   [ERREUR] Lanceur silencieux introuvable : $vbsPath" -ForegroundColor Red
    exit 1
}

$shell = New-Object -ComObject WScript.Shell

# ── Raccourci 1 : Glow Logic (silencieux, sans console) ───────
$lnk1 = Join-Path $desktop 'Glow Logic.lnk'
$sc1  = $shell.CreateShortcut($lnk1)
$sc1.TargetPath       = 'wscript.exe'
$sc1.Arguments        = '"' + $vbsPath + '"'
$sc1.WorkingDirectory = $repoRoot
$sc1.IconLocation     = $icoPath + ',0'
$sc1.Description      = 'Lance Glow Logic en arrière-plan (mode silencieux)'
$sc1.WindowStyle      = 7   # SW_SHOWMINNOACTIVE
$sc1.Save()
Write-Host "   [OK] Glow Logic.lnk" -ForegroundColor Green
Write-Host "        -> Mode silencieux (pas de console)" -ForegroundColor DarkGray

# ── Raccourci 2 : Glow Logic (Debug) ──────────────────────────
$lnk2 = Join-Path $desktop 'Glow Logic (Debug).lnk'
$sc2  = $shell.CreateShortcut($lnk2)
$sc2.TargetPath       = $cmdPath
$sc2.WorkingDirectory = $repoRoot
$sc2.IconLocation     = $icoPath + ',0'
$sc2.Description      = 'Lance Glow Logic avec fenêtre console (debug)'
$sc2.WindowStyle      = 1   # SW_SHOWNORMAL
$sc2.Save()
Write-Host "   [OK] Glow Logic (Debug).lnk" -ForegroundColor Green
Write-Host "        -> Console visible (pour voir les logs)" -ForegroundColor DarkGray

# ── Raccourci 3 : Stop (optionnel) ───────────────────────────
$stopPs  = Join-Path $repoRoot 'scripts\Stop-GlowLogic.ps1'
$stopVbs = Join-Path $repoRoot 'stop-silent.vbs'

if (Test-Path $stopPs) {
    # Créer un stop-silent.vbs si nécessaire
    if (-not (Test-Path $stopVbs)) {
        $vbsContent = @'
Dim WshShell, fso, rootDir, psPath
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath  = rootDir & "\scripts\Stop-GlowLogic.ps1"
WshShell.CurrentDirectory = rootDir
WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """", 0, False
WScript.Quit 0
'@
        Set-Content -Path $stopVbs -Value $vbsContent -Encoding UTF8
    }

    $lnk3 = Join-Path $desktop 'Glow Logic - Stop.lnk'
    $sc3  = $shell.CreateShortcut($lnk3)
    $sc3.TargetPath       = 'wscript.exe'
    $sc3.Arguments        = '"' + $stopVbs + '"'
    $sc3.WorkingDirectory = $repoRoot
    $sc3.IconLocation     = '%SystemRoot%\System32\shell32.dll,131'
    $sc3.Description      = 'Arrête tous les services Glow Logic'
    $sc3.WindowStyle      = 7
    $sc3.Save()
    Write-Host "   [OK] Glow Logic - Stop.lnk" -ForegroundColor Green
}

Write-Host ''
Write-Host '   Tous les raccourcis ont été créés sur le bureau.' -ForegroundColor Cyan
Write-Host '   Double-clique sur "Glow Logic" pour démarrer !' -ForegroundColor White
Write-Host ''

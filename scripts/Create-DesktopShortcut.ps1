$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$icoPath = Join-Path $repoRoot 'assets\launcher-icon.ico'
$silentVbsPath = Join-Path $repoRoot 'launch-silent.vbs'
$debugCmdPath = Join-Path $repoRoot 'launch-glow-logic.cmd'
$stopVbsPath = Join-Path $repoRoot 'stop-silent.vbs'
$stopScriptPath = Join-Path $repoRoot 'scripts\Stop-GlowLogic.ps1'

function Test-RequiredFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label introuvable : $Path"
    }
}

function New-GlowShortcut {
    param(
        [Parameter(Mandatory = $true)][string]$ShortcutPath,
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [string]$Arguments = '',
        [string]$IconLocation = '',
        [string]$Description = '',
        [int]$WindowStyle = 1
    )

    $shortcut = $script:Shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $repoRoot
    if ($IconLocation) {
        $shortcut.IconLocation = $IconLocation
    }
    $shortcut.Description = $Description
    $shortcut.WindowStyle = $WindowStyle
    $shortcut.Save()
}

Write-Host ''
Write-Host '   GLOW LOGIC - Raccourcis bureau' -ForegroundColor Cyan
Write-Host '   ==============================' -ForegroundColor DarkGray
Write-Host ''

Test-RequiredFile -Path $silentVbsPath -Label 'Lanceur silencieux'
Test-RequiredFile -Path $debugCmdPath -Label 'Lanceur debug'
Test-RequiredFile -Path $stopVbsPath -Label 'Lanceur stop'
Test-RequiredFile -Path $stopScriptPath -Label 'Script stop'

$mainIcon = if (Test-Path -LiteralPath $icoPath) { "$icoPath,0" } else { '%SystemRoot%\System32\shell32.dll,220' }
$stopIcon = '%SystemRoot%\System32\shell32.dll,131'
$script:Shell = New-Object -ComObject WScript.Shell

New-GlowShortcut `
    -ShortcutPath (Join-Path $desktop 'Glow Logic.lnk') `
    -TargetPath 'wscript.exe' `
    -Arguments "`"$silentVbsPath`"" `
    -IconLocation $mainIcon `
    -Description 'Lance Glow Logic en arriere-plan' `
    -WindowStyle 7
Write-Host '   [OK] Glow Logic.lnk' -ForegroundColor Green

New-GlowShortcut `
    -ShortcutPath (Join-Path $desktop 'Glow Logic (Debug).lnk') `
    -TargetPath $debugCmdPath `
    -IconLocation $mainIcon `
    -Description 'Lance Glow Logic avec console visible pour debug' `
    -WindowStyle 1
Write-Host '   [OK] Glow Logic (Debug).lnk' -ForegroundColor Green

New-GlowShortcut `
    -ShortcutPath (Join-Path $desktop 'Glow Logic - Stop.lnk') `
    -TargetPath 'wscript.exe' `
    -Arguments "`"$stopVbsPath`"" `
    -IconLocation $stopIcon `
    -Description 'Arrete les services Glow Logic et libere les ports' `
    -WindowStyle 7
Write-Host '   [OK] Glow Logic - Stop.lnk' -ForegroundColor Green

Write-Host ''
Write-Host '   Tous les raccourcis Glow Logic sont prets sur le bureau.' -ForegroundColor Cyan
Write-Host ''

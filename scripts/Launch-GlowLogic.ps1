# ============================================================
# GLOW LOGIC - Launcher v3
# Ports  : 3000 (Next.js web) | 3005 (Express API)
# Routes : /  /patch  /dmx-tester  /effects  /ai-lighting
# ============================================================
# Encode : UTF-8 avec BOM (requis pour PowerShell 5.1)
# Style  : inspire de ClawBoard / Immo Saas
# ============================================================

$ErrorActionPreference = 'Stop'

# ---- Config -----------------------------------------------
$WEB_PORT       = 3000
$SERVER_PORT    = 3005
$HEALTH_TIMEOUT = 90
$LOG_RETENTION  = 7

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$ServerPath = Join-Path $RepoRoot 'apps\server'
$WebPath    = Join-Path $RepoRoot 'apps\web'
$LogDir     = Join-Path $RepoRoot 'logs'
$LogFile    = Join-Path $LogDir ("glow-logic-" + (Get-Date -Format 'yyyy-MM-dd') + ".log")

# ---- Logger -----------------------------------------------
function Write-Log {
    param([string]$Level, [string]$Msg, [ConsoleColor]$Color = 'Gray')
    $ts   = Get-Date -Format 'HH:mm:ss'
    $line = "[$ts] [$Level] $Msg"
    Write-Host "  $line" -ForegroundColor $Color
    try {
        if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    } catch {}
}
function Write-Info { param([string]$m) Write-Log -Level 'INFO' -Msg $m -Color Cyan    }
function Write-Ok   { param([string]$m) Write-Log -Level 'OK'   -Msg $m -Color Green   }
function Write-Warn { param([string]$m) Write-Log -Level 'WARN' -Msg $m -Color Yellow  }
function Write-Err  { param([string]$m) Write-Log -Level 'ERR'  -Msg $m -Color Red     }

# ---- Banner -----------------------------------------------
function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================" -ForegroundColor Cyan
    Write-Host "     GLOW LOGIC  -  Systeme de controle No-Code" -ForegroundColor Cyan
    Write-Host "     v3  |  API :$SERVER_PORT  |  Web :$WEB_PORT" -ForegroundColor Cyan
    Write-Host "  ================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ---- Helpers ----------------------------------------------
function Get-ListeningProcess {
    param([int]$Port)
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { return $null }
    return Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
}

function Stop-PortProcess {
    param([int]$Port)
    $p = Get-ListeningProcess -Port $Port
    if ($p) {
        Write-Warn "  Port $Port occupe par PID $($p.Id) ($($p.ProcessName)) - arret en cours..."
        # Tuer les processus enfants d'abord (node spawns workers)
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($p.Id)" -ErrorAction SilentlyContinue
        $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 800
        Write-Ok "  Port $Port libere."
    } else {
        Write-Info "  Port $Port : libre."
    }
}

function Wait-ForPort {
    param([int]$Port, [string]$Label)
    for ($i = 0; $i -lt $HEALTH_TIMEOUT; $i++) {
        if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
            Write-Ok "$Label repond sur :$Port (${i}s)"
            return $true
        }
        Start-Sleep -Seconds 1
        if ($i -gt 0 -and $i % 15 -eq 0) { Write-Warn "  ... en attente de $Label (${i}s elapsed)" }
    }
    Write-Err "$Label n'a pas demarre en ${HEALTH_TIMEOUT}s"
    return $false
}

function Test-HttpRoute {
    param([string]$Url, [string]$Label)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Ok "  [HTTP 200] $Label  $Url"
            return $true
        }
    } catch {}
    Write-Warn "  [FAIL]     $Label  $Url"
    return $false
}

function Show-ProcessInfo {
    param([int]$Port, [string]$Label)
    $p = Get-ListeningProcess -Port $Port
    if (-not $p) { return }
    $uptime = ''
    if ($p.StartTime) {
        $d = (Get-Date) - $p.StartTime
        $uptime = "  (up $([int]$d.TotalHours)h$($d.Minutes)m)"
    }
    Write-Host ("  {0,-20} :{1}  PID {2}{3}" -f $Label, $Port, $p.Id, $uptime) -ForegroundColor Green
}

function Invoke-LogRotation {
    try {
        if (-not (Test-Path $LogDir)) { return }
        $old = Get-ChildItem -Path $LogDir -Filter 'glow-logic-*.log' |
               Sort-Object Name -Descending |
               Select-Object -Skip $LOG_RETENTION
        $old | Remove-Item -Force -ErrorAction SilentlyContinue
        if ($old.Count -gt 0) { Write-Warn "Rotation : $($old.Count) anciens logs supprimes." }
    } catch {}
}

# ===========================================================
# MAIN
# ===========================================================
Show-Banner
Invoke-LogRotation
Write-Info "Log : $LogFile"
Write-Host ""

# -- [1/5] Prerequis ----------------------------------------
Write-Host "  [1/5] Prerequis..." -ForegroundColor Yellow
foreach ($cmd in 'node', 'npm') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Err "Commande introuvable : $cmd - installe Node.js depuis https://nodejs.org"
        pause
        exit 1
    }
}
$nv = node --version 2>$null
$mv = npm  --version 2>$null
Write-Ok "Node $nv  |  npm v$mv"
Write-Host ""

# -- [2/5] Arret des anciens services (TOUJOURS) ------------
Write-Host "  [2/5] Arret des services existants..." -ForegroundColor Yellow
Stop-PortProcess -Port $SERVER_PORT
Stop-PortProcess -Port $WEB_PORT
Write-Ok "Ports $SERVER_PORT / $WEB_PORT liberes."
Write-Host ""

# -- [3/5] Dependances --------------------------------------
# Dans un workspace npm, les packages sont hoistes vers la racine.
# On verifie uniquement le node_modules racine (+ un marqueur web).
Write-Host "  [3/5] Dependances..." -ForegroundColor Yellow
$rootModules = Join-Path $RepoRoot 'node_modules'
$webMarker   = Join-Path $WebPath  'node_modules\next'
$needsInstall = (-not (Test-Path $rootModules)) -or (-not (Test-Path $webMarker))

if ($needsInstall) {
    Write-Warn "node_modules absent ou incomplet - installation en cours..."
    # Utiliser cmd /c pour eviter le wrapper npm.ps1 de PowerShell (bug EBADPLATFORM)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Push-Location $RepoRoot
    cmd /c "npm install --loglevel=warn" 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    $npmExit = $LASTEXITCODE
    Pop-Location
    $ErrorActionPreference = $prevEAP
    if ($npmExit -ne 0) {
        Write-Warn "npm install a termine avec le code $npmExit (peut etre ignorable)"
    } else {
        Write-Ok "Dependances installees."
    }
} else {
    Write-Ok "Dependances OK."
}
Write-Host ""

# -- [4/5] Demarrage des services ---------------------------
Write-Host "  [4/5] Demarrage des services..." -ForegroundColor Yellow

$srvArgs = '/k', "title Glow Logic API && color 0A && npm run dev -w server"
$webArgs = '/k', "title Glow Logic Web && color 0B && npm run dev -w web"

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $RepoRoot -ArgumentList $srvArgs
Write-Info "  Fenetre API lancee  (npm run dev -w server  =>  :$SERVER_PORT)"

Start-Sleep -Seconds 2

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $RepoRoot -ArgumentList $webArgs
Write-Info "  Fenetre Web lancee  (npm run dev -w web     =>  :$WEB_PORT)"
Write-Host ""

# -- [5/5] Health checks ------------------------------------
Write-Host "  [5/5] Health checks..." -ForegroundColor Yellow

Write-Progress -Activity "Glow Logic" -Status "Attente API sur :$SERVER_PORT ..." -PercentComplete 30
$apiOk = Wait-ForPort -Port $SERVER_PORT -Label 'API Express'

Write-Progress -Activity "Glow Logic" -Status "Attente Web sur :$WEB_PORT ..." -PercentComplete 65
$webOk = Wait-ForPort -Port $WEB_PORT -Label 'Next.js'

Write-Progress -Activity "Glow Logic" -Status "Verification des routes HTTP..." -PercentComplete 85

if ($webOk) {
    Start-Sleep -Seconds 3
    $base = "http://localhost:$WEB_PORT"
    Test-HttpRoute "$base/"             "Smart Mode     " | Out-Null
    Test-HttpRoute "$base/patch"        "Patch DMX      " | Out-Null
    Test-HttpRoute "$base/dmx-tester"  "Testeur DMX    " | Out-Null
    Test-HttpRoute "$base/effects"      "Editeur Effets " | Out-Null
    Test-HttpRoute "$base/ai-lighting"  "IA Lumiere     " | Out-Null
}

if ($apiOk) {
    Test-HttpRoute "http://localhost:$SERVER_PORT/api/patch"    "GET /api/patch   " | Out-Null
    Test-HttpRoute "http://localhost:$SERVER_PORT/api/fixtures" "GET /api/fixtures" | Out-Null
}

Write-Progress -Activity "Glow Logic" -Status "Pret" -Completed
Write-Host ""

# -- Resume final -------------------------------------------
$apiColor = if ($apiOk) { 'Green' } else { 'Yellow' }
$webColor  = if ($webOk)  { 'Green' } else { 'Yellow' }

Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   GLOW LOGIC - EN LIGNE" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  API Express   http://localhost:{0}" -f $SERVER_PORT) -ForegroundColor $apiColor
Write-Host ("  Next.js Web   http://localhost:{0}" -f $WEB_PORT)    -ForegroundColor $webColor
Write-Host ""
Write-Host "  Pages disponibles :" -ForegroundColor DarkGray
Write-Host "    /              Smart Mode + Creator"       -ForegroundColor DarkGray
Write-Host "    /patch         Patch DMX (fixtures)"       -ForegroundColor DarkGray
Write-Host "    /dmx-tester    Testeur 512 canaux"         -ForegroundColor DarkGray
Write-Host "    /effects       Editeur d'effets"           -ForegroundColor DarkGray
Write-Host "    /ai-lighting   IA Lumiere (audio)"         -ForegroundColor DarkGray
Write-Host "    /fixtures      Scanner fixture OCR"        -ForegroundColor DarkGray
Write-Host "    /timeline      Timeline macros"            -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Logs : $LogFile" -ForegroundColor DarkGray
Write-Host ""

if (-not $apiOk -or -not $webOk) {
    Write-Host "  ATTENTION : Un ou plusieurs services n'ont pas demarre." -ForegroundColor Yellow
    Write-Host "  Verifiez les fenetres API / Web pour les erreurs." -ForegroundColor Yellow
    Write-Host ""
}

if ($webOk) {
    Start-Process "http://localhost:$WEB_PORT" | Out-Null
    Write-Ok "Navigateur ouvert sur la page d'accueil."
}

Write-Host ""

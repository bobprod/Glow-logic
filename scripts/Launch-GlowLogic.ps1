$ErrorActionPreference = 'Stop'

# -- Configuration -------------------------------------------------------------
$WEB_PORT       = 3000
$SERVER_PORT    = 3005
$HEALTH_TIMEOUT = 45

# -- Banner --------------------------------------------------------------------
function Show-Banner {
    Write-Host ''
    Write-Host '     GLOW LOGIC' -ForegroundColor Cyan
    Write-Host '     ==========' -ForegroundColor Cyan
    Write-Host '     Systeme de controle de spectacle No-Code' -ForegroundColor DarkGray
    Write-Host ''
}

# -- Helpers -------------------------------------------------------------------
function Test-RequiredCommand {
    param([Parameter(Mandatory=$true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw ('[ERREUR] Commande introuvable: {0} - installe Node.js.' -f $Name)
    }
}

function Get-ListeningProcess {
    param([Parameter(Mandatory=$true)][int]$Port)
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $c) { return $null }
    return Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
}

function Stop-PortProcess {
    param([Parameter(Mandatory=$true)][int]$Port)
    $p = Get-ListeningProcess -Port $Port
    if ($p) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Host ('  [OK] Port {0} libere (PID {1} - {2})' -f $Port, $p.Id, $p.ProcessName) -ForegroundColor Green
    }
}

function Wait-ForPort {
    param(
        [Parameter(Mandatory=$true)][int]$Port,
        [Parameter(Mandatory=$true)][string]$Label,
        [int]$Timeout = $HEALTH_TIMEOUT
    )
    $elapsed = 0
    while ($elapsed -lt $Timeout) {
        $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($c) {
            Write-Host ('  [OK] {0} demarre (port {1}, {2}s)' -f $Label, $Port, $elapsed) -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed % 5 -eq 0) {
            Write-Host ('  ... attente {0} ({1}s/{2}s)' -f $Label, $elapsed, $Timeout) -ForegroundColor DarkGray
        }
    }
    Write-Host ('  [!] {0} pas demarre dans les {1}s' -f $Label, $Timeout) -ForegroundColor Yellow
    return $false
}

# -- Demarrage -----------------------------------------------------------------
Show-Banner

# 1. Pre-requis
Write-Host '[1/5] Verification des pre-requis...' -ForegroundColor White
Test-RequiredCommand -Name 'node'
Test-RequiredCommand -Name 'npm'
$nodeVer = (node --version) 2>$null
$npmVer  = (npm  --version) 2>$null
Write-Host ('  Node {0} | npm v{1}' -f $nodeVer, $npmVer) -ForegroundColor DarkGray

# 2. Chemins
$repoRoot   = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $repoRoot 'apps\server'
$webPath    = Join-Path $repoRoot 'apps\web'

if (-not (Test-Path $serverPath)) { throw ('Dossier serveur introuvable: {0}' -f $serverPath) }
if (-not (Test-Path $webPath))    { throw ('Dossier web introuvable: {0}' -f $webPath) }

# 3. Dependencies
Write-Host '[2/5] Verification des dependances...' -ForegroundColor White
$rootMod   = Join-Path $repoRoot   'node_modules'
$serverMod = Join-Path $serverPath 'node_modules'
$webMod    = Join-Path $webPath    'node_modules'

$needInstall = (-not (Test-Path $rootMod)) -or (-not (Test-Path $serverMod)) -or (-not (Test-Path $webMod))

if ($needInstall) {
    Write-Host '  node_modules manquants - installation en cours...' -ForegroundColor Yellow
    Push-Location $repoRoot
    npm install --silent 2>&1 | Out-Null
    Pop-Location
    Write-Host '  [OK] Dependances installees' -ForegroundColor Green
} else {
    Write-Host '  [OK] Dependances presentes' -ForegroundColor Green
}

# 4. Ports
Write-Host '[3/5] Liberation des ports...' -ForegroundColor White
$portsFreed = $false
foreach ($port in $SERVER_PORT, $WEB_PORT) {
    $blocker = Get-ListeningProcess -Port $port
    if ($blocker) {
        Write-Host ('  Port {0} occupe par {1} (PID {2}) - arret...' -f $port, $blocker.ProcessName, $blocker.Id) -ForegroundColor Yellow
        Stop-PortProcess -Port $port
        $portsFreed = $true
    }
}
if (-not $portsFreed) {
    Write-Host ('  [OK] Ports {0} et {1} libres' -f $SERVER_PORT, $WEB_PORT) -ForegroundColor Green
}

# 5. Lancement
Write-Host '[4/5] Demarrage des services...' -ForegroundColor White

$srvCmd = 'title Glow Logic - Serveur API & color 0A & cd /d "' + $repoRoot + '" & npm run dev -w apps/server'
$webCmd = 'title Glow Logic - Interface Web & color 0B & cd /d "' + $repoRoot + '" & npm run dev -w apps/web'

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $repoRoot -ArgumentList '/k', $srvCmd | Out-Null
Write-Host '  Serveur API lance...' -ForegroundColor DarkGray

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $repoRoot -ArgumentList '/k', $webCmd | Out-Null
Write-Host '  Interface web lancee...' -ForegroundColor DarkGray

# 6. Health check
Write-Host '[5/5] Attente du demarrage...' -ForegroundColor White
$serverOk = Wait-ForPort -Port $SERVER_PORT -Label 'Serveur API'
$webOk    = Wait-ForPort -Port $WEB_PORT    -Label 'Interface web'

# -- Resume -------------------------------------------------------------------
Write-Host ''
Write-Host '  ====================================' -ForegroundColor Cyan
Write-Host '       GLOW LOGIC - EN LIGNE' -ForegroundColor Cyan
Write-Host '  ====================================' -ForegroundColor Cyan

if ($serverOk) {
    Write-Host ('  API     http://localhost:{0}' -f $SERVER_PORT) -ForegroundColor Green
} else {
    Write-Host ('  API     http://localhost:{0}   [!]' -f $SERVER_PORT) -ForegroundColor Yellow
}

if ($webOk) {
    Write-Host ('  Web     http://localhost:{0}' -f $WEB_PORT) -ForegroundColor Green
} else {
    Write-Host ('  Web     http://localhost:{0}    [!]' -f $WEB_PORT) -ForegroundColor Yellow
}

Write-Host '  ------------------------------------' -ForegroundColor DarkGray
Write-Host '  Stop    stop-glow-logic.cmd' -ForegroundColor DarkGray
Write-Host '  Status  npm run launcher:status' -ForegroundColor DarkGray
Write-Host '  ====================================' -ForegroundColor Cyan
Write-Host ''

if ($webOk) {
    Start-Process ('http://localhost:{0}' -f $WEB_PORT) | Out-Null
    Write-Host '  Navigateur ouvert.' -ForegroundColor Green
}

Write-Host ''

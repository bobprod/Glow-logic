$ErrorActionPreference = 'SilentlyContinue'

# -- Configuration ---
$WEB_PORT = 3000
$SRV_PORT = 3005
$OSC_PORT = 57121
$BRIDGE_PORT = 9999
$TIMEOUT = 60
$APP_URL = "http://localhost:$WEB_PORT"
$API_HEALTH_URL = "http://localhost:$SRV_PORT/api/health"

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $repoRoot 'apps\server'
$webPath = Join-Path $repoRoot 'apps\web'
$publicPath = Join-Path $webPath  'public'

# -- Helpers ---

function Get-PortPid([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.OwningProcess }
    return $null
}

function Free-Port([int]$Port) {
    $pid_ = Get-PortPid $Port
    if ($pid_) {
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 400
        Write-Host "  >> Port $Port libere" -ForegroundColor Yellow
    }
}

function Wait-Port([int]$Port, [string]$Label) {
    Write-Host "  .. Attente de $Label (port $Port)..." -ForegroundColor DarkGray
    for ($i = 0; $i -lt $TIMEOUT; $i++) {
        if (Get-PortPid $Port) {
            Write-Host "  OK $Label pret ($i s)" -ForegroundColor Green
            return $true
        }
        Start-Sleep 1
    }
    Write-Host "  !! $Label pas demarre apres $TIMEOUT s" -ForegroundColor Red
    return $false
}

function Test-HttpEndpoint([string]$Url, [int]$TimeoutSec = 4) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{
            Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
            Status = [int]$response.StatusCode
            Error = $null
        }
    }
    catch {
        return @{
            Ok = $false
            Status = $null
            Error = $_.Exception.Message
        }
    }
}

function Wait-Http([string]$Url, [string]$Label) {
    Write-Host "  .. Attente de $Label ($Url)..." -ForegroundColor DarkGray
    $lastError = $null
    for ($i = 0; $i -lt $TIMEOUT; $i++) {
        $check = Test-HttpEndpoint $Url
        if ($check.Ok) {
            Write-Host "  OK $Label pret ($i s, HTTP $($check.Status))" -ForegroundColor Green
            return $true
        }
        $lastError = $check.Error
        Start-Sleep 1
    }
    Write-Host "  !! $Label pas pret apres $TIMEOUT s" -ForegroundColor Red
    if ($lastError) {
        Write-Host "     $lastError" -ForegroundColor DarkYellow
    }
    return $false
}

function Get-LanIpv4 {
    try {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            Sort-Object InterfaceMetric |
            Select-Object -First 1 -ExpandProperty IPAddress
        return $ip
    }
    catch {
        return $null
    }
}

function Open-App([string]$Url) {
    $edges = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
    )
    $chromes = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    )
    foreach ($br in ($edges + $chromes)) {
        if (Test-Path $br) {
            Start-Process $br "--app=$Url --window-size=1600,900 --no-first-run"
            return
        }
    }
    Start-Process $Url
}

function Show-Toast([string]$Title, [string]$Body) {
    try {
        $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
        $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]
        $xml = "<toast><visual><binding template='ToastGeneric'><text>$Title</text><text>$Body</text></binding></visual></toast>"
        $xd = [Windows.Data.Xml.Dom.XmlDocument]::new()
        $xd.LoadXml($xml)
        $n = [Windows.UI.Notifications.ToastNotification]::new($xd)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Glow Logic').Show($n)
    }
    catch { }
}

# -- Banner ---
Clear-Host
Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host "   GLOW LOGIC v2  -- Smart Stage OS" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor DarkGray
Write-Host ""

# -- [1] Pre-requis ---
Write-Host "[1/5] Pre-requis..." -ForegroundColor White
foreach ($cmd in 'node', 'npm') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "  ERREUR: '$cmd' introuvable. Installe Node.js: https://nodejs.org" -ForegroundColor Red
        pause; exit 1
    }
}
Write-Host "  OK Node $(node --version) / npm $(npm --version)" -ForegroundColor Green

# -- [2] Dependances ---
Write-Host "[2/5] Dependances npm..." -ForegroundColor White
$missing = (-not (Test-Path (Join-Path $repoRoot   'node_modules'))) -or
(-not (Test-Path (Join-Path $serverPath 'node_modules'))) -or
(-not (Test-Path (Join-Path $webPath    'node_modules')))

if ($missing) {
    Write-Host "  Installation (patience ~1 min)..." -ForegroundColor Yellow
    Push-Location $repoRoot
    npm install --silent 2>&1 | Out-Null
    Pop-Location
    Write-Host "  OK Dependances installees" -ForegroundColor Green
}
else {
    Write-Host "  OK node_modules presents" -ForegroundColor Green
}

# -- [3] Icones PWA ---
Write-Host "[3/5] Icones PWA..." -ForegroundColor White
$i192 = Join-Path $publicPath 'icons\icon-192x192.png'
$i512 = Join-Path $publicPath 'icons\icon-512x512.png'
if (-not (Test-Path $i192) -or -not (Test-Path $i512)) {
    $gen = Join-Path $PSScriptRoot 'Generate-PwaIcons.ps1'
    if (Test-Path $gen) {
        & $gen -WebPublicPath $publicPath
    }
    else {
        Write-Host "  >> Generate-PwaIcons.ps1 absent, icones ignorees" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  OK Icones presentes (192 + 512 px)" -ForegroundColor Green
}

# -- [4] Ports ---
Write-Host "[4/5] Liberation des ports..." -ForegroundColor White
Free-Port $SRV_PORT
Free-Port $WEB_PORT
Free-Port $BRIDGE_PORT
Free-Port $OSC_PORT

# Arrêt des processus DMX orphelins éventuels
$qlcProcs = Get-Process -Name qlcplus -ErrorAction SilentlyContinue
if ($qlcProcs) {
    foreach ($p in $qlcProcs) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  >> QLC+ résiduel arrêté (PID $($p.Id))" -ForegroundColor Yellow
    }
}

$pyProcesses = Get-CimInstance Win32_Process -Filter "Name = 'python.exe' or Name = 'pythonw.exe'" -ErrorAction SilentlyContinue
foreach ($p in $pyProcesses) {
    if ($p.CommandLine -like "*dmx_bridge.py*") {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  >> Pont DMX Python résiduel arrêté (PID $($p.ProcessId))" -ForegroundColor Yellow
    }
}

Write-Host "  OK Ports libres" -ForegroundColor Green

# -- [5] Demarrage ---
Write-Host "[5/5] Demarrage des services..." -ForegroundColor White

$srvCmd = "/k title [GL] API & color 0A & cd /d `"$serverPath`" & npm run dev"
$webCmd = "/k title [GL] Web & color 0B & cd /d `"$webPath`" & npm run dev"

Start-Process 'cmd.exe' -ArgumentList $srvCmd -WindowStyle Minimized
Write-Host "  .. Serveur API demarre (port $SRV_PORT)" -ForegroundColor DarkGray

Start-Process 'cmd.exe' -ArgumentList $webCmd -WindowStyle Minimized
Write-Host "  .. Interface Web demarree (port $WEB_PORT)" -ForegroundColor DarkGray

# -- Health check ---
Write-Host ""
$srvPortOk = Wait-Port $SRV_PORT "port API"
$webPortOk = Wait-Port $WEB_PORT "port Web"
$srvOk = Wait-Http $API_HEALTH_URL "API health"
$webOk = Wait-Http $APP_URL "Interface Web"
$lanIp = Get-LanIpv4
$tabletUrl = if ($lanIp) { "http://$($lanIp):$WEB_PORT" } else { $null }

# -- Resume ---
Write-Host ""
Write-Host "  ======================================" -ForegroundColor Cyan
if ($srvOk) { Write-Host "  API   http://localhost:$SRV_PORT  [health OK]" -ForegroundColor Green }
elseif ($srvPortOk) { Write-Host "  API   http://localhost:$SRV_PORT  [port ouvert, health KO]" -ForegroundColor Yellow }
else { Write-Host "  API   http://localhost:$SRV_PORT  [pas demarre]" -ForegroundColor Red }
if ($webOk) { Write-Host "  APP   $APP_URL  [HTTP OK]" -ForegroundColor Green }
elseif ($webPortOk) { Write-Host "  APP   $APP_URL  [port ouvert, HTTP KO]" -ForegroundColor Yellow }
else { Write-Host "  APP   $APP_URL   [pas demarre]" -ForegroundColor Red }
if ($tabletUrl) { Write-Host "  LAN   $tabletUrl  [tablette meme Wi-Fi]" -ForegroundColor Cyan }
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""

# -- Ouvrir l'app ---
if ($webOk) {
    Write-Host "  Ouverture dans Edge/Chrome (mode App)..." -ForegroundColor DarkGray
    Open-App $APP_URL

    if ($srvOk) {
        $toastBody = if ($tabletUrl) { "App: $APP_URL  |  Tablette: $tabletUrl" } else { "App: $APP_URL  |  API: localhost:$SRV_PORT" }
        Show-Toast "Glow Logic pret !" $toastBody
    }
    else {
        Show-Toast "Glow Logic" "Interface OK - API health KO (verif fenetre [GL] API)"
        Write-Host "  ATTENTION: Web OK mais API health KO. Ouvre '[GL] API' pour voir les logs." -ForegroundColor Yellow
    }
    Write-Host "  OK Application ouverte." -ForegroundColor Green
}
else {
    Write-Host "  ERREUR: Interface Web pas demarree." -ForegroundColor Red
    Write-Host "  Clique sur '[GL] Web' dans la barre des taches pour voir les logs." -ForegroundColor Yellow
    Show-Toast "Glow Logic - Erreur" "Verif les fenetres GL dans la barre des taches"
}

Write-Host ""
Start-Sleep 3

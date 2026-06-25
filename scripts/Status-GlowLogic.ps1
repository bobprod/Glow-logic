$ErrorActionPreference = 'Stop'

$WEB_PORT    = 3000
$SERVER_PORT = 3005
$WEB_URL = "http://localhost:$WEB_PORT"
$API_HEALTH_URL = "http://localhost:$SERVER_PORT/api/health"

Write-Host ''
Write-Host '  GLOW LOGIC - Statut' -ForegroundColor Cyan
Write-Host '  ====================' -ForegroundColor DarkGray
Write-Host ''

$allOk = $true

function Get-ListeningProcessId {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($conn) {
        return [int]$conn.OwningProcess
    }

    $line = netstat -ano -p tcp |
        Select-String -Pattern (":$Port\s+.*LISTENING\s+\d+$") |
        Select-Object -First 1
    if (-not $line) {
        return $null
    }

    $parts = ($line.Line.Trim() -split '\s+')
    return [int]$parts[-1]
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 4
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{
            Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
            Status = [int]$response.StatusCode
            Error = $null
        }
    } catch {
        return @{
            Ok = $false
            Status = $null
            Error = $_.Exception.Message
        }
    }
}

function Get-LanIpv4 {
    try {
        return Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            Sort-Object InterfaceMetric |
            Select-Object -First 1 -ExpandProperty IPAddress
    } catch {
        return $null
    }
}

function Format-HttpStatus {
    param($Check)
    if ($Check.Ok) { return "HTTP $($Check.Status)" }
    if ($Check.Error) { return $Check.Error }
    return "pas de reponse"
}

$apiHealth = Test-HttpEndpoint -Url $API_HEALTH_URL
$webHealth = Test-HttpEndpoint -Url $WEB_URL

foreach ($entry in @(
    @{ Port = $SERVER_PORT; Label = 'Serveur API'; Url = $API_HEALTH_URL; Health = $apiHealth },
    @{ Port = $WEB_PORT;    Label = 'Interface web'; Url = $WEB_URL; Health = $webHealth }
)) {
    $procId = Get-ListeningProcessId -Port $entry.Port

    if ($procId) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { '?' }
        $uptime = ''
        if ($proc -and $proc.StartTime) {
            $dur = (Get-Date) - $proc.StartTime
            $uptime = ' | up {0:D2}h{1:D2}m' -f ([int]$dur.TotalHours), $dur.Minutes
        }
        $healthText = Format-HttpStatus $entry.Health
        $color = if ($entry.Health.Ok) { 'Green' } else { 'Yellow' }
        Write-Host ('  [ON]  {0,-16} {1}  (PID {2}{3})  [{4}]' -f $entry.Label, $entry.Url, $procId, $uptime, $healthText) -ForegroundColor $color
        if (-not $entry.Health.Ok) { $allOk = $false }
    } else {
        Write-Host ("  [OFF] {0,-16} port {1} libre" -f $entry.Label, $entry.Port) -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ''
$lanIp = Get-LanIpv4
if ($lanIp) {
    Write-Host ("  URL tablette/LAN : http://{0}:{1}" -f $lanIp, $WEB_PORT) -ForegroundColor Cyan
    Write-Host ''
}

if ($allOk) {
    Write-Host '  Tout est en ligne.' -ForegroundColor Green
} else {
    if ($webHealth.Ok -and -not $apiHealth.Ok) {
        Write-Host '  Interface web OK, mais API health KO : verifier la fenetre [GL] API.' -ForegroundColor Yellow
    } elseif ($apiHealth.Ok -and -not $webHealth.Ok) {
        Write-Host '  API OK, mais interface web KO : verifier la fenetre [GL] Web.' -ForegroundColor Yellow
    } else {
        Write-Host '  Des services sont arretes ou non sains. Lance: launch-glow-logic.cmd' -ForegroundColor Yellow
    }
}

Write-Host ''

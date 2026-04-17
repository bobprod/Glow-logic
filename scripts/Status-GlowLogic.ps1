$ErrorActionPreference = 'Stop'

$WEB_PORT    = 3000
$SERVER_PORT = 3005

Write-Host ''
Write-Host '  GLOW LOGIC - Statut' -ForegroundColor Cyan
Write-Host '  ====================' -ForegroundColor DarkGray
Write-Host ''

$allOk = $true

foreach ($entry in @(
    @{ Port = $SERVER_PORT; Label = 'Serveur API' },
    @{ Port = $WEB_PORT;    Label = 'Interface web' }
)) {
    $conn = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { '?' }
        $procId = $conn.OwningProcess
        $uptime = ''
        if ($proc -and $proc.StartTime) {
            $dur = (Get-Date) - $proc.StartTime
            $uptime = ' | up {0:D2}h{1:D2}m' -f ([int]$dur.TotalHours), $dur.Minutes
        }
        Write-Host ('  [ON]  {0,-16} http://localhost:{1}  (PID {2}{3})' -f $entry.Label, $entry.Port, $procId, $uptime) -ForegroundColor Green
    } else {
        Write-Host ("  [OFF] {0,-16} port {1} libre" -f $entry.Label, $entry.Port) -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ''

if ($allOk) {
    Write-Host '  Tout est en ligne.' -ForegroundColor Green
} else {
    Write-Host '  Des services sont arretes. Lance: launch-glow-logic.cmd' -ForegroundColor Yellow
}

Write-Host ''

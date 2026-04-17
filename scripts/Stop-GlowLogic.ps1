$ErrorActionPreference = 'Stop'

$ports = 3000, 3005

Write-Host ""
Write-Host '  GLOW LOGIC - Arret des services' -ForegroundColor Cyan
Write-Host "  ================================" -ForegroundColor DarkGray
Write-Host ""

$connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
Where-Object { $_.LocalPort -in $ports }

if (-not $connections) {
    Write-Host "  [OK] Aucun processus actif sur les ports $($ports -join '/')." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$pidsStopped = @{}

foreach ($connection in $connections) {
    $processId = $connection.OwningProcess

    if ($pidsStopped.ContainsKey($processId)) { continue }

    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) { continue }

    # Kill child processes (node spawns children)
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $processId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $pidsStopped[$processId] = $true
    Write-Host ('  [OK] {0} (PID {1}) - port {2}' -f $process.ProcessName, $processId, $connection.LocalPort) -ForegroundColor Green
}

Write-Host ""
Write-Host "  $($pidsStopped.Count) processus arretes. Ports liberes." -ForegroundColor Cyan
Write-Host ""

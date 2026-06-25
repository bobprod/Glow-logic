$ErrorActionPreference = 'Stop'

$ports = 3000, 3005, 9999, 57121

Write-Host ""
Write-Host '  GLOW LOGIC - Arret des services' -ForegroundColor Cyan
Write-Host "  ================================" -ForegroundColor DarkGray
Write-Host ""

# 1. Arrêt des processus DMX spécifiques (QLC+ et pont Python)
Write-Host "  .. Nettoyage des processus DMX..." -ForegroundColor DarkGray

# Tuer qlcplus.exe
$qlcProcs = Get-Process -Name qlcplus -ErrorAction SilentlyContinue
if ($qlcProcs) {
    foreach ($p in $qlcProcs) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] QLC+ arrête (PID $($p.Id))" -ForegroundColor Green
    }
}

# Tuer les processus Python exécutant dmx_bridge.py
$pyProcesses = Get-CimInstance Win32_Process -Filter "Name = 'python.exe' or Name = 'pythonw.exe'" -ErrorAction SilentlyContinue
foreach ($p in $pyProcesses) {
    if ($p.CommandLine -like "*dmx_bridge.py*") {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Pont DMX Python arrete (PID $($p.ProcessId))" -ForegroundColor Green
    }
}

# 2. Arrêt des serveurs web et API
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
Write-Host "  Services arretes et ports liberes." -ForegroundColor Cyan
Write-Host ""

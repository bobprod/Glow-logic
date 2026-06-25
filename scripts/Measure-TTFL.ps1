param(
    [switch]$StartServices,
    [switch]$RunFieldSmoke,
    [int]$TimeoutSec = 180,
    [int]$PollMs = 500,
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'

$WEB_PORT = 3000
$SERVER_PORT = 3005
$WEB_URL = "http://localhost:$WEB_PORT"
$API_BASE_URL = "http://127.0.0.1:$SERVER_PORT"
$API_HEALTH_URL = "$API_BASE_URL/api/health"
$repoRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $repoRoot 'apps\server'
$webPath = Join-Path $repoRoot 'apps\web'
$startedAt = Get-Date

function Format-Duration {
    param([TimeSpan]$Duration)
    return ('{0:n1}s' -f $Duration.TotalSeconds)
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 3
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

function Wait-Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Url
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $attempts = 0
    $last = $null

    while ((Get-Date) -lt $deadline) {
        $attempts += 1
        $last = Test-HttpEndpoint -Url $Url
        if ($last.Ok) {
            $elapsed = (Get-Date) - $startedAt
            Write-Host ("  OK {0,-14} {1} ({2}, {3})" -f $Label, $Url, "HTTP $($last.Status)", (Format-Duration $elapsed)) -ForegroundColor Green
            return @{
                Label = $Label
                Url = $Url
                Ok = $true
                Status = $last.Status
                Error = $null
                ElapsedSeconds = [math]::Round($elapsed.TotalSeconds, 1)
                Attempts = $attempts
            }
        }
        Start-Sleep -Milliseconds $PollMs
    }

    $elapsedFail = (Get-Date) - $startedAt
    $errorText = if ($last -and $last.Error) { $last.Error } else { 'timeout' }
    Write-Host ("  KO {0,-14} {1} ({2})" -f $Label, $Url, $errorText) -ForegroundColor Red
    return @{
        Label = $Label
        Url = $Url
        Ok = $false
        Status = $null
        Error = $errorText
        ElapsedSeconds = [math]::Round($elapsedFail.TotalSeconds, 1)
        Attempts = $attempts
    }
}

function Start-ServiceIfRequested {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    Write-Host ("  Start {0}..." -f $Label) -ForegroundColor DarkGray
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory $WorkingDirectory -WindowStyle Hidden | Out-Null
}

function Run-FieldSmoke {
    $oldApi = $env:GLOW_API_BASE
    $oldWeb = $env:GLOW_WEB_BASE
    $env:GLOW_API_BASE = $API_BASE_URL
    $env:GLOW_WEB_BASE = $WEB_URL

    try {
        $smokeStarted = Get-Date
        $output = & npm run test:field 2>&1
        $exitCode = $LASTEXITCODE
        $elapsed = (Get-Date) - $smokeStarted
        return @{
            Ok = ($exitCode -eq 0)
            ExitCode = $exitCode
            ElapsedSeconds = [math]::Round($elapsed.TotalSeconds, 1)
            Output = ($output -join [Environment]::NewLine)
        }
    } finally {
        $env:GLOW_API_BASE = $oldApi
        $env:GLOW_WEB_BASE = $oldWeb
    }
}

function New-ReportPath {
    $dir = Join-Path $repoRoot 'reports\field'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return (Join-Path $dir ("ttfl-{0}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss')))
}

Write-Host ''
Write-Host '  GLOW LOGIC - Mesure TTFL' -ForegroundColor Cyan
Write-Host '  =========================' -ForegroundColor DarkGray
Write-Host ''

if ($StartServices) {
    Start-ServiceIfRequested -Label 'API' -WorkingDirectory $serverPath
    Start-ServiceIfRequested -Label 'Web' -WorkingDirectory $webPath
}

$apiResult = Wait-Endpoint -Label 'API health' -Url $API_HEALTH_URL
$webResult = Wait-Endpoint -Label 'Interface web' -Url $WEB_URL
$total = (Get-Date) - $startedAt

$fieldSmoke = $null
if ($RunFieldSmoke) {
    if ($apiResult.Ok -and $webResult.Ok) {
        Write-Host ''
        Write-Host '  Smoke terrain...' -ForegroundColor White
        $fieldSmoke = Run-FieldSmoke
        if ($fieldSmoke.Ok) {
            Write-Host ("  OK test:field ({0})" -f (Format-Duration ([TimeSpan]::FromSeconds($fieldSmoke.ElapsedSeconds)))) -ForegroundColor Green
        } else {
            Write-Host ("  KO test:field (exit {0})" -f $fieldSmoke.ExitCode) -ForegroundColor Red
        }
    } else {
        Write-Host '  SKIP test:field: API ou Web indisponible.' -ForegroundColor Yellow
    }
}

$targetPreviewSec = 180
$targetHardwareSec = 600
$previewOk = $webResult.Ok -and $total.TotalSeconds -le $targetPreviewSec
$hardwareOk = $webResult.Ok -and $total.TotalSeconds -le $targetHardwareSec
$status = if ($apiResult.Ok -and $webResult.Ok -and (-not $RunFieldSmoke -or ($fieldSmoke -and $fieldSmoke.Ok))) { 'PASS' } else { 'FAIL' }

if (-not $ReportPath) {
    $ReportPath = New-ReportPath
} else {
    $reportDir = Split-Path -Parent $ReportPath
    if ($reportDir) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
}

$fieldSmokeSection = if ($RunFieldSmoke -and $fieldSmoke) {
@"
## Smoke terrain

- Status: $(if ($fieldSmoke.Ok) { 'PASS' } else { 'FAIL' })
- Exit code: $($fieldSmoke.ExitCode)
- Duration: $($fieldSmoke.ElapsedSeconds)s

```text
$($fieldSmoke.Output)
```
"@
} elseif ($RunFieldSmoke) {
@"
## Smoke terrain

- Status: SKIP
- Reason: API ou Web indisponible.
"@
} else {
@"
## Smoke terrain

- Status: SKIP
- Reason: option -RunFieldSmoke non activee.
"@
}

$report = @"
# Glow Logic TTFL Report

- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- Status: $status
- StartServices: $StartServices
- Total until API/Web check: $([math]::Round($total.TotalSeconds, 1))s

## Targets

- Preview 3D target: < 180s - $(if ($previewOk) { 'PASS' } else { 'FAIL' })
- Hardware target: < 600s - $(if ($hardwareOk) { 'PASS' } else { 'FAIL' })

## Endpoints

| Check | URL | Status | Elapsed | Attempts | Detail |
|---|---|---:|---:|---:|---|
| API health | $($apiResult.Url) | $(if ($apiResult.Ok) { "HTTP $($apiResult.Status)" } else { 'FAIL' }) | $($apiResult.ElapsedSeconds)s | $($apiResult.Attempts) | $($apiResult.Error) |
| Interface web | $($webResult.Url) | $(if ($webResult.Ok) { "HTTP $($webResult.Status)" } else { 'FAIL' }) | $($webResult.ElapsedSeconds)s | $($webResult.Attempts) | $($webResult.Error) |

$fieldSmokeSection

## Manual TTFL Step

Start the human stopwatch at launcher click. Stop it when one real fixture, or the 3D preview, responds to a fader.

Reference flow:

1. Open Perform/Smart.
2. Patch or load a small fixture set.
3. Move one intensity fader.
4. Record the measured time here: `__ min __ s`.
"@

Set-Content -Path $ReportPath -Value $report -Encoding UTF8

Write-Host ''
Write-Host ("  Rapport: {0}" -f $ReportPath) -ForegroundColor Cyan
Write-Host ("  Resultat: {0} ({1})" -f $status, (Format-Duration $total)) -ForegroundColor $(if ($status -eq 'PASS') { 'Green' } else { 'Red' })
Write-Host ''

if ($status -ne 'PASS') {
    exit 1
}

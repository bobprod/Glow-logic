param(
    [string]$Operator = '',
    [string]$Machine = $env:COMPUTERNAME,
    [string]$Mode = 'Preview 3D',
    [string]$Controller = 'Keyboard',
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$generatedAt = Get-Date

function Get-GitRef {
    try {
        $branch = git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null
        $sha = git -C $repoRoot rev-parse --short HEAD 2>$null
        if ($branch -and $sha) { return "$branch@$sha" }
    } catch {}
    return 'unknown'
}

function New-ReportPath {
    $dir = Join-Path $repoRoot 'reports\field'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return Join-Path $dir ("field-validation-{0}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

if (-not $ReportPath) {
    $ReportPath = New-ReportPath
} else {
    $reportDir = Split-Path -Parent $ReportPath
    if ($reportDir) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
}

$gitRef = Get-GitRef
$operatorText = if ($Operator) { $Operator } else { '________________' }
$machineText = if ($Machine) { $Machine } else { '________________' }

$report = @"
# Glow Logic Field Validation Report

- Generated: $($generatedAt.ToString('yyyy-MM-dd HH:mm:ss'))
- Operator: $operatorText
- Machine: $machineText
- Mode: $Mode
- Controller: $Controller
- Build or branch: $gitRef
- Decision: `PASS / FAIL / RETEST`

## Automated Gate

| Check | Command | Result | Notes |
|---|---|---|---|
| TypeScript | `npm run typecheck --workspaces` | `PASS / FAIL` | |
| Lint | `npm run lint --workspace web` | `PASS / FAIL` | |
| Unit tests | `npm run test:unit --workspace web` | `PASS / FAIL` | |
| API smoke | `npm run test:api` | `PASS / FAIL` | |
| Field smoke | `npm run test:field` | `PASS / FAIL` | |
| TTFL helper | `npm run field:ttfl` | `PASS / FAIL` | report: `________________` |
| Build | `npm run build` | `PASS / FAIL / EPERM blocked` | |

## Show From Scratch

Start a stopwatch at launcher click. Stop the TTFL stopwatch when one real fixture, or the 3D preview, responds to an intensity fader.

| Step | Expected Result | Result | Notes |
|---|---|---|---|
| Launch app | Launcher opens API + Web, Smart/Perform reachable | `PASS / FAIL` | |
| Patch fixtures | 4 PAR LED + 2 moving heads exist in the patch | `PASS / FAIL` | |
| Place fixtures | Fixtures appear on the stage plan and keep positions after save/reload | `PASS / FAIL` | |
| Create pads | 8 scene pads exist on page 1 | `PASS / FAIL` | |
| Map controls | 2 pads + 1 group fader are mapped | `PASS / FAIL` | |
| Move fixture | Inspector opens; XY movement affects preview/fixture | `PASS / FAIL` | |
| Record automation | 10 s XY movement records and plays back in timeline | `PASS / FAIL` | |
| Save project | Pads, mappings, positions, timeline saved | `PASS / FAIL` | |
| Restart app | Project reloads intact after full close/relaunch | `PASS / FAIL` | |
| DMX failure visible | Cutting a DMX output makes badge red within 5 s | `PASS / FAIL / N/A` | |

## TTFL

- Preview target: `< 3 min`
- Hardware target: `< 10 min`
- Measured TTFL: `__ min __ s`
- Result: `PASS / FAIL`

## Blocking Issues

- `________________________________`
- `________________________________`

## Follow-Up Issues

- `________________________________`
- `________________________________`

## Notes

-
"@

Set-Content -Path $ReportPath -Value $report -Encoding UTF8
Write-Host ("Field validation report created: {0}" -f $ReportPath) -ForegroundColor Green

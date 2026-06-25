param(
    [switch]$IncludeBuild,
    [switch]$IncludeUi,
    [switch]$IncludeTtfl,
    [switch]$FailOnOptional,
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$startedAt = Get-Date

function New-ReportPath {
    $dir = Join-Path $repoRoot 'reports\field'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return Join-Path $dir ("release-check-{0}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

function Format-Duration {
    param([TimeSpan]$Duration)
    return ('{0:n1}s' -f $Duration.TotalSeconds)
}

function Get-GitRef {
    try {
        $branch = git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null
        $sha = git -C $repoRoot rev-parse --short HEAD 2>$null
        if ($branch -and $sha) { return "$branch@$sha" }
    } catch {}
    return 'unknown'
}

function Limit-Output {
    param(
        [string]$Text,
        [int]$MaxLines = 120
    )

    if (-not $Text) { return '' }
    $lines = $Text -split "`r?`n"
    if ($lines.Count -le $MaxLines) { return $Text.Trim() }
    $tail = $lines | Select-Object -Last $MaxLines
    return "[... trimmed to last $MaxLines lines ...]`n$($tail -join [Environment]::NewLine)"
}

function Indent-Output {
    param([string]$Text)
    if (-not $Text) { return '    <no output>' }
    return (($Text -split "`r?`n") | ForEach-Object { "    $_" }) -join [Environment]::NewLine
}

function Invoke-ReleaseCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [bool]$Optional = $false
    )

    Write-Host ("  .. {0}" -f $Name) -ForegroundColor DarkGray
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Push-Location $repoRoot
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $Executable @Arguments 2>&1
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    } catch {
        $output = @($_.Exception.Message)
        $exitCode = 1
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
        $sw.Stop()
    }

    $outputText = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $blocked = $outputText -match 'spawn EPERM' -or $outputText -match 'code:\s*''?EPERM'
    $status = if ($exitCode -eq 0) { 'PASS' } elseif ($blocked) { 'BLOCKED' } else { 'FAIL' }
    $color = if ($status -eq 'PASS') { 'Green' } elseif ($status -eq 'BLOCKED') { 'Yellow' } else { 'Red' }
    Write-Host ("  {0,-7} {1} ({2})" -f $status, $Name, (Format-Duration $sw.Elapsed)) -ForegroundColor $color

    return [pscustomobject]@{
        Name = $Name
        Command = "$Executable $($Arguments -join ' ')"
        Optional = $Optional
        Status = $status
        ExitCode = $exitCode
        DurationSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
        Output = $outputText
    }
}

if (-not $ReportPath) {
    $ReportPath = New-ReportPath
} else {
    $reportDir = Split-Path -Parent $ReportPath
    if ($reportDir) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
}

$checks = @(
    @{ Name = 'TypeScript'; Exe = 'npm.cmd'; Args = @('run', 'typecheck', '--workspaces'); Optional = $false },
    @{ Name = 'ESLint web'; Exe = 'npm.cmd'; Args = @('run', 'lint', '--workspace', 'web'); Optional = $false },
    @{ Name = 'Unit tests web'; Exe = 'npm.cmd'; Args = @('run', 'test:unit', '--workspace', 'web'); Optional = $false },
    @{ Name = 'API smoke'; Exe = 'npm.cmd'; Args = @('run', 'test:api'); Optional = $false },
    @{ Name = 'Field smoke'; Exe = 'npm.cmd'; Args = @('run', 'test:field'); Optional = $false },
    @{ Name = 'Diff whitespace'; Exe = 'git'; Args = @('diff', '--check'); Optional = $false }
)

if ($IncludeTtfl) {
    $checks += @{ Name = 'TTFL helper'; Exe = 'npm.cmd'; Args = @('run', 'field:ttfl'); Optional = $true }
}
if ($IncludeUi) {
    $checks += @{ Name = 'Visual tests'; Exe = 'npm.cmd'; Args = @('run', 'test:visual'); Optional = $true }
    $checks += @{ Name = 'Show flow tests'; Exe = 'npm.cmd'; Args = @('run', 'test:show'); Optional = $true }
}
if ($IncludeBuild) {
    $checks += @{ Name = 'Production build'; Exe = 'npm.cmd'; Args = @('run', 'build'); Optional = $true }
}

Write-Host ''
Write-Host '  GLOW LOGIC - Release Candidate Checks' -ForegroundColor Cyan
Write-Host '  =====================================' -ForegroundColor DarkGray
Write-Host ''

$results = foreach ($check in $checks) {
    Invoke-ReleaseCheck -Name $check.Name -Executable $check.Exe -Arguments $check.Args -Optional $check.Optional
}

$requiredFailures = @($results | Where-Object { -not $_.Optional -and $_.Status -ne 'PASS' })
$optionalFailures = @($results | Where-Object { $_.Optional -and $_.Status -ne 'PASS' })
$overall = if ($requiredFailures.Count -eq 0 -and (-not $FailOnOptional -or $optionalFailures.Count -eq 0)) { 'PASS' } else { 'FAIL' }
$finishedAt = Get-Date

$rows = $results | ForEach-Object {
    "| $($_.Name) | ``$($_.Command)`` | $($_.Status) | $($_.ExitCode) | $($_.DurationSeconds)s | $(if ($_.Optional) { 'yes' } else { 'no' }) |"
}

$details = $results | ForEach-Object {
    $limited = Limit-Output $_.Output
    @(
        "### $($_.Name)",
        '',
        "- Status: $($_.Status)",
        "- Command: $($_.Command)",
        "- Exit code: $($_.ExitCode)",
        "- Duration: $($_.DurationSeconds)s",
        "- Optional: $(if ($_.Optional) { 'yes' } else { 'no' })",
        '',
        (Indent-Output $limited)
    ) -join [Environment]::NewLine
}

$report = @(
    '# Glow Logic Release Candidate Check',
    '',
    "- Generated: $($finishedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Git: $(Get-GitRef)",
    "- Overall: $overall",
    "- IncludeBuild: $IncludeBuild",
    "- IncludeUi: $IncludeUi",
    "- IncludeTtfl: $IncludeTtfl",
    "- FailOnOptional: $FailOnOptional",
    "- Duration: $(Format-Duration ($finishedAt - $startedAt))",
    '',
    '## Summary',
    '',
    '| Check | Command | Status | Exit | Duration | Optional |',
    '|---|---|---:|---:|---:|---:|',
    ($rows -join [Environment]::NewLine),
    '',
    '## Details',
    '',
    ($details -join ([Environment]::NewLine + [Environment]::NewLine)),
    '',
    '## Notes',
    '',
    '- BLOCKED usually means the command hit the known Windows/Codex spawn EPERM restriction.',
    '- UI checks require Playwright workers to launch successfully.',
    '- This report is a gate, not the full human field validation ritual from docs/FIELD_VALIDATION.md.'
) -join [Environment]::NewLine

Set-Content -Path $ReportPath -Value $report -Encoding UTF8

Write-Host ''
Write-Host ("  Rapport: {0}" -f $ReportPath) -ForegroundColor Cyan
Write-Host ("  Resultat: {0}" -f $overall) -ForegroundColor $(if ($overall -eq 'PASS') { 'Green' } else { 'Red' })
Write-Host ''

if ($overall -ne 'PASS') {
    exit 1
}

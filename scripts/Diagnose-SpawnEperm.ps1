param(
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$generatedAt = Get-Date

function New-ReportPath {
    $dir = Join-Path $repoRoot 'reports\field'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return Join-Path $dir ("eperm-diagnosis-{0}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

function Invoke-Capture {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Executable @Arguments 2>&1
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        return [pscustomobject]@{
            Name = $Name
            Command = "$Executable $($Arguments -join ' ')"
            ExitCode = $exitCode
            Output = (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
        }
    } catch {
        return [pscustomobject]@{
            Name = $Name
            Command = "$Executable $($Arguments -join ' ')"
            ExitCode = 1
            Output = $_.Exception.Message
        }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Get-CommandPath {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    return $cmd.Source
}

function Format-Block {
    param([string]$Text)
    if (-not $Text) { return '<no output>' }
    return $Text
}

if (-not $ReportPath) {
    $ReportPath = New-ReportPath
} else {
    $reportDir = Split-Path -Parent $ReportPath
    if ($reportDir) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
}

$nodePath = Get-CommandPath 'node'
$npmPath = Get-CommandPath 'npm'
$npxPath = Get-CommandPath 'npx'
$repoOnDesktop = $repoRoot -like '*\Desktop\*'
$probePath = Join-Path (Join-Path $repoRoot 'reports\field') 'spawn-probe.tmp.js'

$nodeSpawnProbe = @'
const { spawnSync } = require("node:child_process");
const result = spawnSync(process.execPath, ["-e", "console.log('child-spawn-ok')"], {
  encoding: "utf8",
  windowsHide: true
});
console.log(JSON.stringify({
  parent: process.execPath,
  status: result.status,
  signal: result.signal,
  error: result.error && result.error.code,
  stdout: (result.stdout || "").trim(),
  stderr: (result.stderr || "").trim()
}, null, 2));
if (result.error || result.status !== 0) process.exit(1);
'@

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $probePath) | Out-Null
Set-Content -Path $probePath -Value $nodeSpawnProbe -Encoding UTF8

$checks = @(
    (Invoke-Capture -Name 'where node' -Executable 'where.exe' -Arguments @('node')),
    (Invoke-Capture -Name 'where npm' -Executable 'where.exe' -Arguments @('npm')),
    (Invoke-Capture -Name 'node version' -Executable 'node' -Arguments @('--version')),
    (Invoke-Capture -Name 'npm version' -Executable 'npm.cmd' -Arguments @('--version')),
    (Invoke-Capture -Name 'node child_process.spawnSync probe' -Executable 'node' -Arguments @($probePath)),
    (Invoke-Capture -Name 'PowerShell execution policy' -Executable 'powershell.exe' -Arguments @('-NoLogo', '-NoProfile', '-Command', 'Get-ExecutionPolicy -List | Out-String')),
    (Invoke-Capture -Name 'Windows Defender preferences' -Executable 'powershell.exe' -Arguments @('-NoLogo', '-NoProfile', '-Command', 'try { Get-MpPreference | Select-Object EnableControlledFolderAccess, ControlledFolderAccessAllowedApplications | Format-List | Out-String } catch { $_.Exception.Message }')),
    (Invoke-Capture -Name 'running node processes' -Executable 'powershell.exe' -Arguments @('-NoLogo', '-NoProfile', '-Command', 'Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,Path,StartTime | Format-Table -AutoSize | Out-String'))
)

Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue

$spawnProbe = $checks | Where-Object { $_.Name -eq 'node child_process.spawnSync probe' } | Select-Object -First 1
$spawnOk = $spawnProbe -and $spawnProbe.ExitCode -eq 0 -and $spawnProbe.Output -match 'child-spawn-ok'
$defenderCheck = $checks | Where-Object { $_.Name -eq 'Windows Defender preferences' } | Select-Object -First 1
$controlledFolderAccessMaybeOn = $defenderCheck.Output -match 'EnableControlledFolderAccess\s*:\s*1|EnableControlledFolderAccess\s*:\s*Enabled|EnableControlledFolderAccess\s*:\s*AuditMode'

$rows = $checks | ForEach-Object {
    "| $($_.Name) | $($_.ExitCode) |"
}

$details = $checks | ForEach-Object {
    @(
        "### $($_.Name)",
        '',
        "- Command: $($_.Command)",
        "- Exit code: $($_.ExitCode)",
        '',
        '```text',
        (Format-Block $_.Output),
        '```'
    ) -join [Environment]::NewLine
}

$recommendations = @()
if (-not $spawnOk) {
    $recommendations += 'Node cannot spawn a child Node process in this shell. This matches the `spawn EPERM` failure class.'
}
if ($repoOnDesktop) {
    $recommendations += 'The repo is under Desktop. If Windows Controlled Folder Access is enabled, Desktop protection can block build/browser child processes.'
}
if ($controlledFolderAccessMaybeOn) {
    $recommendations += 'Windows Defender Controlled Folder Access appears enabled or in audit mode. Add trusted apps from Windows Security rather than disabling protection globally.'
}
if ($nodePath) {
    $recommendations += "Allow this Node executable if Defender prompts: $nodePath."
}
if ($npmPath) {
    $recommendations += "If your security tool supports script hosts, also trust npm command path: $npmPath."
}
$recommendations += 'After allowing Node/terminal apps, rerun: `npm run build`, then `npm run test:show`.'
$recommendations += 'If the problem only happens inside Codex sandbox, rerun the same commands in a normal Windows Terminal in the repo.'

$report = @(
    '# Glow Logic spawn EPERM Diagnosis',
    '',
    "- Generated: $($generatedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Repo: $repoRoot",
    "- Repo under Desktop: $repoOnDesktop",
    "- Node path: $(if ($nodePath) { $nodePath } else { 'not found' })",
    "- npm path: $(if ($npmPath) { $npmPath } else { 'not found' })",
    "- npx path: $(if ($npxPath) { $npxPath } else { 'not found' })",
    "- Child spawn probe: $(if ($spawnOk) { 'PASS' } else { 'FAIL' })",
    '',
    '## Summary',
    '',
    '| Check | Exit |',
    '|---|---:|',
    ($rows -join [Environment]::NewLine),
    '',
    '## Recommendations',
    '',
    (($recommendations | ForEach-Object { "- $_" }) -join [Environment]::NewLine),
    '',
    '## Details',
    '',
    ($details -join ([Environment]::NewLine + [Environment]::NewLine))
) -join [Environment]::NewLine

Set-Content -Path $ReportPath -Value $report -Encoding UTF8

Write-Host ''
Write-Host '  GLOW LOGIC - spawn EPERM diagnosis' -ForegroundColor Cyan
Write-Host '  ==================================' -ForegroundColor DarkGray
Write-Host ''
Write-Host ("  Child spawn probe: {0}" -f $(if ($spawnOk) { 'PASS' } else { 'FAIL' })) -ForegroundColor $(if ($spawnOk) { 'Green' } else { 'Red' })
Write-Host ("  Repo under Desktop: {0}" -f $repoOnDesktop) -ForegroundColor $(if ($repoOnDesktop) { 'Yellow' } else { 'Green' })
Write-Host ("  Report: {0}" -f $ReportPath) -ForegroundColor Cyan
Write-Host ''

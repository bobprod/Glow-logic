# Generate-PwaIcons.ps1 — Génère les icônes PNG PWA depuis le code (System.Drawing)
# Crée : public/icons/icon-192x192.png, icon-512x512.png, icon-maskable-512x512.png

param([string]$WebPublicPath)

$ErrorActionPreference = 'Stop'

if (-not $WebPublicPath) {
    $repoRoot      = Split-Path -Parent $PSScriptRoot
    $WebPublicPath = Join-Path $repoRoot 'apps\web\public'
}

$iconsDir = Join-Path $WebPublicPath 'icons'
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

function New-GlowIcon {
    param([int]$Size, [string]$OutPath, [switch]$Maskable)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode        = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode    = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality   = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.PixelOffsetMode      = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # --- Fond #0a0c10 ---
    $bg = [System.Drawing.Color]::FromArgb(255, 10, 12, 16)
    $g.Clear($bg)

    $cx = $Size / 2.0
    $cy = $Size / 2.0

    # --- Halo dégradé extérieur (cercles concentriques violet→transparent) ---
    $haloR = [int]($Size * 0.42)
    $steps = 30
    for ($i = $steps; $i -ge 0; $i--) {
        $r     = [int]($haloR * $i / $steps)
        $alpha = [int](110 * $i / $steps)
        # Dégradé cyan (#22d3ee) → indigo (#6366f1)
        $blendR = [int](34  + (99  - 34)  * (1.0 - $i / $steps))
        $blendG = [int](211 + (102 - 211) * (1.0 - $i / $steps))
        $blendB = [int](238 + (241 - 238) * (1.0 - $i / $steps))
        $brush  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, $blendR, $blendG, $blendB))
        $g.FillEllipse($brush, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
        $brush.Dispose()
    }

    # --- Cercle principal indigo ---
    $mainR  = [int]($Size * 0.24)
    $brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 99, 102, 241))
    $g.FillEllipse($brush1, [float]($cx - $mainR), [float]($cy - $mainR), [float]($mainR * 2), [float]($mainR * 2))
    $brush1.Dispose()

    # --- Sur-brillance sur le cercle (highlight) ---
    $hlR    = [int]($mainR * 0.75)
    $brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 255, 255, 255))
    $g.FillEllipse($brush2, [float]($cx - $hlR), [float]($cy - $hlR * 1.4), [float]($hlR * 2), [float]($hlR * 2))
    $brush2.Dispose()

    # --- Anneau violet clair ---
    $ringR    = [int]($Size * 0.155)
    $penWidth = [float]([Math]::Max(1, $Size / 80.0))
    $pen1     = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 167, 139, 250), $penWidth)
    $g.DrawEllipse($pen1, [float]($cx - $ringR), [float]($cy - $ringR), [float]($ringR * 2), [float]($ringR * 2))
    $pen1.Dispose()

    # --- Point central lumineux ---
    $dotR   = [int]($Size * 0.082)
    $brush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 196, 181, 253))
    $g.FillEllipse($brush3, [float]($cx - $dotR), [float]($cy - $dotR), [float]($dotR * 2), [float]($dotR * 2))
    $brush3.Dispose()

    # --- Brillance centrale ---
    $glowR  = [int]($dotR * 0.55)
    $brush4 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 255, 255, 255))
    $g.FillEllipse($brush4, [float]($cx - $glowR), [float]($cy - $glowR * 1.3), [float]($glowR * 2), [float]($glowR * 2))
    $brush4.Dispose()

    $g.Dispose()

    # Encoder en PNG sans métadonnées superflues
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
               Where-Object { $_.MimeType -eq 'image/png' } |
               Select-Object -First 1
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, 100L)

    $bmp.Save($OutPath, $enc, $encParams)
    $bmp.Dispose()
}

# --- Génération ---
Write-Host '  Génération des icônes PWA...' -ForegroundColor DarkGray

$icon192  = Join-Path $iconsDir 'icon-192x192.png'
$icon512  = Join-Path $iconsDir 'icon-512x512.png'
$iconMask = Join-Path $iconsDir 'icon-512x512-maskable.png'

New-GlowIcon -Size 192 -OutPath $icon192
Write-Host '  [OK] icon-192x192.png' -ForegroundColor Green

New-GlowIcon -Size 512 -OutPath $icon512
Write-Host '  [OK] icon-512x512.png' -ForegroundColor Green

New-GlowIcon -Size 512 -OutPath $iconMask -Maskable
Write-Host '  [OK] icon-512x512-maskable.png' -ForegroundColor Green

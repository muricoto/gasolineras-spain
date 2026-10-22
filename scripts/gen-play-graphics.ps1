# Genera los gráficos de Google Play a partir del máster del logo:
#   play/icon-512.png          -> icono de la ficha (512x512, PNG 32 bits)
#   play/feature-1024x500.png  -> grafico destacado (1024x500, PNG)
# SOLO LEE assets/icon.png; no toca nada de los iconos de la app.
# Uso:  powershell -File scripts/gen-play-graphics.ps1
param(
  [string]$Source = "assets\icon.png",
  [string]$OutDir = "play"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { throw "No se encuentra el máster: $Source" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$src = New-Object System.Drawing.Bitmap((Resolve-Path $Source).Path)
$bg = $src.GetPixel(3, 3)   # marino del propio máster (fondo del recorte)

# --- 1. Bounding box del contenido real (pixels distintos del marino) ---
$minX = $src.Width; $maxX = 0; $minY = $src.Height; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y += 2) {
  for ($x = 0; $x -lt $src.Width; $x += 2) {
    $p = $src.GetPixel($x, $y)
    $d = [math]::Abs($p.R - $bg.R) + [math]::Abs($p.G - $bg.G) + [math]::Abs($p.B - $bg.B)
    if ($d -gt 45) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$pad = 8   # aire extra por el anti-aliasing
$minX = [math]::Max(0, $minX - $pad); $minY = [math]::Max(0, $minY - $pad)
$maxX = [math]::Min($src.Width - 1, $maxX + $pad); $maxY = [math]::Min($src.Height - 1, $maxY + $pad)
$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
"contenido del máster: ${cropW}x${cropH} en ($minX,$minY) · fondo RGB=($($bg.R),$($bg.G),$($bg.B))"

$hq = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# --- 2. Icono 512x512 (logo al 84% de alto, centrado) ---
$icon = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.SmoothingMode = "AntiAlias"; $g.InterpolationMode = $hq; $g.PixelOffsetMode = "HighQuality"
$g.Clear($bg)
$tgtH = [int](512 * 0.84)
$tgtW = [int]($tgtH * $cropW / $cropH)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle([int]((512 - $tgtW) / 2), [int]((512 - $tgtH) / 2), $tgtW, $tgtH)),
                  (New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)),
                  [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$iconPath = Join-Path $OutDir "icon-512.png"
$icon.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png); $icon.Dispose()
"icono: $iconPath (512x512, logo ${tgtW}x${tgtH})"

# --- 3. Feature 1024x500 (logo a la izquierda + textos de marca) ---
$feat = New-Object System.Drawing.Bitmap(1024, 500)
$g = [System.Drawing.Graphics]::FromImage($feat)
$g.SmoothingMode = "AntiAlias"; $g.InterpolationMode = $hq; $g.PixelOffsetMode = "HighQuality"
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$g.Clear($bg)

$logoH = 300
$logoW = [int]($logoH * $cropW / $cropH)
if ($logoW -gt 260) { $logoW = 260; $logoH = [int]($logoW * $cropH / $cropW) }
$logoX = 80
$logoY = [int]((500 - $logoH) / 2)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle($logoX, $logoY, $logoW, $logoH)),
                  (New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)),
                  [System.Drawing.GraphicsUnit]::Pixel)

$x0 = $logoX + $logoW + 56
$avail = 1024 - 60 - $x0   # margen derecho de 60px

# Reduce el cuerpo de la fuente hasta que la línea quepa en el ancho disponible
function Fit-Font([string]$t, [float]$start, [System.Drawing.FontStyle]$st, [float]$wMax, $gr) {
  $size = $start
  for ($i = 0; $i -lt 8; $i++) {
    $f = New-Object System.Drawing.Font("Segoe UI", $size, $st, [System.Drawing.GraphicsUnit]::Point)
    $w = $gr.MeasureString($t, $f).Width
    if ($w -le $wMax) { return $f }
    $f.Dispose()
    $size = [math]::Floor($size * $wMax / $w * 0.99)
    if ($size -lt 12) { $size = 12 }
  }
  return (New-Object System.Drawing.Font("Segoe UI", 12, $st, [System.Drawing.GraphicsUnit]::Point))
}

$t1 = "Litro Gasolina"
$t2 = "Encuentra la gasolinera más barata cerca de ti"
$t3 = "Precios oficiales de MITECO · Gratis y sin registros"
$fb = Fit-Font $t1 58 ([System.Drawing.FontStyle]::Bold) $avail $g
$fs = Fit-Font $t2 26 ([System.Drawing.FontStyle]::Regular) $avail $g
$fm = Fit-Font $t3 18 ([System.Drawing.FontStyle]::Regular) $avail $g
$white  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 247, 250))
$light  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(168, 183, 198))
$muted  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(122, 140, 158))

$h1 = $g.MeasureString($t1, $fb).Height
$h2 = $g.MeasureString($t2, $fs).Height
$h3 = $g.MeasureString($t3, $fm).Height
$block = $h1 + 14 + $h2 + 10 + $h3
$y = [int]((500 - $block) / 2)
$g.DrawString($t1, $fb, $white, $x0, $y);                 $y += [int]$h1 + 14
$g.DrawString($t2, $fs, $light, $x0, $y);                 $y += [int]$h2 + 10
$g.DrawString($t3, $fm, $muted, $x0, $y)

foreach ($f in @($fb, $fs, $fm)) { $f.Dispose() }
foreach ($b in @($white, $light, $muted)) { $b.Dispose() }
$g.Dispose()
$featPath = Join-Path $OutDir "feature-1024x500.png"
$feat.Save($featPath, [System.Drawing.Imaging.ImageFormat]::Png); $feat.Dispose()
"grafico: $featPath (1024x500)"

$src.Dispose()
"Listo. Máster NO modificado."

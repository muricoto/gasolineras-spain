Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root   = Split-Path $PSScriptRoot -Parent
$res    = Join-Path $root "android\app\src\main\res"
$master = New-Object System.Drawing.Bitmap((Join-Path $root "assets\icon.png"))
$bg     = [System.Drawing.Color]::FromArgb(255, 10, 28, 45)   # marino del propio logo

# ---- bbox del contenido (píxeles distintos del fondo marino) ----
$rect = New-Object System.Drawing.Rectangle(0, 0, $master.Width, $master.Height)
$bd   = $master.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($bd.Stride * $master.Height)
[System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bytes, 0, $bytes.Length)
$master.UnlockBits($bd)

$bgb = $bytes[0]; $bgg = $bytes[1]; $bgr = $bytes[2]
$minX = $master.Width; $maxX = 0; $minY = $master.Height; $maxY = 0
for ($y = 0; $y -lt $master.Height; $y += 2) {
  $row = $y * $bd.Stride
  for ($x = 0; $x -lt $master.Width; $x += 2) {
    $i = $row + $x * 4
    $d = [math]::Abs($bytes[$i] - $bgb) + [math]::Abs($bytes[$i+1] - $bgg) + [math]::Abs($bytes[$i+2] - $bgr)
    if ($d -gt 45) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$bx = $minX; $by = $minY; $cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
Write-Output "contenido: x=$bx y=$by ${cw}x${ch} (master $($master.Width)x$($master.Height))"

function New-Icon {
  param([int]$side, [double]$fill, [string]$out, [switch]$round, [switch]$transparent)
  $bmp = New-Object System.Drawing.Bitmap($side, $side, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  if ($transparent) { $g.Clear([System.Drawing.Color]::Transparent) } else { $g.Clear($bg) }
  $scale  = ($fill * $side) / [math]::Max($cw, $ch)
  $dw = $master.Width * $scale; $dh = $master.Height * $scale
  $dx = ($side / 2.0) - ($bx + $cw / 2.0) * $scale
  $dy = ($side / 2.0) - ($by + $ch / 2.0) * $scale
  $g.DrawImage($master, (New-Object System.Drawing.RectangleF($dx, $dy, $dw, $dh)))
  $g.Dispose()
  if ($round) {
    $rad = $side / 2.0
    for ($yy = 0; $yy -lt $side; $yy++) {
      for ($xx = 0; $xx -lt $side; $xx++) {
        $ddx = $xx - $rad + 0.5; $ddy = $yy - $rad + 0.5
        $dist = [math]::Sqrt($ddx * $ddx + $ddy * $ddy)
        if ($dist -gt $rad) { $bmp.SetPixel($xx, $yy, [System.Drawing.Color]::Transparent) }
        elseif ($dist -gt $rad - 1.5) {
          $p = $bmp.GetPixel($xx, $yy)
          $a = [int](255 * ($rad - $dist) / 1.5)
          $bmp.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb($a, $p.R, $p.G, $p.B))
        }
      }
    }
  }
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $fi = Get-Item $out
  Write-Output ("  {0,-52} {1,4}px  {2,6} KB" -f $fi.FullName.Substring($root.Length + 1), $side, [math]::Round($fi.Length / 1KB))
}

Write-Output "--- public/icon.png (web/pestaña) ---"
New-Icon -side 1024 -fill 0.92 -out (Join-Path $root "public\icon.png")

Write-Output "--- Android: legacy + round + adaptativo ---"
$dens = @{ 'mdpi' = @(48, 108); 'hdpi' = @(72, 162); 'xhdpi' = @(96, 216); 'xxhdpi' = @(144, 324); 'xxxhdpi' = @(192, 432) }
foreach ($d in ($dens.Keys | Sort-Object)) {
  $dir = Join-Path $res "mipmap-$d"
  $leg = $dens[$d][0]; $fg = $dens[$d][1]
  New-Icon -side $leg -fill 0.92 -out (Join-Path $dir "ic_launcher.png")
  New-Icon -side $leg -fill 0.85 -out (Join-Path $dir "ic_launcher_round.png") -round
  New-Icon -side $fg   -fill 0.66 -out (Join-Path $dir "ic_launcher_foreground.png")
}
$master.Dispose()
Write-Output "LISTO"

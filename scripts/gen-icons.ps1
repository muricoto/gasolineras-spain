Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

# Regenera el icono web y los de Android a partir del mÃ¡ster:
#   assets/icon.png  (Ãºnico fichero a editar al cambiar el logo)
# Salidas:
#   public/icon.png                      1024Â²  (web, cabecera, favicon, splash)
#   android/.../mipmap-*/ic_launcher.png          legacy + redondo, por densidad
#   android/.../mipmap-*/ic_launcher_foreground.png  adaptativo, por densidad
#
# El mÃ¡ster se ENCAJA (contain) tal cual en cada destino: los mÃ¡rgenes que
# tÃº metas en el PNG se respetan (son los que controlan el "zoom" del icono
# en el mÃ³vil). Lo que sobra de lienzo se rellena con el marino del fondo.

$root   = Split-Path $PSScriptRoot -Parent
$res    = Join-Path $root "android\app\src\main\res"
$master = New-Object System.Drawing.Bitmap((Join-Path $root "assets\icon.png"))
$bg     = [System.Drawing.Color]::FromArgb(255, 10, 28, 45)   # marino del propio logo
Write-Output ("masteer: {0}x{1}" -f $master.Width, $master.Height)

function New-Icon {
  param([int]$side, [string]$out, [switch]$round)
  $bmp = New-Object System.Drawing.Bitmap($side, $side, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear($bg)
  $scale = [math]::Min($side / [double]$master.Width, $side / [double]$master.Height)
  $dw = $master.Width * $scale
  $dh = $master.Height * $scale
  $dx = ($side - $dw) / 2.0
  $dy = ($side - $dh) / 2.0
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

Write-Output "--- public/icon.png (web/pestana) ---"
New-Icon -side 1024 -out (Join-Path $root "public\icon.png")

Write-Output "--- Android: legacy + round + adaptativo ---"
$dens = @{ 'mdpi' = @(48, 108); 'hdpi' = @(72, 162); 'xhdpi' = @(96, 216); 'xxhdpi' = @(144, 324); 'xxxhdpi' = @(192, 432) }
foreach ($d in ($dens.Keys | Sort-Object)) {
  $dir = Join-Path $res "mipmap-$d"
  $leg = $dens[$d][0]; $fg = $dens[$d][1]
  New-Icon -side $leg -out (Join-Path $dir "ic_launcher.png")
  New-Icon -side $leg -out (Join-Path $dir "ic_launcher_round.png") -round
  New-Icon -side $fg   -out (Join-Path $dir "ic_launcher_foreground.png")
}
$master.Dispose()
Write-Output "LISTO"

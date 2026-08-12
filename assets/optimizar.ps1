# ============================================================
#  OPTIMIZAR LAS ILUSTRACIONES DE LAS FICHAS
#
#  Los generadores devuelven imagenes enormes: la primera vino a 2752x1536 y
#  6,3 MB para un panel que mide 440x240. Esto las deja a lo que hace falta.
#
#  Uso: doble clic en optimizar.bat, o desde PowerShell:  .\optimizar.ps1
#
#  Coge cada f_*, h_*, l_* o a_* de esta carpeta (fichas, hitos, logros y
#  yacimientos), la reescala a 880 px de ancho,
#  la guarda como f_*.jpg ligera y mueve el original a originales\ SIN BORRARLO.
#  (Aprendido a base de perder uno: no se toca un original en su sitio.)
# ============================================================

Add-Type -AssemblyName System.Drawing

$carpeta   = Split-Path -Parent $MyInvocation.MyCommand.Path
$originales = Join-Path $carpeta 'originales'
$ANCHO     = 880
$CALIDAD   = 82L

if(-not (Test-Path $originales)){ New-Item -ItemType Directory $originales | Out-Null }

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }
$par = New-Object System.Drawing.Imaging.EncoderParameters(1)
$par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                  [System.Drawing.Imaging.Encoder]::Quality, $CALIDAD)

$hechas = 0
Get-ChildItem $carpeta -File | Where-Object {
    $_.Name -match '^(f|h|l|a)_.+\.(png|jpeg)$' -or $_.Name -match '^guia\.(png|jpeg)$'
} | ForEach-Object {
    $entrada = $_.FullName
    $nombre  = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $salida  = Join-Path $carpeta ($nombre + '.jpg')
    $antesKB = [Math]::Round($_.Length / 1KB)

    try {
        $img = [System.Drawing.Image]::FromFile($entrada)
        $alto = [int][Math]::Round($img.Height * ($ANCHO / $img.Width))
        $bmp  = New-Object System.Drawing.Bitmap($ANCHO, $alto)
        $g    = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $ANCHO, $alto)
        $g.Dispose()
        $anchoOrig = $img.Width; $altoOrig = $img.Height
        $img.Dispose()

        $bmp.Save($salida, $codec, $par)
        $bmp.Dispose()

        # el original se guarda, no se pierde
        Move-Item -Force $entrada (Join-Path $originales $_.Name)

        $despuesKB = [Math]::Round((Get-Item $salida).Length / 1KB)
        Write-Output "$($_.Name)  ${anchoOrig}x${altoOrig} $antesKB KB  ->  $nombre.jpg  ${ANCHO}x${alto} $despuesKB KB"
        $hechas++
    } catch {
        Write-Output "FALLO con $($_.Name): $($_.Exception.Message)"
    }
}

# ---- LA HOJA DEL GUIA: tres caras en fila que se parten solas ----
# Las tres expresiones se generan en UNA tirada (asi el personaje es el mismo)
# y aqui se recortan: cada tercio, cuadrado y centrado, a su archivo.
$hoja = Join-Path $carpeta 'guia_hoja.png'
if(Test-Path $hoja){
    try {
        $img = [System.Drawing.Image]::FromFile($hoja)
        $anchoCara = [Math]::Floor($img.Width / 3)
        $lado = [Math]::Min($anchoCara, $img.Height)
        $nombres = @('guia', 'guia_bien', 'guia_mal')
        for($i = 0; $i -lt 3; $i++){
            $bmp = New-Object System.Drawing.Bitmap(256, 256)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $origenX = $i * $anchoCara + [Math]::Floor(($anchoCara - $lado) / 2)
            $origenY = [Math]::Floor(($img.Height - $lado) / 2)
            $recorte = New-Object System.Drawing.Rectangle($origenX, $origenY, $lado, $lado)
            $destino = New-Object System.Drawing.Rectangle(0, 0, 256, 256)
            $g.DrawImage($img, $destino, $recorte, [System.Drawing.GraphicsUnit]::Pixel)
            $g.Dispose()
            $bmp.Save((Join-Path $carpeta ($nombres[$i] + '.jpg')), $codec, $par)
            $bmp.Dispose()
        }
        $img.Dispose()
        Move-Item -Force $hoja (Join-Path $originales 'guia_hoja.png')
        Write-Output "guia_hoja.png  ->  guia.jpg + guia_bien.jpg + guia_mal.jpg (256x256)"
        $hechas++
    } catch {
        Write-Output "FALLO con guia_hoja.png: $($_.Exception.Message)"
    }
}

if($hechas -eq 0){
    Write-Output ""
    Write-Output "No he encontrado nada que optimizar."
    Write-Output "Suelta aqui las imagenes y vuelve a ejecutarlo."
    Write-Output "  f_<pieza>.png   ficha de una instalacion"
    Write-Output "  h_<hito>.png    el problema que aparece"
    Write-Output "  l_<logro>.png   el problema resuelto"
    Write-Output "  a_<yacimiento>.png  lo que sale al picar"
    Write-Output "Piezas: captacion, bomba, deposito, acuifero, depuradora, tanque, vertedero, reciclaje"
} else {
    Write-Output ""
    Write-Output "$hechas lista(s). Los originales estan en originales\."
}

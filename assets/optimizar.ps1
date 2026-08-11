# ============================================================
#  OPTIMIZAR LAS ILUSTRACIONES DE LAS FICHAS
#
#  Los generadores devuelven imagenes enormes: la primera vino a 2752x1536 y
#  6,3 MB para un panel que mide 440x240. Esto las deja a lo que hace falta.
#
#  Uso: doble clic en optimizar.bat, o desde PowerShell:  .\optimizar.ps1
#
#  Coge cada f_*.png o f_*.jpeg de esta carpeta, la reescala a 880 px de ancho,
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
    $_.Name -match '^f_.+\.(png|jpeg)$'
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

if($hechas -eq 0){
    Write-Output ""
    Write-Output "No he encontrado nada que optimizar."
    Write-Output "Suelta aqui las imagenes con nombre f_<pieza>.png y vuelve a ejecutarlo."
    Write-Output "Piezas: captacion, bomba, deposito, acuifero, depuradora, tanque, vertedero, reciclaje"
} else {
    Write-Output ""
    Write-Output "$hechas lista(s). Los originales estan en originales\."
}

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
    $_.Name -match '^(f|h|l|a)_.+\.(png|jpeg)$' -or $_.Name -match '^(guia|mini_reciclaje)\.(png|jpeg)$'
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
# y aqui se recortan. NO se parte por tercios a ciegas: las figuras se
# solapan —el puño levantado del de en medio invade el tercio del vecino— y
# un corte a ciegas lo cercenaba. Se busca el hueco REAL entre figuras y se
# encuadra la CARA, que es lo unico que se ve en un circulo de 58 pixeles.
$hoja = Join-Path $carpeta 'guia_hoja.png'
if(Test-Path $hoja){
    try {
        $img = [System.Drawing.Image]::FromFile($hoja)
        $W = $img.Width; $H = $img.Height

        # El analisis va sobre una copia reducida: mil veces mas rapido y para
        # buscar huecos y cabezas sobra resolucion.
        $anchoMini = 344; $escala = $W / $anchoMini
        $altoMini = [int][Math]::Round($H / $escala)
        $mini = New-Object System.Drawing.Bitmap($anchoMini, $altoMini)
        $gm = [System.Drawing.Graphics]::FromImage($mini)
        $gm.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gm.DrawImage($img, 0, 0, $anchoMini, $altoMini); $gm.Dispose()

        # Fondo = color de la esquina; figura = lo que se aleje de el
        $cf = $mini.GetPixel(2, 2)
        $UMBRAL = 60
        $fig = New-Object 'bool[,]' $anchoMini,$altoMini
        $prof = New-Object 'int[]' $anchoMini
        for($x = 0; $x -lt $anchoMini; $x++){
            for($y = 0; $y -lt $altoMini; $y++){
                $p = $mini.GetPixel($x, $y)
                $d = [Math]::Sqrt([Math]::Pow($p.R-$cf.R,2) + [Math]::Pow($p.G-$cf.G,2) + [Math]::Pow($p.B-$cf.B,2))
                if($d -gt $UMBRAL){ $fig[$x,$y] = $true; $prof[$x]++ }
            }
        }
        $mini.Dispose()

        # Los dos cortes: la columna MAS VACIA cerca de cada tercio
        $cortes = @()
        foreach($frac in @(0.3333, 0.6667)){
            $centro = [int]($anchoMini * $frac); $margen = [int]($anchoMini * 0.09)
            $mejor = $centro; $min = [int]::MaxValue
            for($x = $centro - $margen; $x -le $centro + $margen; $x++){
                if($x -lt 1 -or $x -ge $anchoMini - 1){ continue }
                if($prof[$x] -lt $min){ $min = $prof[$x]; $mejor = $x }
            }
            $cortes += $mejor
        }
        $tramosX0 = @(0, $cortes[0], $cortes[1])
        $tramosX1 = @($cortes[0], $cortes[1], ($anchoMini - 1))
        $nombres = @('guia', 'guia_bien', 'guia_mal')

        for($i = 0; $i -lt 3; $i++){
            $x0 = $tramosX0[$i]; $x1 = $tramosX1[$i]
            $y0 = $altoMini; $y1 = 0
            for($x = $x0; $x -le $x1; $x++){
                for($y = 0; $y -lt $altoMini; $y++){
                    if($fig[$x,$y]){ if($y -lt $y0){ $y0 = $y }; if($y -gt $y1){ $y1 = $y } }
                }
            }
            $altoFig = $y1 - $y0
            $bandaFin = $y0 + [int]($altoFig * 0.6)

            # Ancho de cada fila de la mitad alta: el casco es ancho, el brazo no
            $anchoFila = @{}; $maxAncho = 0
            for($y = $y0; $y -le $bandaFin; $y++){
                $a = -1; $b = -1
                for($x = $x0; $x -le $x1; $x++){ if($fig[$x,$y]){ if($a -lt 0){ $a = $x }; $b = $x } }
                if($a -ge 0){ $anchoFila[$y] = $b - $a; if(($b-$a) -gt $maxAncho){ $maxAncho = $b - $a } }
            }
            # La cabeza empieza donde la silueta se ensancha (el casco)
            $cabezaY = $y0
            for($y = $y0; $y -le $bandaFin; $y++){
                if($anchoFila.ContainsKey($y) -and $anchoFila[$y] -ge ($maxAncho * 0.42)){ $cabezaY = $y; break }
            }
            # El eje: centro del TRAMO SEGUIDO mas largo de la banda de la
            # cabeza. De borde a borde, el brazo en alto desviaba la cara.
            $bandaCab = [Math]::Min($cabezaY + [int]($altoFig * 0.35), $altoMini - 1)
            $cx = ($x0 + $x1) / 2; $mejorRacha = 0
            for($y = $cabezaY; $y -le $bandaCab; $y++){
                $rIni = -1
                for($x = $x0; $x -le $x1; $x++){
                    $hay = $fig[$x,$y]
                    if($hay -and $rIni -lt 0){ $rIni = $x }
                    if((-not $hay -or $x -eq $x1) -and $rIni -ge 0){
                        $rFin = if($hay){ $x } else { $x - 1 }
                        if(($rFin - $rIni) -gt $mejorRacha){ $mejorRacha = $rFin - $rIni; $cx = ($rIni + $rFin) / 2 }
                        $rIni = -1
                    }
                }
            }

            $lado = [int]($altoFig * 0.60)
            $L = [int]($lado * $escala)
            $X = [int]($cx * $escala) - [int]($L / 2)
            $Y = [int](($cabezaY - [int]($lado * 0.10)) * $escala)
            if($X -lt 0){ $X = 0 }; if($Y -lt 0){ $Y = 0 }
            if($X + $L -gt $W){ $X = $W - $L }; if($Y + $L -gt $H){ $Y = $H - $L }

            $bmp = New-Object System.Drawing.Bitmap(256, 256)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $recorte = New-Object System.Drawing.Rectangle($X, $Y, $L, $L)
            $destino = New-Object System.Drawing.Rectangle(0, 0, 256, 256)
            $g.DrawImage($img, $destino, $recorte, [System.Drawing.GraphicsUnit]::Pixel)
            $g.Dispose()
            $bmp.Save((Join-Path $carpeta ($nombres[$i] + '.jpg')), $codec, $par)
            $bmp.Dispose()
        }
        $img.Dispose()
        Move-Item -Force $hoja (Join-Path $originales 'guia_hoja.png')
        Write-Output "guia_hoja.png  ->  guia.jpg + guia_bien.jpg + guia_mal.jpg (256x256, encuadradas por la cara)"
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

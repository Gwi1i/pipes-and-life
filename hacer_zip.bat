@echo off
REM Empaqueta el juego para subirlo a itch.io (o a cualquier sitio que sirva
REM HTML). Deja "pipes-and-life.zip" en el escritorio.
REM
REM Se queda FUERA lo que no hace falta para jugar: el .git, los originales de
REM las ilustraciones (pesan decenas de megas), la documentacion y los .bat.
REM itch tiene limite de tamano, y ademas nadie quiere descargar el repo entero
REM para jugar en el navegador.

setlocal
set ORIGEN=%~dp0
set DESTINO=%USERPROFILE%\Desktop\pipes-and-life.zip
set TEMPORAL=%TEMP%\pipes-and-life-zip

echo.
echo   Empaquetando Pipes and Life...
echo.

if exist "%TEMPORAL%" rmdir /s /q "%TEMPORAL%"
mkdir "%TEMPORAL%"

robocopy "%ORIGEN%." "%TEMPORAL%" index.html manifest.json /njh /njs /ndl /nc /ns >nul
robocopy "%ORIGEN%src" "%TEMPORAL%\src" /e /njh /njs /ndl /nc /ns >nul
robocopy "%ORIGEN%css" "%TEMPORAL%\css" /e /njh /njs /ndl /nc /ns >nul
REM De assets solo va lo que el juego PIDE. Fuera las herramientas, y fuera
REM tambien el material de referencia que quedo suelto ahi (esquemas, fondos
REM viejos, capturas de otros juegos): son 27 MB que nadie descarga para jugar.
robocopy "%ORIGEN%assets" "%TEMPORAL%\assets" /e /xd originales /xf PROMPTS.md optimizar.ps1 optimizar.bat recortar_hojas.py Esquema.png fondo1.png fondo2.png "Captura de pantalla.png" "Post Apo Tycoon*.webp" /njh /njs /ndl /nc /ns >nul

if exist "%DESTINO%" del "%DESTINO%"
REM Se empaqueta con tar y NO con Compress-Archive: el de PowerShell escribe
REM las rutas con barra invertida ("assets\musica.mp3"), que va contra el
REM formato zip, y hay descompresores -entre ellos el de itch- que entonces
REM dejan todo en un solo archivo con el nombre lleno de barras. tar.exe viene
REM de serie en Windows 10 y 11.
REM Con la ruta completa a proposito: si tienes Git instalado, su tar aparece
REM antes en el PATH y ese NO entiende las rutas de Windows (toma la "C:" por
REM un servidor remoto y aborta). El de System32 es el que sirve.
"%SystemRoot%\System32\tar.exe" -a -c -f "%DESTINO%" -C "%TEMPORAL%" index.html manifest.json src css assets

rmdir /s /q "%TEMPORAL%"

echo.
echo   Listo: %DESTINO%
echo.
echo   Subelo a itch.io y marca la casilla
echo   "This file will be played in the browser".
echo.
pause

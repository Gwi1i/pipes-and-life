@echo off
rem ============================================================
rem  RED HIDRAULICA - doble clic para jugar
rem
rem  No se puede abrir index.html directamente: el juego usa
rem  modulos ES y los navegadores los bloquean sobre file://.
rem  Esto levanta el servidor local y abre el navegador solo.
rem
rem  Sin acentos a proposito: la consola de Windows los rompe.
rem ============================================================

chcp 65001 >nul 2>nul
cd /d "%~dp0"
title Red Hidraulica

set "PY="
where py >nul 2>nul
if %errorlevel%==0 set "PY=py"
where python >nul 2>nul
if %errorlevel%==0 if not defined PY set "PY=python"

if not defined PY goto :sinpython

"%PY%" servidor.py
goto :fin

:sinpython
echo.
echo   No encuentro Python en este equipo, y hace falta para
echo   levantar el servidor del juego.
echo.
echo   Instalalo desde https://www.python.org/downloads/
echo   (marca la casilla "Add Python to PATH") y vuelve a
echo   hacer doble clic aqui.
echo.
pause
exit /b 1

:fin

@echo off
rem ============================================================
rem  Doble clic aqui despues de soltar las imagenes generadas.
rem  Las deja al tamano y peso que necesita el juego, y guarda
rem  los originales en la subcarpeta originales\.
rem ============================================================
chcp 65001 >nul 2>nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0optimizar.ps1"
echo.
pause

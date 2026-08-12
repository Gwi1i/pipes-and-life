@echo off
rem ============================================================
rem  Crea (o repara) el acceso directo "Pipes and Life" con su
rem  icono, apuntando a jugar.bat de ESTA carpeta.
rem
rem  Existe porque un .bat no puede llevar icono propio: Windows
rem  le pinta siempre la rueda dentada. El acceso directo si
rem  puede, y es lo que se ancla al escritorio o a inicio.
rem
rem  Si mueves la carpeta del juego, doble clic aqui y arreglado.
rem ============================================================

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$lnk = $ws.CreateShortcut('%~dp0Pipes and Life.lnk'); " ^
  "$lnk.TargetPath = '%~dp0jugar.bat'; " ^
  "$lnk.WorkingDirectory = '%~dp0'; " ^
  "$lnk.IconLocation = '%~dp0assets\icono.ico,0'; " ^
  "$lnk.Description = 'Pipes and Life - Abastece a tu mancomunidad'; " ^
  "$lnk.Save()"

echo.
echo   Listo: "Pipes and Life" con su icono, en esta carpeta.
echo   Puedes copiarlo al escritorio o anclarlo donde quieras.
echo.
pause

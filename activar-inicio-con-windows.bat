@echo off
title Instalar StreamOverlay en Inicio de Windows
color 0B
echo ========================================================
echo   Configurar StreamOverlay para iniciar siempre con Windows
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_TARGET=%SCRIPT_DIR%iniciar-oculto.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_VBS=%TEMP%\CreateShortcut.vbs

echo Creando acceso directo en la carpeta de Inicio de Windows...
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SHORTCUT_VBS%"
echo sLinkFile = "%STARTUP_DIR%\StreamOverlay.lnk" >> "%SHORTCUT_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SHORTCUT_VBS%"
echo oLink.TargetPath = "wscript.exe" >> "%SHORTCUT_VBS%"
echo oLink.Arguments = """%VBS_TARGET%""" >> "%SHORTCUT_VBS%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%SHORTCUT_VBS%"
echo oLink.Description = "StreamOverlay Kick y TikTok en segundo plano" >> "%SHORTCUT_VBS%"
echo oLink.Save >> "%SHORTCUT_VBS%"

cscript //nologo "%SHORTCUT_VBS%"
del "%SHORTCUT_VBS%"

echo.
echo ========================================================
echo  [LISTO] StreamOverlay ahora se iniciara automaticamente
echo  en segundo plano cada vez que prendas o reinicies tu PC.
echo  Sin ventanas negras, sin tener que abrir nada.
echo ========================================================
echo.
pause

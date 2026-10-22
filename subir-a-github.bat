@echo off
title Sincronizar con GitHub y AWS
color 0A
echo ========================================================
echo        SUBIR CAMBIOS A GITHUB (Y ACTUALIZAR AWS)
echo ========================================================
echo.

cd /d "%~dp0"

echo Guardando cambios locales...
git add .

set /p MSG="Mensaje del cambio (presiona Enter para 'actualizacion de overlay'): "
if "%MSG%"=="" set MSG=actualizacion de overlay

git commit -m "%MSG%"
echo.
echo Subiendo a GitHub...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   [EXITO] Cambios subidos correctamente a GitHub!
    echo.
    echo   Para actualizar tu servidor de AWS EC2:
    echo   En tu ventana de PuTTY solo escribe:
    echo     cd ~/stream-overlay ^&^& git pull ^&^& pm2 restart stream-overlay
    echo ========================================================
) else (
    echo.
    echo [ERROR] No se pudo subir a GitHub. Revisa tu conexion a Internet o credenciales.
)

echo.
pause

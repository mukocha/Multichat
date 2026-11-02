@echo off
title Sincronizar con GitHub
color 0A
echo ========================================================
echo              SUBIR CAMBIOS A GITHUB
echo ========================================================
echo.

cd /d "%~dp0"

echo Guardando cambios locales...
git add .

set /p MSG="Mensaje del cambio (presiona Enter para 'actualizacion de multichat'): "
if "%MSG%"=="" set MSG=actualizacion de multichat

git commit -m "%MSG%"
echo.
echo Subiendo a GitHub...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   [EXITO] Cambios subidos correctamente a GitHub!
    echo ========================================================
) else (
    echo.
    echo [ERROR] No se pudo subir a GitHub. Revisa tu conexion a Internet o credenciales.
)

echo.
pause

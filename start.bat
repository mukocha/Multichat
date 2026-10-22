@echo off
title MultiChat OBS Studio
color 0A

echo ========================================================
echo   Iniciando MultiChat para OBS Studio
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Instalando dependencias iniciales, por favor espera...
    call npm install
)

echo.
echo ========================================================
echo   Servidor iniciado en:
echo   - Dock OBS:     http://localhost:3000/dock.html
echo   - Alertas OBS:  http://localhost:3000/alerts.html
echo   - Chat OBS:     http://localhost:3000/chat.html
echo ========================================================
echo.

start "" "http://localhost:3000/dock.html"
node server.js

pause

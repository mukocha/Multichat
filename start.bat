@echo off
title MultiChat OBS Studio
color 0A

echo ========================================================
echo   Iniciando MultiChat para OBS Studio (Modo Portable)
echo ========================================================
echo.

cd /d "%~dp0"

set "NODE_CMD="

REM 1. Comprobar si existe el ejecutable portable de Node en la carpeta bin\
if exist "%~dp0bin\node.exe" (
    set "NODE_CMD=%~dp0bin\node.exe"
    echo [OK] Usando Node.js Portable (bin\node.exe)
)

REM 2. Si no hay bin\node.exe, verificar si el sistema tiene Node.js en PATH
if "%NODE_CMD%"=="" (
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        set "NODE_CMD=node"
        echo [OK] Usando Node.js instalado en el sistema
    )
)

REM 3. Si es una PC totalmente limpia sin Node.js instalado ni bin\, descargarlo automaticamente
if "%NODE_CMD%"=="" (
    echo.
    echo ========================================================
    echo  Node.js no se detecto en esta computadora.
    echo  Descargando version portable oficial de Node.js...
    echo  (Solo se descarga la primera vez, unos segundos)
    echo ========================================================
    echo.
    if not exist "%~dp0bin" mkdir "%~dp0bin"
    where curl.exe >nul 2>nul
    if %errorlevel% equ 0 (
        curl.exe -L -o "%~dp0bin\node.exe" "https://nodejs.org/dist/v22.23.4/win-x64/node.exe"
    ) else (
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v22.23.4/win-x64/node.exe', '%~dp0bin\node.exe')"
    )
    if exist "%~dp0bin\node.exe" (
        set "NODE_CMD=%~dp0bin\node.exe"
        echo [OK] Node.js portable listo en bin\node.exe
    ) else (
        echo [ERROR] No se pudo descargar automaticamente.
        echo Por favor revisa tu conexion a Internet.
        pause
        exit /b 1
    )
)

echo.
echo ========================================================
echo   Servidor iniciado exitosamente:
echo   - Dock OBS:     http://localhost:3000/dock.html
echo   - Alertas OBS:  http://localhost:3000/alerts.html
echo   - Chat OBS:     http://localhost:3000/chat.html
echo ========================================================
echo.

REM Abrir automaticamente el panel Dock en el navegador
start "" "http://localhost:3000/dock.html"

REM Iniciar el servidor
"%NODE_CMD%" server.js

pause

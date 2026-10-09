@echo off
title BioTailr AI - StandBy Web Command Center
echo ====================================================
echo   BioTailr AI - Web Command Center Launcher
echo ====================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not detected on your system.
    echo Please install Node.js 18 or later from https://nodejs.org/
    pause
    exit /b 1
)

echo Starting Web Control Center server on http://localhost:4000...
echo You can run LinkedIn Apply, YC Apply, and Chrome Debug with buttons!
echo.

start "" "http://localhost:4000"

node dashboard-server.js

pause

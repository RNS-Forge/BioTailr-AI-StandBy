@echo off
title BioTailr AI - Standalone Auto-Apply Runner
echo ====================================================
echo    BioTailr AI - Standalone Auto-Apply Runner
echo ====================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not detected on your system.
    echo Please install Node.js 18 or later from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Starting Auto-Apply Automation Runner...
echo Target: Chrome CDP on 127.0.0.1:9222
echo.
node apply-runner.js

echo.
echo Process complete.
pause

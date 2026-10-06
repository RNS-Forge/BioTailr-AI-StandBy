@echo off
title BioTailr AI - Launch Chrome in Debugging Mode
echo ====================================================
echo  BioTailr AI - Launching Chrome in Debugging Mode
echo ====================================================
echo.

set CHROME_BIN=""
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set CHROME_BIN="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set CHROME_BIN="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set CHROME_BIN="%LocalAppData%\Google\Chrome\Application\chrome.exe"

if %CHROME_BIN%=="" (
    echo [ERROR] Google Chrome was not found in standard directories.
    echo Please launch Chrome manually from the terminal with:
    echo chrome.exe --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.biotailr-chrome-profile"
    pause
    exit /b 1
)

set EXTENSION_DIR="C:\Temp Files\My Projects\BioTailr.ai\BioTailr-AI-Extension"

echo Found Chrome: %CHROME_BIN%
echo BioTailr Extension Path: %EXTENSION_DIR%
echo Opening Chrome on port 9222 with BioTailr Extension automatically loaded...
echo.
echo NOTE: Keep this Chrome window open, log into LinkedIn, and navigate to your jobs search page.
echo The BioTailr StandBy HUD will automatically appear on your LinkedIn screen.
echo Then run "start-runner.bat".
echo.

start "" %CHROME_BIN% --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.biotailr-chrome-profile" --load-extension=%EXTENSION_DIR% --window-size=1400,900 "https://www.linkedin.com/jobs/"


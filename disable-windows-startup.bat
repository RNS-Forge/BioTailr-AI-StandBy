@echo off
title BioTailr StandBy - Disable Windows Startup
echo ====================================================
echo    BioTailr StandBy - Disable Windows Startup
echo ====================================================
echo.
echo Removing BioTailr StandBy from Windows Startup...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$StartupFolder = [System.Environment]::GetFolderPath('Startup'); " ^
  "$ShortcutPath = Join-Path $StartupFolder 'BioTailr-StandBy.lnk'; " ^
  "if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force; Write-Host '[SUCCESS] BioTailr StandBy removed from Windows Startup.' -ForegroundColor Green; } else { Write-Host '[INFO] BioTailr StandBy was not found in the Startup folder.' -ForegroundColor Yellow; }"

echo.
echo Configuration updated.
echo.
pause

@echo off
title BioTailr StandBy - Enable Windows Startup
echo ====================================================
echo    BioTailr StandBy - Enable Windows Startup
echo ====================================================
echo.
echo Configuring BioTailr StandBy to launch automatically on Windows login...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$StartupFolder = [System.Environment]::GetFolderPath('Startup'); " ^
  "$ShortcutPath = Join-Path $StartupFolder 'BioTailr-StandBy.lnk'; " ^
  "$ScriptDir = (Get-Item -Path $PSScriptRoot).FullName; " ^
  "$TargetPath = Join-Path $ScriptDir 'start-runner.bat'; " ^
  "$Shortcut = $WshShell.CreateShortcut($ShortcutPath); " ^
  "$Shortcut.TargetPath = $TargetPath; " ^
  "$Shortcut.WorkingDirectory = $ScriptDir; " ^
  "$Shortcut.Description = 'BioTailr StandBy Autonomous Auto-Apply Runner'; " ^
  "$Shortcut.Save(); " ^
  "Write-Host '[SUCCESS] BioTailr StandBy has been added to your Windows Startup folder.' -ForegroundColor Green; " ^
  "Write-Host ('Startup Shortcut: ' + $ShortcutPath) -ForegroundColor Gray;"

echo.
echo Configuration complete.
echo BioTailr StandBy will now automatically start whenever you log into Windows.
echo.
pause

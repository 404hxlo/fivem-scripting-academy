@echo off
cd /d "%~dp0"
if exist "release\win-unpacked\FiveM Scripting Academy.exe" (
  start "" "release\win-unpacked\FiveM Scripting Academy.exe"
) else (
  call npm start
)

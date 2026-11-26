@echo off
cd /d "%~dp0"
if exist "release\win-unpacked\Brick by Script Learn.exe" (
  start "" "release\win-unpacked\Brick by Script Learn.exe"
) else (
  call npm start
)

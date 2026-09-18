@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node.ps1"
if errorlevel 1 (
  echo.
  echo IDUN: Automated Node.js 24 initialization failed.
  echo Please install Node.js 24 manually from https://nodejs.org
  echo.
  pause
  exit /b 1
)

node scripts\start-local.cjs --open
if errorlevel 1 pause

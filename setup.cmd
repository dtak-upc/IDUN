@echo off
setlocal
cd /d "%~dp0"

echo =========================================================
echo   IDUN: Automatic Environment & Dependency Setup
echo =========================================================

echo [1/3] Checking / Installing Node.js 24...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node.ps1"
if errorlevel 1 (
  echo.
  echo IDUN: Automated Node.js 24 setup failed.
  echo Please install Node.js 24 from https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo [2/3] Installing NPM web dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo IDUN: NPM install failed.
  echo.
  pause
  exit /b 1
)

echo.
echo [3/3] Setting up Python virtual environment and uv...
node scripts\start-local.cjs --setup-only
if errorlevel 1 (
  echo.
  echo IDUN: Python environment setup failed.
  echo.
  pause
  exit /b 1
)

echo.
echo =========================================================
echo   Setup successfully completed!
echo   Double-click "Start IDUN.cmd" to launch the workspace.
echo =========================================================
echo.
pause

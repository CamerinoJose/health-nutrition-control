@echo off
setlocal

echo.
echo 🌐 Starting ngrok tunnels (web + api)

REM Ensure ngrok is installed
where ngrok >nul 2>nul
if errorlevel 1 (
  echo.
  echo ❌ ngrok not found in PATH.
  echo    Install it and run: ngrok config add-authtoken YOUR_TOKEN
  echo.
  exit /b 1
)

REM Ensure local config exists
if not exist "%~dp0ngrok.yml" (
  echo.
  echo ❌ Missing ngrok.yml
  echo    Copy ngrok.yml.example to ngrok.yml:
  echo    copy ngrok.yml.example ngrok.yml
  echo.
  exit /b 1
)

echo ✅ Using config: %~dp0ngrok.yml
echo    Web tunnel should forward to :5173
echo    API tunnel should forward to :8080
echo.
echo Tip: see active URLs at http://127.0.0.1:4040
echo.

ngrok start --all --config "%~dp0ngrok.yml"

@echo off
:: Double-click to stop the Todo Countdown server running in the background.
setlocal
cd /d "%~dp0"

node scripts\launcher.js stop
if errorlevel 1 (
    echo.
    pause
    exit /b 1
)
"%SystemRoot%\System32\timeout.exe" /t 3 >nul

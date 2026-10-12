@echo off
:: Double-click to open Todo Countdown.
:: Starts the server in the background if it is not running yet, then opens the browser.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed.
    echo Opening https://nodejs.org/ - please install it and run this file again.
    start "" https://nodejs.org/
    pause
    exit /b 1
)

node scripts\launcher.js start --open
if errorlevel 1 (
    echo.
    pause
    exit /b 1
)
"%SystemRoot%\System32\timeout.exe" /t 3 >nul

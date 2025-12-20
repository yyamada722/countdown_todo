@echo off
title Todo Countdown

echo =====================================
echo   Todo Countdown
echo =====================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo.
    echo Install Node.js? [Y/N]
    set /p INSTALL_NODE=
    if /i "%INSTALL_NODE%"=="Y" (
        echo Opening Node.js download page...
        start https://nodejs.org/
        echo.
        echo Please re-run this script after installing Node.js.
        pause
        exit /b 1
    ) else (
        echo Cannot run without Node.js. Exiting.
        pause
        exit /b 1
    )
)

:: Display Node.js version
echo Node.js version:
node --version
echo.

:: Start server in new window
echo Starting server...
start "Todo Server" cmd /k "cd /d %~dp0 && node server.js"

:: Wait for server to start
echo Waiting for server...
timeout /t 3 /nobreak >nul

:: Open browser
echo Opening browser...
start http://localhost:8080

echo.
echo =====================================
echo   Started!
echo =====================================
echo.
echo App: http://localhost:8080
echo.
echo To stop: Press Ctrl+C in the server window
echo.
pause

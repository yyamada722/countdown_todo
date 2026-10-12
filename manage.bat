@echo off
:: Todo Countdown server menu: status, restart, LAN mode, autostart, logs, backups.
setlocal
cd /d "%~dp0"
title Todo Countdown - Manage

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed. Get it from https://nodejs.org/
    pause
    exit /b 1
)

:menu
cls
echo =====================================
echo   Todo Countdown
echo =====================================
node scripts\launcher.js status
echo.
echo   [1] Start / open app
echo   [2] Stop
echo   [3] Restart (this PC only)
echo   [4] Restart with LAN access (phone, other PCs)
echo   [5] Autostart at login: ON
echo   [6] Autostart at login: OFF
echo   [7] Show recent server log
echo   [8] Open backups folder
echo   [0] Exit
echo.
choice /c 123456780 /n /m "Select: "
goto option%errorlevel%

:option1
node scripts\launcher.js start --open
goto done
:option2
node scripts\launcher.js stop
goto done
:option3
node scripts\launcher.js restart --local
goto done
:option4
echo.
echo NOTE: In LAN mode anyone on the same network can view and edit your tasks.
choice /c YN /m "Continue"
if errorlevel 2 goto menu
node scripts\launcher.js restart --lan
goto done
:option5
node scripts\launcher.js autostart on
goto done
:option6
node scripts\launcher.js autostart off
goto done
:option7
node scripts\launcher.js logs
goto done
:option8
if not exist "data\backups" mkdir "data\backups"
start "" explorer "data\backups"
goto menu
:option0
:option9
exit /b 0

:done
echo.
pause
goto menu

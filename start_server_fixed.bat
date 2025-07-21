@echo off
chcp 65001 >nul
title Todo Countdown Server

echo ====================================
echo Starting Todo Countdown App
echo ====================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Display Node.js version
echo Node.js version:
node --version
echo.

:: Set port number (default: 3030)
set PORT=3030

:: Check if port is already in use
netstat -an | findstr :%PORT% >nul
if %errorlevel% equ 0 (
    echo WARNING: Port %PORT% is already in use.
    echo Use a different port? (Y/N)
    set /p CHANGE_PORT=
    if /i "%CHANGE_PORT%"=="Y" (
        set /p PORT=Enter new port number: 
    )
)

echo.
echo Starting server...
echo Port: %PORT%
echo.

:: Start server
node server.js

:: If error occurred
if %errorlevel% neq 0 (
    echo.
    echo An error occurred.
    echo.
    pause
)
@echo off
title Todo カウントダウン サーバー

echo ====================================
echo Todo カウントダウンアプリを起動します
echo ====================================
echo.

:: Node.jsがインストールされているかチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo エラー: Node.js がインストールされていません。
    echo Node.js を https://nodejs.org/ からダウンロードしてインストールしてください。
    echo.
    pause
    exit /b 1
)

:: Node.jsのバージョンを表示
echo Node.js バージョン:
node --version
echo.

:: ポート番号を設定（デフォルト: 3030）
set PORT=3030

:: 既に使用中のポートをチェック
netstat -an | findstr :%PORT% >nul
if %errorlevel% equ 0 (
    echo 警告: ポート %PORT% は既に使用中です。
    echo 別のポートを使用しますか？ (Y/N)
    set /p CHANGE_PORT=
    if /i "%CHANGE_PORT%"=="Y" (
        set /p PORT=新しいポート番号を入力してください: 
    )
)

echo.
echo サーバーを起動しています...
echo ポート: %PORT%
echo.

:: サーバーを起動
node server.js

:: エラーが発生した場合
if %errorlevel% neq 0 (
    echo.
    echo エラーが発生しました。
    echo.
    pause
)
@echo off
chcp 65001 >nul
title Todo カウントダウン

echo =====================================
echo   Todo カウントダウン
echo =====================================
echo.

:: Node.jsがインストールされているかチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo エラー: Node.js がインストールされていません。
    echo.
    echo Node.js をインストールしますか？ [Y/N]
    set /p INSTALL_NODE=
    if /i "%INSTALL_NODE%"=="Y" (
        echo ブラウザで Node.js のダウンロードページを開きます...
        start https://nodejs.org/
        echo.
        echo Node.js をインストール後、このスクリプトを再実行してください。
        pause
        exit /b 1
    ) else (
        echo Node.js がないと実行できません。終了します。
        pause
        exit /b 1
    )
)

:: Node.jsのバージョンを表示
echo Node.js バージョン:
node --version
echo.

:: サーバーを起動（新しいウィンドウで）
echo サーバーを起動しています...
start "Todo Server" cmd /k "cd /d %~dp0 && node server.js"

:: 少し待つ
echo サーバーの起動を待っています...
timeout /t 3 /nobreak >nul

:: ブラウザで開く
echo ブラウザでアプリケーションを開いています...
start http://localhost:8080

echo.
echo =====================================
echo   起動完了！
echo =====================================
echo.
echo アプリ: http://localhost:8080
echo.
echo 終了するには:
echo   サーバーウィンドウで Ctrl+C を押してください
echo.
pause

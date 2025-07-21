@echo off
title Todo カウントダウン - セットアップ & 起動

echo =====================================
echo Todo カウントダウン
echo セットアップ & 起動スクリプト
echo =====================================
echo.

:: 管理者権限チェック
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo このスクリプトを管理者として実行することを推奨します。
    echo.
)

:: Node.jsがインストールされているかチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo エラー: Node.js がインストールされていません。
    echo.
    echo Node.js をインストールしますか？ (Y/N)
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

:: npmがインストールされているかチェック
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo エラー: npm がインストールされていません。
    echo Node.js を再インストールしてください。
    pause
    exit /b 1
)

:: ポート番号を設定
set PORT=3030

:: サーバーを起動（新しいウィンドウで）
echo サーバーを起動しています...
start "Todo Server" cmd /k "node server.js"

:: 少し待つ
echo サーバーの起動を待っています...
timeout /t 3 /nobreak >nul

:: ブラウザで開く
echo.
echo ブラウザでアプリケーションを開いています...
start http://localhost:%PORT%

echo.
echo =====================================
echo セットアップ完了！
echo =====================================
echo.
echo サーバー: http://localhost:%PORT%
echo.
echo 終了するには:
echo 1. サーバーウィンドウで Ctrl+C を押す
echo 2. このウィンドウを閉じる
echo.
pause
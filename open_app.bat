@echo off
title Todo カウントダウン

echo ====================================
echo Todo カウントダウンアプリを開きます
echo ====================================
echo.

:: デフォルトのポート番号
set PORT=3030

:: ポート番号を入力させる
echo デフォルトポート: %PORT%
echo 別のポートを使用する場合は入力してください（そのままの場合はEnter）:
set /p USER_PORT=
if not "%USER_PORT%"=="" set PORT=%USER_PORT%

:: URLを設定
set URL=http://localhost:%PORT%

echo.
echo ブラウザで %URL% を開いています...

:: デフォルトブラウザで開く
start "" "%URL%"

echo.
echo ブラウザが開かない場合は、手動で以下のURLにアクセスしてください:
echo %URL%
echo.
echo ウィンドウを閉じるには何かキーを押してください...
pause >nul
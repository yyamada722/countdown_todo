# Countdown Todo

A task management application with countdown timers for each task.

タスクごとにカウントダウンタイマーを設定できるTodoアプリケーションです。

## Features / 機能

- ✅ Create, edit, and delete tasks / タスクの作成・編集・削除
- ⏰ Set deadlines with countdown timers / 各タスクに期限を設定してカウントダウン表示
- 📅 Calendar-based date selection / カレンダー形式での日付選択
- 💾 Local storage persistence / ローカルストレージでのデータ永続化
- 🌙 Dark theme UI / ダークテーマUI
- 📱 PWA support / PWA対応

## サーバーの起動方法

### 方法1: Node.js を使用（推奨）

```bash
# Node.jsがインストールされている場合
node server.js

# または npm を使用
npm start

# ポートを指定する場合（例：3000番ポート）
PORT=3000 node server.js
```

### 方法2: Python を使用

```bash
# Python 3 の場合
python3 -m http.server 8080

# Python 2 の場合
python -m SimpleHTTPServer 8080
```

### 方法3: その他の簡易サーバー

```bash
# PHP の場合
php -S 0.0.0.0:8080

# Ruby の場合
ruby -run -e httpd . -p 8080

# http-server (npm) の場合
npx http-server -p 8080
```

## アクセス方法

サーバー起動後、以下のURLでアクセスできます：

1. **ローカルアクセス**: `http://localhost:8080`
2. **LAN内アクセス**: `http://<サーバーのIPアドレス>:8080`
3. **VPN経由アクセス**: `http://<VPNで割り当てられたIPアドレス>:8080`

## VPN経由でのアクセス設定

1. VPNサーバーに接続
2. サーバーマシンでアプリケーションサーバーを起動
3. VPN内のIPアドレスを確認：
   ```bash
   # Windows
   ipconfig

   # Mac/Linux
   ifconfig
   ```
4. VPNクライアントから `http://<VPN内のIPアドレス>:8080` でアクセス

## ファイアウォール設定

外部からアクセスする場合は、ファイアウォールで8080番ポートを開放する必要があります：

### Windows
```powershell
# 管理者権限で実行
netsh advfirewall firewall add rule name="Todo App" dir=in action=allow protocol=TCP localport=8080
```

### Linux (Ubuntu/Debian)
```bash
sudo ufw allow 8080/tcp
```

### Mac
システム環境設定 → セキュリティとプライバシー → ファイアウォール → ファイアウォールオプション

## セキュリティ上の注意 / Security Notes

- このアプリケーションは開発用途を想定しています / This application is intended for development use
- インターネットに直接公開する場合は、適切なセキュリティ対策を実施してください / Implement appropriate security measures if exposing to the internet
- VPN経由でのアクセスを推奨します / VPN access is recommended

## Installation / インストール

### Windows
1. Download and extract the ZIP file / ZIPファイルをダウンロードして展開
2. Run `install_and_run.bat` / `install_and_run.bat`を実行

### macOS/Linux
1. Clone the repository / リポジトリをクローン
   ```bash
   git clone https://github.com/[your-username]/countdown-todo.git
   cd countdown-todo
   ```
2. Start the server / サーバーを起動
   ```bash
   node server.js
   ```

## Requirements / 必要環境

- Node.js 12.0.0 or higher (recommended) / Node.js 12.0.0以上（推奨）
- Or Python 3.x / または Python 3.x
- Modern web browser / モダンなWebブラウザ

## License

MIT License

## Font License / フォントライセンス

This application uses "Nosutaru-dotMPlusH-10-Regular" font.
このアプリケーションでは「ノスタルドット（M+H）」フォントを使用しています。

- Font Name / フォント名: ノスタルドット（M+H）
- Designer / デザイナー: 永山嘉昭（フロップデザイン）
- License Page / ライセンスページ: https://logotype.jp/nosutaru-dot.html
- License / ライセンス: M+ FONT LICENSE

The font is redistributable under the M+ FONT LICENSE.
このフォントはM+ FONT LICENSEに基づいて再配布可能です。
# Countdown Todo

<img width="1056" height="470" alt="image" src="https://github.com/user-attachments/assets/92449456-08b2-437e-b5a4-25246b04c7e6" />

タスクごとにカウントダウンタイマーを設定できるTodoアプリケーションです。

A task management application with countdown timers for each task.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D12.0.0-green.svg)

## 機能 / Features

### コア機能
- **タスク管理** - タスクの作成・編集・削除・完了
- **カウントダウン表示** - 各タスクに期限を設定してリアルタイムでカウントダウン表示
- **カレンダー形式の日付選択** - 直感的なUIで期限を設定
- **データ永続化** - サーバーサイドでJSONデータベースに保存

### タスク機能
- **通常タスク** - 特定の期限を設定
- **今から始めるタスク** - 作業時間を指定（5分〜3時間）
- **繰り返し設定** - 毎日/毎週/隔週/毎月/平日のみ
- **事前通知** - 10分前〜1日前に通知
- **メモ機能** - タスクにメモを追加
- **複数タスク一括登録** - 同じ設定で複数タスクを一度に作成

### 表示・フィルター
- **フィルタータブ** - アクティブ/今日/明日/完了済み/統計/週間/スケジュール
- **ステータス表示** - SCHEDULED/ON TIME/SOON/URGENT/OVERDUE
- **週間ビュー** - 1週間のタスクを俯瞰
- **統計機能** - タスク完了状況の統計表示

### スケジュール機能
- **プリセット** - よく使うタスクセットを保存
- **スケジュール** - 定期的なタスクをテンプレート化
- **一括作成** - スケジュールから今日/明日のタスクを生成

### 天気予報
- **天気表示** - 時計横に午前/午後の天気をドット絵アイコンで表示
- **位置情報** - 手動入力またはGPSで位置を設定
- **プリセット都市** - 東京/大阪/名古屋/札幌/福岡

### その他
- **PWA対応** - ホーム画面に追加してアプリとして利用可能
- **ダークテーマ** - 目に優しいダークモードUI
- **レスポンシブ** - PC/タブレット/スマートフォン対応
- **通知機能** - ブラウザ通知でタスクをリマインド

## スクリーンショット

```
┌─────────────────────────────────────┐
│           14:32:45                  │
│     2025/12/20 (土) ☀️ ☁️ 12°/5°    │
├─────────────────────────────────────┤
│ [アクティブ][今日][明日][完了][統計] │
├─────────────────────────────────────┤
│ ● 買い物に行く           00:45:30  │
│ ● レポート提出           02:15:00  │
│ ● ミーティング           05:30:00  │
└─────────────────────────────────────┘
```

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

## API エンドポイント

サーバーは以下のREST APIを提供します：

### Todos

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/todos` | 全タスクを取得 |
| POST | `/api/todos` | 新規タスク作成 |
| PUT | `/api/todos/:id` | タスク更新 |
| DELETE | `/api/todos/:id` | タスク削除（アーカイブ） |
| POST | `/api/todos/sync` | 全タスク同期 |

### Presets

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/presets` | プリセット一覧取得 |
| POST | `/api/presets` | プリセット作成 |
| PUT | `/api/presets/:id` | プリセット更新 |
| DELETE | `/api/presets/:id` | プリセット削除 |
| POST | `/api/presets/:id/apply` | プリセット適用 |

### Schedules

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/schedules` | スケジュール一覧取得 |
| POST | `/api/schedules` | スケジュール作成 |
| PUT | `/api/schedules/:id` | スケジュール更新 |
| DELETE | `/api/schedules/:id` | スケジュール削除 |
| POST | `/api/schedules/batch-create` | 一括タスク作成 |

### Stats

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/stats` | ユーザー統計取得 |
| POST | `/api/stats/complete` | 完了統計更新 |

## VPN経由でのアクセス設定

### Tailscaleを使用した設定（推奨）

Tailscaleは設定が簡単で安全なメッシュVPNサービスです。

1. **Tailscaleのインストール**
   - 公式サイトからダウンロード: https://tailscale.com/download
   - Windows/Mac/Linux対応

2. **サーバー側の設定**
   ```bash
   # Tailscaleを起動してログイン
   tailscale up

   # Tailscaleの割り当てIPアドレスを確認
   tailscale ip -4
   ```

3. **クライアント側の設定**
   - Tailscaleをインストールして同じアカウントでログイン
   - 自動的にサーバーとVPN接続が確立されます

4. **アクセス方法**
   ```
   http://<TailscaleのIPアドレス>:8080
   ```

5. **Tailscaleの利点**
   - ファイアウォール設定不要
   - 自動的にNATトラバーサル
   - エンドツーエンド暗号化
   - 設定が非常に簡単

### その他のVPN（従来型）

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

## プロジェクト構造

```
countdown_todo/
├── index.html          # メインHTML
├── script.js           # フロントエンドロジック
├── style.css           # スタイルシート
├── server.js           # Node.jsサーバー
├── package.json        # npm設定
├── manifest.json       # PWAマニフェスト
├── service-worker.js   # Service Worker
├── data/
│   └── todos.json      # データベース（自動生成）
├── fonts/
│   └── Nosutaru-dotMPlusH-10-Regular.ttf
├── icon-192.png        # PWAアイコン
└── icon-512.png        # PWAアイコン
```

## インストール / Installation

### Windows
1. ZIPファイルをダウンロードして展開
2. `install_and_run.bat` を実行

### macOS/Linux
```bash
# リポジトリをクローン
git clone https://github.com/yyamada722/countdown_todo.git
cd countdown_todo

# サーバーを起動
node server.js
```

## 必要環境 / Requirements

- Node.js 12.0.0 以上（推奨）
- または Python 3.x
- モダンなWebブラウザ（Chrome, Firefox, Safari, Edge）

## セキュリティ上の注意 / Security Notes

- このアプリケーションは開発・個人利用を想定しています
- インターネットに直接公開する場合は、適切なセキュリティ対策を実施してください
- VPN経由でのアクセスを推奨します

## ライセンス / License

MIT License

### フォントライセンス / Font License

このアプリケーションでは「ノスタルドット（M+H）」フォントを使用しています。

- **フォント名**: ノスタルドット（M+H）
- **デザイナー**: 永山嘉昭（フロップデザイン）
- **ライセンス**: M+ FONT LICENSE
- **ライセンスページ**: https://logotype.jp/nosutaru-dot.html

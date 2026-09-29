# Release v1.1.0

## What's New / 新機能

### 天気予報表示
- 時計の横に今日の天気予報を表示
- 午前/午後の天気をドット絵アイコンで表示
- 最高/最低気温を表示
- 位置情報の手動設定またはGPS取得に対応
- プリセット都市（東京/大阪/名古屋/札幌/福岡）

### タスク管理の改善
- スケジュール機能 - 定期的なタスクをテンプレート化
- プリセット機能 - よく使うタスクセットを保存
- 週間ビュー - 1週間のタスクを俯瞰表示
- 統計機能 - タスク完了状況の統計表示

### アニメーション改善
- 期限切れタスクのアニメーションを滑らかに改善
- カウントダウン表示のミリ秒表示を修正
- requestAnimationFrameによる高精度な更新

## Improvements / 改善

- APIエンドポイントのID処理を統一（parseFloat）
- バッチファイルを整理（install_and_run.batに統合）
- ポート番号を8080に統一
- READMEを現在の機能に合わせて更新

## How to Use / 使い方

### Windows
1. ZIPファイルを展開
2. `install_and_run.bat` をダブルクリック
3. ブラウザが自動的に開きます

### macOS / Linux
```bash
# 展開
unzip countdown-todo-release.zip
cd countdown-todo-release

# サーバー起動
node server.js

# ブラウザで開く
open http://localhost:8080
```

## Requirements / 必要環境

- Node.js 12.0.0 以上
- モダンブラウザ（Chrome, Firefox, Safari, Edge）

## Download

- `countdown-todo-release.zip` - Windows/Mac/Linux用

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

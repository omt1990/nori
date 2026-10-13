# NORI — セッションの入口

Tokyo On Foot の企画のひとつ。チームで電車に乗り、トランプの数だけ移動して駅ビンゴを埋める遊び。
**東京メトロラン（`projects/tokyo-metro-run`）とは別のアプリ。**既存のコードは流用しない。

## 最初に読む

| ファイル | 中身 |
|---|---|
| `docs/design-v1.md` | 設計の正本（決定事項・記録の持ち方・画面・時間別の設定・ルール） |
| `~/ai-projects/audits/2026-10-13-tokyo-metro-run/AUDIT.md` | 旧アプリの検収。同じ失敗をしないための参照 |

## 現在地（2026-10-13）

- 設計 v1.1 が決まった（オーナー承認済み）。実装は未着手
- `.git` はまだ無い。作ったら `~/ai-projects/.gitignore` に `projects/nori/` を足し、`REGISTRY.md` に1行足す
- 世界観は Tokyo On Foot（藍 #1F3352・生成り #F1ECE2・金茶 #B08A4A／Zen Kaku Gothic New＋Inter／菱形の記号）。
  見本：`~/ai-projects/personal/knowledge/2026-10-12_tokyo-on-foot-precedents/` と Tokyo On Foot ページ

## インフラ情報

- Vercelアカウント: omata.yusuke1990@gmail.com / team slug `omt1990`（push で自動デプロイ。CLI 直デプロイ禁止）
- Firebase: 新プロジェクト `nori` を omata.yusuke1990@gmail.com で作る（Realtime Database＋匿名認証）。tokyo-metro-run は使わない
- Supabase: 不要
- GitHubリポジトリ: omt1990/nori（PUBLIC 想定。個人情報・鍵を置かない）
- 本番URL: 未定（nori.vercel.app 想定）
- ステータス: DESIGN
- 区分: 個人

## 実装するときの約束

- 状態は**出来事の追記**だけで持つ（`docs/design-v1.md` §2）。全体を上書きする `set` を書かない
- 運営という役割を作らない。承認・割り当て・手動終了の画面を作らない
- 写真を保存しない。名前以外の個人情報を持たない
- 外部ライブラリは版を固定する
- 新しい知見は `~/ai-projects/roles/_lessons.md` へ

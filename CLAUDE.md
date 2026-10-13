# NORI — セッションの入口

Tokyo On Foot の企画のひとつ。チームで電車に乗り、トランプの数だけ移動して駅ビンゴを埋める遊び。
**東京メトロラン（`projects/tokyo-metro-run`）とは別のアプリ。**既存のコードは流用しない。

## 最初に読む

| ファイル | 中身 |
|---|---|
| `docs/design-v1.md` | 設計の正本（決定事項・記録の持ち方・画面・時間別の設定・ルール） |
| `docs/screens-v1.md` | 画面仕様（design スキルの型名で書いた4画面） |
| `docs/setup-owner.md` | Firebase 作成・Vercel 接続のオーナー手順（1画面） |
| `~/ai-projects/audits/2026-10-13-tokyo-metro-run/AUDIT.md` | 旧アプリの検収。同じ失敗をしないための参照 |

## 現在地（2026-10-13）

- **実装完了・エミュレータで動作確認済み・本番未接続。**設計 §7 の 1〜5 を実施：
  1. 駅データ：N02-24 → 都内 647 駅・73 路線（`src/data/stations.json`、`scripts/extract-stations.py`）
  2. 状態計算：`src/state.js`（純関数）＋ `test/` 19 件（`npm test`）
  3. ルール：`database.rules.json` ＋ エミュレータでのルールテスト 11 件（`npm run test:rules`・Java 必要）
  4. 画面4つ：`src/ui/`。Tokyo On Foot の世界観
  5. 同時操作・圏外復帰：エミュレータで確認（同時到着6件・goOffline→到着→goOnline で記録が残る）。**実機2台は未実施**
- GitHub omt1990/nori に push 済み。**残り＝オーナーの操作3つ**（`docs/setup-owner.md`）：
  Firebase プロジェクト作成 → `src/firebase.config.js` に値を入れて push → Vercel で Import
- お題の中身は**暫定**（`src/data/missions.js` 20 件）。作り直しは別の回（設計 §5）。id は変えない
- JR は N02 の正式名でなく運転系統名で選べるようにした（山手線 30 駅・京浜東北線・埼京線を合成、東北線・東海道線・赤羽線は隠す）。
  合成の駅名リストは `scripts/extract-stations.py` の `JR_SERVICE_LINES`

## 開発

```
npm install
npm test                       # 純関数の単体テスト
npm run test:rules             # RTDB ルール（firebase emulators:exec・Java が要る：export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"）
npm run emulators              # database + auth エミュレータ
npm run dev:emu                # エミュレータに繋いだ開発サーバー（VITE_EMULATOR=1）
```

- 駅データを作り直す：N02-24 と N03（東京都）の GeoJSON を国土数値情報から取り、`python3 -I scripts/extract-stations.py <N02 Station.geojson> <N03 13.geojson> src/data/stations.json`
- 開発中はブラウザの `window.__nori.goOffline()` / `goOnline()` で圏外と復帰を再現できる（本番ビルドには入らない）

## インフラ情報

- Vercelアカウント: omata.yusuke1990@gmail.com / team slug `omt1990`（push で自動デプロイ。CLI 直デプロイ禁止）
- Firebase: プロジェクト `nori`（omata.yusuke1990@gmail.com・Realtime Database＋匿名認証）。**作成待ち**。tokyo-metro-run は使わない
- Supabase: 不要
- GitHubリポジトリ: omt1990/nori（PUBLIC。`src/firebase.config.js` の値は公開してよいもの。守りは `database.rules.json`）
- 本番URL: 未定（Vercel 接続後に決まる）
- ステータス: IN DEV（本番未接続）
- 区分: 個人

## 実装するときの約束

- 状態は**出来事の追記**だけで持つ（`docs/design-v1.md` §2）。全体を上書きする `set` を書かない（書くのは `push` と、存在しなければ通る `set`、多経路 `update` だけ）
- 運営という役割を作らない。承認・割り当て・手動終了の画面を作らない
- 写真を保存しない。名前以外の個人情報を持たない
- 外部ライブラリは版を固定する（`package.json` は exact 指定）
- 画面上の文字は 数値・ラベル・操作 の3種だけ（design スキル 第3章 大原則2）
- 新しい知見は `~/ai-projects/roles/_lessons.md` へ

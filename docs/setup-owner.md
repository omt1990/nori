# NORI を動かすまで（Firebase と Vercel の接続手順）

2026-10-19 に実施済み。作り直すときの記録。どれも omata.yusuke1990@gmail.com でログインした状態で行う。

## 1. Firebase プロジェクトを作る（5分）

1. https://console.firebase.google.com を開く → 「プロジェクトを追加」
2. 名前：`nori`。Google アナリティクスは **オフ** → 作成
3. 左メニュー「セキュリティ」→「Authentication」→「始める」→ ログイン方法で **「匿名」を有効**。「自動クリーンアップ」もオン（30日で匿名アカウントを消す。部屋の寿命と同じ）→ 保存
4. 左メニュー「Database と Storage」→「Realtime Database」→「データベースを作成」
   - 場所：**asia-southeast1（シンガポール）**（東京はまだ選べない。一番近い）
   - セキュリティルール：**ロックモード** で開始（あとで差し替える）
5. 同じ画面の「ルール」タブ → 中身を全部消して、リポジトリの `database.rules.json` の中身を貼る → 「公開」
6. 左上の歯車「プロジェクトの設定」→ 下の「マイアプリ」→ **</>（ウェブ）** を押す
   - アプリのニックネーム：`nori`。Hosting は **チェックしない** → 登録
   - 表示される `firebaseConfig = { ... }` の中身（apiKey / authDomain / databaseURL / projectId / appId）を
     **そのままこのセッションに貼る**（公開してよい値。守りはルール側）

## 2. GitHub（0分）

リポジトリ omt1990/nori は作成・push 済み。操作は不要。

## 3. Vercel に接続する（5分）

1. https://vercel.com/new を開く（右上が omt1990 であることを確認）
2. 「Import Git Repository」で **omt1990/nori** を選ぶ
3. Framework Preset：**Vite**（自動で出る）。他はそのまま → **Deploy**
4. 出てきた URL を `CLAUDE.md` の「本番URL」に書く（2026-10-19：https://nori-olive-eta.vercel.app）

以後は GitHub に push するたび自動で更新される。CLI からのデプロイはしない。

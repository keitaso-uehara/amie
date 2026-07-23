# amie（アミ）— 静的プロトタイプ

女性向け総合スキルシェア（メイク・美容・ファッション・暮らし）の静的プロトタイプ。
「憧れの人に、1対1で相談できる」＝インフルエンサー・モデル・芸能人の「次に稼げる箱」。
要件定義書は別リポジトリ `beauty-mentor-spec` を参照。

HTML / CSS / vanilla JS のみ。ビルド不要・fetch/ESモジュール不使用（`file://` でも動く）。

## 起動

```sh
node .claude/static-server.js
# → http://localhost:8788
```

`index.html` をブラウザで直接開いても動きます。状態のリセットは任意のページに `?reset=1`。

## 主な画面（仕様書の画面IDに対応）

```
index.html                 S1  TOP
search/index.html          S2  検索・一覧（?cat= / ?concern= / ?format= / ?q= / ?tab=creators）
creators/show.html?id=     S3  出品者詳細（サービスの顔・SNSフォロワー数）
plans/show.html?id=        S4  プラン詳細（下部購入バー）
checkout/index.html?plan=  S5  購入・決済（エスクロー/予約枠/同意）
messages/index.html        S6  メッセージ（?order= で会話ルーム）
me/index.html              S10 マイページ（購入者）
dashboard/index.html       S11 出品者ダッシュボード（デモ）
login/index.html           S13 ログイン / 新規登録
notifications/index.html   S14 通知
about/guide/help/terms/privacy/tokusho.html  S16 静的ページ群
```

## 構成

```
assets/css/tokens.css      デザイントークン ← ブランド調整はここだけ
assets/css/{base,components,pages}.css
assets/js/data/*.js        モックデータ（window.DB / window.TAX）
assets/js/store.js         window.api = API差し替え境界（Supabase移行時はここ）
assets/js/app.js           共通初期化（window.App）
assets/js/components.js    共通コンポーネント描画（window.UI）
assets/js/pages/*.js       各画面（クエリ読取→api→描画 の3層）
```

## 回遊シナリオ（検証用）

1. TOP → 注目の出品者（SNSフォロワー順）→ 出品者詳細
2. プラン詳細 → 購入する（未ログインならログイン）→ 予約枠選択 → 同意 → 支払う
3. 完了画面 → メッセージを開く → チャット送信
4. マイページに取引が反映／プロフィール編集
5. 出品者ダッシュボードで売上・手数料・宣伝リンクを確認

## バックエンド（Supabase）

`supabase/` に本番設計一式（テーブル/RLS/関数・トリガ/シード/Edge Functions）があります。詳細は [supabase/README.md](supabase/README.md)。

- スキーマ: `supabase/migrations/0001_schema.sql`（データモデル）
- 業務ロジック: `0002_functions.sql`（手数料20%/価格ルール/無応答自動返金/レビュー制約/集計ビュー）
- 認可: `0003_rls.sql`（購入者/出品者/運営の分離）
- SaaS連携: `supabase/functions/*`（Stripeエスクロー・Daily.coビデオ・cron）
- フロント接続: `assets/js/config.js` で `backend: "supabase"` に切替、`assets/js/store.supabase.js` が `window.api` を実装（既定は `mock`）

## Next.js 移行メモ

- ルートはディレクトリ構成に対応：`creators/show.html?id=x` → `/creators/[id]`
- `store.js` を Supabase クライアント＋Stripe/Daily に差し替えれば、ページ側は原則無変更
- `components.js` の描画関数 ≒ React コンポーネントの雛形

# amie — バックエンド（Supabase）

仕様書 v1.0（第11章）の推奨スタックに沿った本番設計。**PostgreSQL + Auth + Storage + Realtime（Supabase）** を中核に、決済は **Stripe（Connectでエスクロー的運用）**、ビデオは **Daily.co**、本人確認は **Stripe Identity** を組み合わせる。

> フロントの静的プロトタイプ（`/` 配下）は既定で「モックモード」（localStorage）で動きます。本ディレクトリはそれを差し替える**実バックエンドの設計一式**です。

## 構成

```
supabase/
  migrations/
    0001_schema.sql     テーブル・列挙型・インデックス（データモデル）
    0002_functions.sql  業務ロジック（手数料20%/価格ルール/無応答返金/レビュー制約/集計ビュー）
    0003_rls.sql        行レベルセキュリティ（購入者/出品者/運営の分離）
  seed.sql              デモデータ（プロトと同じ出品者・プラン・レビュー）
  functions/            Edge Functions（Deno）
    create-order/       購入→Stripe与信(manual capture=エスクロー)＋注文作成
    complete-order/     取引完了→キャプチャ＋Connect送金(手数料20%控除)
    stripe-webhook/     Stripeイベント→注文状態更新（与信確定/月額更新/返金）
    create-daily-room/  ビデオ予約→Daily.coルーム作成（録画無効）
    auto-refund/        cron: 出品者無応答48hの取引を自動返金（6章）
    sns-sync/           cron: SNSフォロワー数を週次更新（5.2）
  config.toml           プロジェクト設定（Auth/Storage/Functions）
  .env.example          必要な環境変数
```

## データモデルの要点（仕様書との対応）

| テーブル | 対応する仕様 |
|---|---|
| `profiles` | 購入者/出品者は同一アカウント（5.3）。`birthdate` で18歳未満制限（6章） |
| `creators` / `sns_accounts` | オープン出品＋SNSフォロワー数表示（3.1 / 5.2(1)）。`verified`=eKYC、`price_cap`=価格上限（4.5） |
| `plans` | 3形式・最低1,000円（4章）。上限は `price_cap` をトリガ検証 |
| `orders` / `order_events` | エスクロー取引と状態遷移（4.4 / 別紙0.2）。`fee`/`net` は20%トリガ算出 |
| `messages` | 取引スレッド・画像・既読・NG検知フラグ（S6 / 6章） |
| `reviews` | 完了後1回・編集不可（S9。`order_id` unique ＋ RLSでupdate不可） |
| `payouts` | 出金＋eKYC必須（8.3 / 6章） |
| `reports` / `ng_words` | 通報・NGワード（A2 / 6章） |
| `promo_links` | 宣伝リンクの流入計測（5.2(2)。手数料優遇なし） |

業務ルールは **DB側（トリガ/制約）** に寄せてあるため、アプリやEdge Functionが取りこぼしても最終的にDBが担保する（手数料計算・価格ルール・年齢制限・レビュー要件）。

## セットアップ手順

### 1. Supabase プロジェクト
```bash
# CLI 導入（未導入なら）
npm i -g supabase
supabase login

# ローカルで起動して検証（Docker 必須）
supabase start
supabase db reset        # migrations + seed.sql を適用（デモデータ入り）
```
クラウドに反映する場合:
```bash
supabase link --project-ref <your-project-ref>
supabase db push         # migrations を本番へ
```

### 2. 環境変数
`.env.example` を `.env` にコピーし、Supabase / Stripe / Daily / Resend のキーを設定。
Edge Function のシークレットは:
```bash
supabase secrets set --env-file supabase/.env
```

### 3. Edge Functions デプロイ
```bash
supabase functions deploy create-order complete-order stripe-webhook create-daily-room auto-refund sns-sync
```
Stripe 側で Webhook エンドポイントに `.../functions/v1/stripe-webhook` を登録し、`STRIPE_WEBHOOK_SECRET` を設定。

### 4. 定期実行（cron）
`pg_cron` + `pg_net` で Edge Function を叩く:
```sql
select cron.schedule('auto-refund', '*/30 * * * *',
  $$ select net.http_post(url := '<project>/functions/v1/auto-refund',
     headers := jsonb_build_object('Authorization','Bearer <service-role>')) $$);
select cron.schedule('sns-sync', '0 3 * * 1', $$ ... /functions/v1/sns-sync ... $$);  -- 毎週月曜3時
```

### 5. 認証プロバイダ
Google / Apple は `config.toml` ＋ 各プロバイダのクライアントID/シークレットで有効化。
LINE は Supabase 標準に無いため、OIDC カスタムプロバイダ設定 or 独自 Edge Function で対応。

## フロントとの接続

`/assets/js/config.js` で `backend: "supabase"` に切り替え、`SUPABASE_URL` / `SUPABASE_ANON_KEY` を設定すると、
`/assets/js/store.supabase.js`（`window.api` の Supabase 実装）が使われる。既定は `mock`（localStorage）。

## 注意

Stripe・Daily.co・各SNS APIは提供状況・料金・**日本での本人確認/送金の要件**が変わり得るため、実装着手時に最新条件を必ず再確認すること（仕様書 11.2 の注記）。エスクロー/収納代行構成は資金決済法まわりの**法務レビューが必須**（仕様書 7章）。

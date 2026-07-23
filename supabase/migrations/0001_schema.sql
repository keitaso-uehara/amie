-- =========================================================
-- amie — スキーマ定義（0001）
-- 仕様書 v1.0 のデータモデルに対応。PostgreSQL / Supabase 前提。
-- 認証は Supabase Auth（auth.users）。profiles がその1:1拡張。
-- 金額はすべて「円・整数」。手数料は 8.2 の一律20%。
-- =========================================================

-- ---------- 列挙型 ----------
create type creator_type as enum ('celebrity', 'influencer', 'pro', 'general');
create type plan_format  as enum ('chat', 'video', 'monthly');
create type plan_status  as enum ('draft', 'published', 'hidden');
create type order_status as enum ('pending', 'progress', 'active', 'completed', 'canceled', 'refunded');
create type payout_status as enum ('requested', 'approved', 'rejected', 'paid');
create type report_status as enum ('open', 'investigating', 'resolved');
create type sns_provider as enum ('instagram', 'tiktok', 'youtube', 'x');
create type msg_sender   as enum ('buyer', 'seller', 'system');

-- ---------- profiles（購入者/出品者 共通アカウント。仕様書 5.3「同一アカウント」）----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ゲスト',
  avatar_url  text,
  bio         text default '',
  birthdate   date,                       -- 18歳未満の決済制限（6章）に使用
  concerns    text[] default '{}',        -- 悩みタグ slug
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- creators（出品者プロフィール。誰でも出品可・オープン型）----------
create table creators (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references profiles(id) on delete cascade,
  handle      text not null unique,
  type        creator_type not null default 'general',
  tagline     text default '',
  bio         text default '',
  verified    boolean not null default false,     -- eKYC済（認証バッジ・4.5/6章）
  price_cap   integer not null default 100000,    -- 価格上限（新規10万円→解除で引上げ・4.5）
  stripe_account text,                             -- Stripe Connect アカウントID（出金先・8.3）
  categories  text[] default '{}',
  concerns    text[] default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- sns_accounts（SNS連携フォロワー数。差別化の核・5.2(1)。週次同期）----------
create table sns_accounts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creators(id) on delete cascade,
  provider      sns_provider not null,
  handle        text not null,
  follower_count integer not null default 0,
  verified      boolean not null default false,
  synced_at     timestamptz not null default now(),
  unique (creator_id, provider)
);

-- ---------- plans（出品単位。3形式・価格ルール 4.5）----------
create table plans (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creators(id) on delete cascade,
  title         text not null,
  format        plan_format not null,
  price         integer not null check (price >= 1000),   -- 最低1,000円（上限は creators.price_cap でトリガ検証）
  category      text not null,
  concerns      text[] default '{}',
  description   text not null default '',
  chat_days     integer,        -- chat: 3/7/14
  minutes       integer,        -- video: 30/60/90
  monthly_videos integer,       -- monthly: 月のビデオ回数
  chat_included boolean default true,
  status        plan_status not null default 'published',  -- 即公開→事後パトロール（6章）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index plans_creator_idx on plans(creator_id);
create index plans_category_idx on plans(category);
create index plans_status_idx on plans(status);

-- ---------- promo_links（宣伝リンク。SNS流入計測・5.2(2)。手数料優遇なし）----------
create table promo_links (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references creators(id) on delete cascade,
  code        text not null unique,
  clicks      integer not null default 0,
  conversions integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- orders（取引。前払いエスクロー・4.4）----------
create table orders (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id),
  buyer_id      uuid not null references profiles(id),
  creator_id    uuid not null references creators(id),
  format        plan_format not null,
  price         integer not null,
  fee           integer not null default 0,   -- 手数料（20%）。トリガで算出
  net           integer not null default 0,   -- 出品者受取（price - fee）
  status        order_status not null default 'pending',
  slot          timestamptz,                  -- ビデオ予約枠
  stripe_pi     text,                         -- Stripe PaymentIntent（エスクロー与信）
  daily_room    text,                         -- Daily.co ルームURL
  promo_id      uuid references promo_links(id),  -- 宣伝リンク経由か（SNS流入比率KPI）
  first_buyer_msg_at timestamptz,             -- 無応答自動返金の判定用（6章）
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index orders_buyer_idx on orders(buyer_id);
create index orders_creator_idx on orders(creator_id);
create index orders_status_idx on orders(status);

-- ---------- order_events（取引の監査ログ。別紙0.2 の状態遷移を記録）----------
create table order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  type       text not null,     -- purchased/first_message/seller_replied/completed/refunded/canceled 等
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- messages（取引スレッド。画像添付・既読・NG検知フラグ・6章）----------
create table messages (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  sender     msg_sender not null,
  sender_id  uuid references profiles(id),
  body       text,
  image_url  text,                              -- Storage の画像URL
  flagged    boolean not null default false,    -- NGワード検知でフラグ
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index messages_order_idx on messages(order_id, created_at);

-- ---------- reviews（取引完了後のみ・1取引1回・投稿後編集不可・S9）----------
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references orders(id) on delete cascade,  -- 1取引1回
  plan_id    uuid not null references plans(id),
  buyer_id   uuid not null references profiles(id),
  rating     integer not null check (rating between 1 and 5),
  body       text default '',
  reply      text,                              -- 出品者からの返信（5.3）
  created_at timestamptz not null default now()
  -- 編集不可: RLS で update を許可しない（0003）
);
create index reviews_plan_idx on reviews(plan_id);

-- ---------- favorites（お気に入り）----------
create table favorites (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('plan', 'creator')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (profile_id, target_type, target_id)
);

-- ---------- notifications（S14）----------
create table notifications (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  type             text not null,   -- message/booking/complete/review/news
  title            text not null,
  actor_creator_id uuid references creators(id),
  read             boolean not null default false,
  created_at       timestamptz not null default now()
);
create index notifications_profile_idx on notifications(profile_id, read);

-- ---------- payouts（出金申請。翌月払い・出金時eKYC必須・8.3/6章）----------
create table payouts (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references creators(id),
  amount       integer not null check (amount >= 1000),  -- 最低出金額1,000円
  kyc_verified boolean not null default false,
  status       payout_status not null default 'requested',
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------- reports（通報。A2）----------
create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  target_type text not null,   -- plan/creator/message/user
  target_id   uuid,
  reason      text not null,
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);

-- ---------- ng_words（メッセージのNGワード検知。6章。Edge/クライアントで参照）----------
create table ng_words (
  id      uuid primary key default gen_random_uuid(),
  pattern text not null,   -- 正規表現
  label   text not null
);

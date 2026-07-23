-- =========================================================
-- amie — シードデータ
-- モックプロトタイプと同じ出品者・プラン・レビューを投入。
-- `supabase db reset` で本番同等のデモ環境が立ち上がる。
-- 認証ユーザー(auth.users)も併せて作成（デモ用・パスワードログインは想定しない）。
-- =========================================================

-- ---- 認証ユーザー（出品者10＋購入者3）----
insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-0000-0000-000000000001','moeka@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000002','sayuri@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000003','kaori@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000004','rina@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000005','haruna@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000006','mari@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000007','aki@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000008','yuzu@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000009','saki@example.com','authenticated','authenticated'),
  ('c0000000-0000-0000-0000-000000000010','eri@example.com','authenticated','authenticated'),
  ('a0000000-0000-0000-0000-000000000001','mina@example.com','authenticated','authenticated'),
  ('a0000000-0000-0000-0000-000000000002','saki-b@example.com','authenticated','authenticated'),
  ('a0000000-0000-0000-0000-000000000003','aya@example.com','authenticated','authenticated')
on conflict do nothing;

-- ---- profiles ----
insert into profiles (id, display_name, bio, concerns, is_admin) values
  ('c0000000-0000-0000-0000-000000000001','MOEKA','',  '{}', false),
  ('c0000000-0000-0000-0000-000000000002','有村 さゆり','','{}', false),
  ('c0000000-0000-0000-0000-000000000003','kaori','',  '{}', false),
  ('c0000000-0000-0000-0000-000000000004','RINA','',   '{}', false),
  ('c0000000-0000-0000-0000-000000000005','はるな','', '{}', false),
  ('c0000000-0000-0000-0000-000000000006','mari','',   '{}', false),
  ('c0000000-0000-0000-0000-000000000007','あき','',   '{}', false),
  ('c0000000-0000-0000-0000-000000000008','ゆず','',   '{}', false),
  ('c0000000-0000-0000-0000-000000000009','SAKI','',   '{}', false),
  ('c0000000-0000-0000-0000-000000000010','eri','',    '{}', false),
  ('a0000000-0000-0000-0000-000000000001','みな','垢抜けたい社会人2年目。','{akanuke,buruberu}', false),
  ('a0000000-0000-0000-0000-000000000002','さき','骨格診断してもらいたい','{kokkaku}', false),
  ('a0000000-0000-0000-0000-000000000003','あや','オフィスコーデ迷子','{office}', true)  -- あや=運営デモ(admin)
-- handle_new_user トリガが auth.users 挿入時に profiles を先に作るため upsert で上書きする
on conflict (id) do update set
  display_name = excluded.display_name, bio = excluded.bio,
  concerns = excluded.concerns, is_admin = excluded.is_admin;

-- ---- creators ----
insert into creators (id, profile_id, handle, type, tagline, bio, verified, categories, concerns) values
  ('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','moeka_beauty','influencer','垢抜けメイクの伝道師','元美容部員のメイクインフルエンサー。地味顔さんの垢抜けが得意。',true,'{makeup,skincare}','{akanuke,buruberu}'),
  ('c1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','sayuri_official','celebrity','雑誌専属モデル / 女優','ファッション誌の専属モデル。写真映えと日常コーデの両立を提案。',true,'{fashion,personalcolor}','{date,office}'),
  ('c1000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','kaori_color','pro','骨格×パーソナルカラー診断歴8年','年間500名を診断してきたアナリスト。',true,'{personalcolor,fashion}','{buruberu,kokkaku}'),
  ('c1000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000004','rina_nail','influencer','セルフネイルで垢抜ける','サロン級のセルフネイルを教えます。',true,'{nail}','{akanuke}'),
  ('c1000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000005','haruna_hair','pro','不器用さんの朝ヘアを3分に','広告・PV現場のヘアメイク。',true,'{hair,makeup}','{akanuke,office}'),
  ('c1000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000006','mari_kurashi','influencer','小さな部屋を心地よく','1LDK賃貸暮らしを発信。',true,'{interior,cooking}','{hitorigurashi}'),
  ('c1000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000007','aki_recipe','pro','作りおきと時短の栄養設計','共働き家庭のための時短ごはん。',true,'{cooking}','{mama}'),
  ('c1000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000008','yuzu_diet','general','-12kgのリアル記録','無理な食事制限なしで12kg減。※資格保有者ではありません。',false,'{diet}','{akanuke}'),
  ('c1000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000009','saki_lovecoach','influencer','自分を好きになる恋愛のはなし','婚活・恋愛の発信。',true,'{love}','{date}'),
  ('c1000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000010','eri_career','pro','私らしい働き方の見つけ方','国家資格キャリアコンサルタント。',true,'{career}','{office}');

-- ---- sns_accounts（フォロワー数）----
insert into sns_accounts (creator_id, provider, handle, follower_count, verified) values
  ('c1000000-0000-0000-0000-000000000001','instagram','moeka_beauty',128000,true),
  ('c1000000-0000-0000-0000-000000000001','tiktok','moeka_beauty',342000,true),
  ('c1000000-0000-0000-0000-000000000001','youtube','moeka',56000,true),
  ('c1000000-0000-0000-0000-000000000002','instagram','sayuri_official',892000,true),
  ('c1000000-0000-0000-0000-000000000002','tiktok','sayuri',210000,true),
  ('c1000000-0000-0000-0000-000000000003','instagram','kaori_color',34000,true),
  ('c1000000-0000-0000-0000-000000000003','youtube','kaori',12000,true),
  ('c1000000-0000-0000-0000-000000000004','instagram','rina_nail',76000,true),
  ('c1000000-0000-0000-0000-000000000004','tiktok','rina_nail',145000,true),
  ('c1000000-0000-0000-0000-000000000006','instagram','mari_kurashi',168000,true),
  ('c1000000-0000-0000-0000-000000000006','youtube','mari',94000,true),
  ('c1000000-0000-0000-0000-000000000009','instagram','saki_lovecoach',214000,true),
  ('c1000000-0000-0000-0000-000000000009','tiktok','saki',118000,true);

-- ---- plans（代表。3形式）----
insert into plans (id, creator_id, title, format, price, category, concerns, description, chat_days, minutes, monthly_videos, chat_included) values
  ('50000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','あなた専用・垢抜けメイクレッスン','video',8000,'makeup','{akanuke,buruberu}','マンツーマンで垢抜けポイントを一緒に。',null,60,null,null),
  ('50000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','メイク写真を送るだけ添削（3日）','chat',3000,'makeup','{akanuke}','写真を送れば直す順に具体的にお返事。',3,null,null,true),
  ('50000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','垢抜け3ヶ月伴走プラン','monthly',12000,'makeup','{akanuke}','チャット添削し放題＋月2回ビデオ。',null,null,2,true),
  ('50000000-0000-0000-0000-000000000006','c1000000-0000-0000-0000-000000000003','パーソナルカラー＋骨格診断（90分）','video',15000,'personalcolor','{buruberu,kokkaku}','4分類・3タイプを診断し買い物メモ化。',null,90,null,null),
  ('50000000-0000-0000-0000-000000000008','c1000000-0000-0000-0000-000000000004','セルフネイルお悩み相談（3日）','chat',1500,'nail','{akanuke}','ムラ・剥がれ・色選びの原因と直し方。',3,null,null,true),
  ('50000000-0000-0000-0000-000000000010','c1000000-0000-0000-0000-000000000006','お部屋づくり相談（7日）','chat',2500,'interior','{hitorigurashi}','間取りと写真から垢抜ける配置換えを。',7,null,null,true),
  ('50000000-0000-0000-0000-000000000014','c1000000-0000-0000-0000-000000000009','マッチングアプリ プロフィール添削（3日）','chat',2500,'love','{date}','写真と自己紹介文をいいねが増える形に。',3,null,null,true),
  ('50000000-0000-0000-0000-000000000016','c1000000-0000-0000-0000-000000000010','キャリアの棚卸し・60分ビデオ','video',9000,'career','{office}','これまでの経験を一緒に言語化。',null,60,null,null);

-- ---- reviews は完了取引が前提のため、デモ表示用に注文→完了→レビューを1件作る ----
insert into orders (id, plan_id, buyer_id, creator_id, format, price, status, completed_at)
values ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000006',
        'a0000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','video',15000,'completed', now());
insert into reviews (order_id, plan_id, buyer_id, rating, body)
values ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000006',
        'a0000000-0000-0000-0000-000000000002',5,'対面と変わらない精度でした。似合う色メモが一生ものです。');

-- ---- NGワード（6章。Edge/クライアントの送信前チェックで参照）----
insert into ng_words (pattern, label) values
  ('https?://|\.com|\.jp|\.me\b','外部サイトURL'),
  ('\bline\b|ライン(交換|のid|@)|カカオ|id交換','外部連絡先への誘導'),
  ('\d{10,}','電話・口座番号らしき数字'),
  ('振込|口座番号|現金書留','外部決済への誘導');

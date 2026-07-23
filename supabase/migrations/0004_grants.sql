-- =========================================================
-- amie — ロール権限（0004）
-- Supabase では RLS（行の可視性）とは別に、テーブル/ビューへの GRANT が必要。
-- anon        = 未ログイン（公開読み取りのみ）
-- authenticated = ログインユーザー（DML可。行は RLS(0003) で制限）
-- =========================================================

grant usage on schema public to anon, authenticated;

-- ---------- 公開読み取り（anon も可）----------
-- プロフィール表示名・出品者・プラン・SNS・レビュー・NG語は公開情報。
grant select on profiles, creators, sns_accounts, plans, reviews, ng_words to anon, authenticated;
grant select on plans_public, plan_stats, creator_stats to anon, authenticated;

-- ---------- ログインユーザーの操作（行は RLS で制限）----------
grant select, insert, update, delete on
  profiles, creators, sns_accounts, plans, promo_links, orders, order_events,
  messages, reviews, favorites, notifications, payouts, reports
  to authenticated;

-- UUID既定値のため通常シーケンスは無いが、将来のため付与しておく。
grant usage, select on all sequences in schema public to authenticated;

-- ---------- 機微なビューは公開しない ----------
-- no_response_refund_candidates は返金対象の取引を含むため service_role 専用。
revoke all on no_response_refund_candidates from anon, authenticated;

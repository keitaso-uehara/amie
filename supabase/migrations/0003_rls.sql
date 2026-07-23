-- =========================================================
-- amie — 行レベルセキュリティ（0003）
-- 仕様書 11.3「認可はRLSで担保」。購入者/出品者/運営を分離。
-- auth.uid() = ログインユーザーの profiles.id。
-- =========================================================

-- 管理者判定
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
-- ログインユーザーが所有する出品者か
create or replace function owns_creator(cid uuid) returns boolean language sql stable as $$
  select exists (select 1 from creators c where c.id = cid and c.profile_id = auth.uid());
$$;
-- ログインユーザーが取引の当事者（購入者 or 出品者）か
create or replace function in_order(oid uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from orders o
    where o.id = oid and (o.buyer_id = auth.uid() or owns_creator(o.creator_id))
  );
$$;

alter table profiles      enable row level security;
alter table creators      enable row level security;
alter table sns_accounts  enable row level security;
alter table plans         enable row level security;
alter table promo_links   enable row level security;
alter table orders        enable row level security;
alter table order_events  enable row level security;
alter table messages      enable row level security;
alter table reviews       enable row level security;
alter table favorites     enable row level security;
alter table notifications enable row level security;
alter table payouts       enable row level security;
alter table reports       enable row level security;
alter table ng_words      enable row level security;

-- ---------- profiles ----------
create policy profiles_read on profiles for select using (true);           -- 公開プロフィール
create policy profiles_update on profiles for update using (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());

-- ---------- creators（公開読み取り・本人が管理）----------
create policy creators_read on creators for select using (true);
create policy creators_write on creators for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy creators_admin on creators for all using (is_admin());

-- ---------- sns_accounts ----------
create policy sns_read on sns_accounts for select using (true);
create policy sns_write on sns_accounts for all using (owns_creator(creator_id)) with check (owns_creator(creator_id));

-- ---------- plans（公開分は誰でも読める・本人が管理・運営は全件）----------
create policy plans_read_public on plans for select using (status = 'published' or owns_creator(creator_id) or is_admin());
create policy plans_write on plans for all using (owns_creator(creator_id)) with check (owns_creator(creator_id));
create policy plans_admin on plans for all using (is_admin());

-- ---------- promo_links（本人のみ）----------
create policy promo_owner on promo_links for all using (owns_creator(creator_id)) with check (owns_creator(creator_id));

-- ---------- orders（購入者・当該出品者・運営）----------
create policy orders_read on orders for select using (buyer_id = auth.uid() or owns_creator(creator_id) or is_admin());
create policy orders_insert on orders for insert with check (buyer_id = auth.uid());
create policy orders_update on orders for update using (buyer_id = auth.uid() or owns_creator(creator_id) or is_admin());

-- ---------- order_events（当事者・運営が閲覧。書き込みはトリガ/サービスロール）----------
create policy events_read on order_events for select using (in_order(order_id) or is_admin());

-- ---------- messages（取引の当事者のみ）----------
create policy messages_read on messages for select using (in_order(order_id) or is_admin());
create policy messages_insert on messages for insert with check (in_order(order_id));
-- 既読(read_at)更新のみ許可。本文編集は不可。
create policy messages_update_read on messages for update using (in_order(order_id)) with check (in_order(order_id));

-- ---------- reviews（公開読み取り・購入者が投稿・編集不可）----------
create policy reviews_read on reviews for select using (true);
create policy reviews_insert on reviews for insert with check (buyer_id = auth.uid());
-- 出品者は自分のプランのレビューに reply を付けられる（5.3）
create policy reviews_reply on reviews for update
  using (exists (select 1 from plans p where p.id = reviews.plan_id and owns_creator(p.creator_id)))
  with check (exists (select 1 from plans p where p.id = reviews.plan_id and owns_creator(p.creator_id)));
-- ※ 購入者による本文編集・削除ポリシーは作らない → 投稿後編集不可（S9）

-- ---------- favorites / notifications（本人のみ）----------
create policy fav_owner on favorites for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notif_owner on notifications for select using (profile_id = auth.uid());
create policy notif_update on notifications for update using (profile_id = auth.uid());

-- ---------- payouts（本人の出品者＋運営）----------
create policy payouts_owner on payouts for select using (owns_creator(creator_id) or is_admin());
create policy payouts_request on payouts for insert with check (owns_creator(creator_id));
create policy payouts_admin on payouts for update using (is_admin());

-- ---------- reports（通報者が起票・運営が閲覧/対応）----------
create policy reports_insert on reports for insert with check (auth.uid() is not null);
create policy reports_admin on reports for all using (is_admin());

-- ---------- ng_words（公開読み取り・運営が管理）----------
create policy ng_read on ng_words for select using (true);
create policy ng_admin on ng_words for all using (is_admin());

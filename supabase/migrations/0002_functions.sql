-- =========================================================
-- amie — 関数・トリガ・ビュー（0002）
-- 仕様書の業務ルールをDB側に集約する。アプリはこれに従うだけでよい。
-- =========================================================

-- ---------- updated_at 自動更新 ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger trg_creators_touch before update on creators for each row execute function touch_updated_at();
create trigger trg_plans_touch    before update on plans    for each row execute function touch_updated_at();
create trigger trg_orders_touch   before update on orders   for each row execute function touch_updated_at();

-- ---------- 手数料20%（8.2 一律）を注文に付与 ----------
-- 手数料率は将来変更に備え定数関数化（招致キャンペーンの10%等は別途拡張）。
create or replace function amie_fee_rate() returns numeric language sql immutable as $$ select 0.20 $$;

create or replace function orders_calc_fee() returns trigger language plpgsql as $$
begin
  new.fee := round(new.price * amie_fee_rate());
  new.net := new.price - new.fee;
  return new;
end $$;
create trigger trg_orders_fee before insert or update of price on orders
  for each row execute function orders_calc_fee();

-- ---------- 価格ルール（4.5）: 最低1,000円・出品者の上限以内 ----------
create or replace function plans_validate_price() returns trigger language plpgsql as $$
declare cap integer;
begin
  if new.price < 1000 then
    raise exception '価格は最低1,000円です（現在 %）', new.price;
  end if;
  select price_cap into cap from creators where id = new.creator_id;
  if cap is not null and new.price > cap then
    raise exception '価格が上限 %円 を超えています（本人確認と実績で解除できます）', cap;
  end if;
  return new;
end $$;
create trigger trg_plans_price before insert or update of price on plans
  for each row execute function plans_validate_price();

-- ---------- 購入時: スレッドにシステムの歓迎メッセージを入れる（S5→S6）----------
create or replace function orders_open_thread() returns trigger language plpgsql as $$
begin
  insert into messages(order_id, sender, body)
  values (new.id, 'system', 'ご購入ありがとうございます。取引を開始しました。');
  insert into order_events(order_id, type, note) values (new.id, 'purchased', new.format::text);
  return new;
end $$;
create trigger trg_orders_thread after insert on orders
  for each row execute function orders_open_thread();

-- ---------- メッセージ: 初回購入者発言・出品者応答の記録（無応答自動返金の判定材料・6章）----------
create or replace function messages_track() returns trigger language plpgsql as $$
begin
  if new.sender = 'buyer' then
    update orders set first_buyer_msg_at = coalesce(first_buyer_msg_at, now())
      where id = new.order_id and first_buyer_msg_at is null;
  elsif new.sender = 'seller' then
    insert into order_events(order_id, type) values (new.order_id, 'seller_replied');
  end if;
  return new;
end $$;
create trigger trg_messages_track after insert on messages
  for each row execute function messages_track();

-- ---------- レビュー制約（S9）: 完了した自分の取引にのみ・投稿後編集不可 ----------
-- 1取引1回は reviews.order_id unique。完了・本人チェックはここで。編集不可は RLS で update を許可しないことで担保。
create or replace function reviews_guard() returns trigger language plpgsql as $$
declare o record;
begin
  select buyer_id, status, plan_id into o from orders where id = new.order_id;
  if o is null then raise exception '取引が存在しません'; end if;
  if o.status <> 'completed' then raise exception '取引完了後のみレビューできます'; end if;
  if o.buyer_id <> new.buyer_id then raise exception '自分の取引のみレビューできます'; end if;
  new.plan_id := o.plan_id;
  return new;
end $$;
create trigger trg_reviews_guard before insert on reviews
  for each row execute function reviews_guard();

-- ---------- 18歳未満の決済制限（6章）: 5,000円超・月額は不可 ----------
create or replace function orders_age_gate() returns trigger language plpgsql as $$
declare bd date; age int;
begin
  select birthdate into bd from profiles where id = new.buyer_id;
  if bd is not null then
    age := date_part('year', age(bd));
    if age < 18 then
      if new.format = 'monthly' then raise exception '18歳未満は月額プランを購入できません'; end if;
      if new.price > 5000 then raise exception '18歳未満は5,000円を超える決済ができません'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_orders_age before insert on orders
  for each row execute function orders_age_gate();

-- ---------- 宣伝リンクの流入・転換カウント（5.2(2)。手数料優遇はなし・計測のみ）----------
create or replace function increment_promo_click(p_id uuid) returns void language sql as $$
  update promo_links set clicks = clicks + 1 where id = p_id;
$$;
create or replace function increment_promo_conversion(p_id uuid) returns void language sql as $$
  update promo_links set conversions = conversions + 1 where id = p_id;
$$;

-- ---------- 通知作成ヘルパー ----------
create or replace function notify(p_profile uuid, p_type text, p_title text, p_actor uuid default null)
returns void language sql as $$
  insert into notifications(profile_id, type, title, actor_creator_id)
  values (p_profile, p_type, p_title, p_actor);
$$;

-- =========================================================
-- 集計ビュー（アプリの一覧・詳細はこれを読む）
-- =========================================================

-- プラン統計（評価平均・件数・販売数）
create or replace view plan_stats as
select p.id as plan_id,
       coalesce(round(avg(r.rating)::numeric, 1), 0) as rating,
       count(r.id) as review_count,
       (select count(*) from orders o where o.plan_id = p.id and o.status = 'completed') as sales_count
from plans p left join reviews r on r.plan_id = p.id
group by p.id;

-- 出品者統計（取引数・評価・SNS合計フォロワー）
create or replace view creator_stats as
select c.id as creator_id,
       (select count(*) from orders o where o.creator_id = c.id and o.status in ('completed','active')) as sales,
       coalesce((select round(avg(r.rating)::numeric,1)
                 from reviews r join plans p on p.id = r.plan_id where p.creator_id = c.id), 0) as rating,
       coalesce((select sum(follower_count) from sns_accounts s where s.creator_id = c.id), 0) as sns_total
from creators c;

-- 公開プラン（一覧・検索用。creator と統計を結合）
create or replace view plans_public as
select p.*, st.rating, st.review_count, st.sales_count,
       c.handle as creator_handle, c.type as creator_type, c.verified as creator_verified
from plans p
join creators c on c.id = p.creator_id
join plan_stats st on st.plan_id = p.id
where p.status = 'published';

-- 無応答自動返金の対象（6章）: 購入者の初回発言から48時間、出品者の返信が一度もない進行中のチャット取引
create or replace view no_response_refund_candidates as
select o.*
from orders o
where o.status = 'progress'
  and o.format = 'chat'
  and o.first_buyer_msg_at is not null
  and o.first_buyer_msg_at < now() - interval '48 hours'
  and not exists (select 1 from messages m where m.order_id = o.id and m.sender = 'seller');

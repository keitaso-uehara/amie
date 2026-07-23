-- =========================================================
-- amie — トリガのセキュリティ定義（0006）
-- 注文作成/メッセージ時にトリガが order_events・messages へ挿入する行は
-- 「システム生成」であり、実行ユーザーの RLS を通す必要がない。
-- INVOKER 実行だと order_events に INSERT ポリシーが無く弾かれるため、
-- 該当トリガ関数を SECURITY DEFINER（所有者権限＝RLSバイパス）に変更する。
-- =========================================================

-- 購入時: システム歓迎メッセージ＋購入イベントを記録
create or replace function orders_open_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into messages(order_id, sender, body)
  values (new.id, 'system', 'ご購入ありがとうございます。取引を開始しました。');
  insert into order_events(order_id, type, note) values (new.id, 'purchased', new.format::text);
  return new;
end $$;

-- メッセージ: 初回購入者発言の記録・出品者応答イベント
create or replace function messages_track() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'buyer' then
    update orders set first_buyer_msg_at = coalesce(first_buyer_msg_at, now())
      where id = new.order_id and first_buyer_msg_at is null;
  elsif new.sender = 'seller' then
    insert into order_events(order_id, type) values (new.order_id, 'seller_replied');
  end if;
  return new;
end $$;

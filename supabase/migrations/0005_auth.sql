-- =========================================================
-- amie — 認証連携（0005）
-- Supabase Auth で新規ユーザーが作成されたら profiles を自動作成する。
-- （メール/SNS/匿名いずれのサインインでも profiles 行が用意される）
-- =========================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'ゲスト')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

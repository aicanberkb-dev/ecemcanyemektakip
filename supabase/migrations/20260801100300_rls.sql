-- 0004_rls.sql — Row Level Security politikaları
--
-- Bu fazda tek yetki seviyesi var: giriş yapmış (authenticated) herkes her şeyi
-- yapabilir. Rol ayrımı ileride açılacağı için profiles.rol alanı tutuluyor.
--
-- Rol ayrımından bağımsız, her zaman geçerli iki kural:
--   1) Kimse başka bir kullanıcının adına işlem kaydı giremez
--      (islemi_yapan_user_id = auth.uid() zorunlu).
--   2) audit_log'a uygulama katmanından yazılamaz/silinemez; yalnızca trigger yazar.

alter table public.profiles        enable row level security;
alter table public.students        enable row level security;
alter table public.app_settings    enable row level security;
alter table public.transactions    enable row level security;
alter table public.serbest_ogunler enable row level security;
alter table public.taksit_plani    enable row level security;
alter table public.audit_log       enable row level security;

-- ---------------------------------------------------------------------------
-- Şema ve tablo yetkileri: anon hiçbir şeye erişemez
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.students, public.app_settings,
  public.transactions, public.serbest_ogunler, public.taksit_plani
  to authenticated;
grant select on public.student_balances to authenticated;

-- audit_log: yalnızca okunabilir. Yazma/silme SECURITY DEFINER trigger'a ait.
revoke insert, update, delete on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (true) with check (true);

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated using (true);

drop policy if exists students_insert on public.students;
create policy students_insert on public.students
  for insert to authenticated with check (true);

drop policy if exists students_update on public.students;
create policy students_update on public.students
  for update to authenticated using (true) with check (true);

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_insert on public.app_settings;
create policy app_settings_insert on public.app_settings
  for insert to authenticated with check (true);

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- taksit_plani
-- ---------------------------------------------------------------------------
drop policy if exists taksit_plani_select on public.taksit_plani;
create policy taksit_plani_select on public.taksit_plani
  for select to authenticated using (true);

drop policy if exists taksit_plani_insert on public.taksit_plani;
create policy taksit_plani_insert on public.taksit_plani
  for insert to authenticated with check (true);

drop policy if exists taksit_plani_update on public.taksit_plani;
create policy taksit_plani_update on public.taksit_plani
  for update to authenticated using (true) with check (true);

drop policy if exists taksit_plani_delete on public.taksit_plani;
create policy taksit_plani_delete on public.taksit_plani
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- transactions — her zaman geçerli kural: islemi_yapan_user_id = auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated using (true);

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (islemi_yapan_user_id = auth.uid());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (true)
  with check (islemi_yapan_user_id = auth.uid());

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- serbest_ogunler — aynı kural
-- ---------------------------------------------------------------------------
drop policy if exists serbest_ogunler_select on public.serbest_ogunler;
create policy serbest_ogunler_select on public.serbest_ogunler
  for select to authenticated using (true);

drop policy if exists serbest_ogunler_insert on public.serbest_ogunler;
create policy serbest_ogunler_insert on public.serbest_ogunler
  for insert to authenticated
  with check (islemi_yapan_user_id = auth.uid());

drop policy if exists serbest_ogunler_update on public.serbest_ogunler;
create policy serbest_ogunler_update on public.serbest_ogunler
  for update to authenticated
  using (true)
  with check (islemi_yapan_user_id = auth.uid());

drop policy if exists serbest_ogunler_delete on public.serbest_ogunler;
create policy serbest_ogunler_delete on public.serbest_ogunler
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- audit_log — sadece okuma politikası var; insert/update/delete politikası YOK
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated using (true);

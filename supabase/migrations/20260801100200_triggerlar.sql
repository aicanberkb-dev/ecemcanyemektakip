-- 0003_triggerlar.sql — Audit kaydı ve yeni kullanıcı profili

-- ---------------------------------------------------------------------------
-- audit_yaz — her UPDATE/DELETE'i eski/yeni jsonb değerleriyle audit_log'a yazar
-- SECURITY DEFINER: audit_log'a uygulama rolü yazamaz, yalnızca bu trigger yazar
-- ---------------------------------------------------------------------------
create or replace function public.audit_yaz()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_kayit_id uuid;
begin
  if tg_op = 'DELETE' then
    v_kayit_id := nullif(to_jsonb(old) ->> 'id', '')::uuid;
    insert into public.audit_log (user_id, islem_tipi, tablo_adi, kayit_id, eski_deger, yeni_deger)
    values (auth.uid(), 'DELETE', tg_table_name, v_kayit_id, to_jsonb(old), null);
    return old;
  else
    v_kayit_id := nullif(to_jsonb(new) ->> 'id', '')::uuid;
    insert into public.audit_log (user_id, islem_tipi, tablo_adi, kayit_id, eski_deger, yeni_deger)
    values (auth.uid(), 'UPDATE', tg_table_name, v_kayit_id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end $$;

do $$
declare
  v_tablo text;
begin
  foreach v_tablo in array array[
    'students', 'transactions', 'profiles',
    'app_settings', 'taksit_plani', 'serbest_ogunler'
  ] loop
    execute format('drop trigger if exists audit_yaz on public.%I', v_tablo);
    execute format(
      'create trigger audit_yaz after update or delete on public.%I
         for each row execute function public.audit_yaz()', v_tablo);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- yeni_kullanici — auth.users'a satır düşünce profiles satırını açar
-- ---------------------------------------------------------------------------
create or replace function public.yeni_kullanici()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, rol, ad_soyad)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'rol', ''),
      'personel'
    )::public.kullanici_rolu,
    coalesce(nullif(new.raw_user_meta_data ->> 'ad_soyad', ''), new.email)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists yeni_kullanici on auth.users;
create trigger yeni_kullanici
  after insert on auth.users
  for each row execute function public.yeni_kullanici();

-- Migration öncesi oluşturulmuş kullanıcılar için eksik profilleri tamamla
insert into public.profiles (id, rol, ad_soyad)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'rol', ''), 'personel')::public.kullanici_rolu,
  coalesce(nullif(u.raw_user_meta_data ->> 'ad_soyad', ''), u.email)
from auth.users u
on conflict (id) do nothing;

-- 20260928120000_kayitsiz_ogunler.sql
--
-- Kayitsiz ogrenci ogunleri.
--
-- Sisteme kayitli olmayan, gunluk ucreti tanimli olmayan ogrenciler de
-- yemekhaneye geliyor. Bunlar bir yere yazilmadigi icin gun sonunda yiyen
-- sayisi eksik cikiyor ve o cocugun velisiyle gorusulup gorusulmedigi
-- takip edilemiyordu.
--
-- Ogrenci kaydi acilmiyor: cocuk kayitli degil, adi disinda bilgisi yok ve
-- ogrenci listesini kirletmemeli. Ayri tabloda, adiyla duruyor.
--
-- Para tahsil edilmiyor: kasaya girmez, bakiye etkilemez. Yalnizca kisi
-- sayisina girer ve raporda "sunun ucreti alindi mi" diye takip edilir.

create table if not exists public.kayitsiz_ogunler (
  id uuid primary key default gen_random_uuid(),
  okul_id uuid not null references public.okullar(id) on delete cascade,
  tarih date not null default current_date,
  ad_soyad text not null check (btrim(ad_soyad) <> ''),
  sinif text,
  aciklama text,
  -- Takip alanlari: yemekhane ekranini etkilemez, yalnizca raporda bilgi
  veli_arandi boolean not null default false,
  ucret_alindi boolean not null default false,
  islemi_yapan_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists kayitsiz_ogunler_okul_tarih_idx
  on public.kayitsiz_ogunler (okul_id, tarih);

comment on table public.kayitsiz_ogunler is
  'Sisteme kayitli olmayan ogrencilerin yemek kayitlari; ucret tahsil edilmez.';

alter table public.kayitsiz_ogunler enable row level security;

drop policy if exists kayitsiz_ogunler_select on public.kayitsiz_ogunler;
create policy kayitsiz_ogunler_select on public.kayitsiz_ogunler
  for select using (okul_erisimi(okul_id));

drop policy if exists kayitsiz_ogunler_insert on public.kayitsiz_ogunler;
create policy kayitsiz_ogunler_insert on public.kayitsiz_ogunler
  for insert with check (islemi_yapan_user_id = auth.uid() and okul_erisimi(okul_id));

drop policy if exists kayitsiz_ogunler_update on public.kayitsiz_ogunler;
create policy kayitsiz_ogunler_update on public.kayitsiz_ogunler
  for update using (okul_erisimi(okul_id)) with check (okul_erisimi(okul_id));

drop policy if exists kayitsiz_ogunler_delete on public.kayitsiz_ogunler;
create policy kayitsiz_ogunler_delete on public.kayitsiz_ogunler
  for delete using (okul_erisimi(okul_id));

-- Kayit ve geri alma
create or replace function public.kayitsiz_ogun_kaydet(
  p_okul_id uuid,
  p_ad_soyad text,
  p_tarih date default current_date,
  p_sinif text default null,
  p_aciklama text default null
)
returns table(id uuid, gun_toplami integer)
language plpgsql set search_path to 'public' as $$
declare
  v_id uuid;
  v_ad text := btrim(coalesce(p_ad_soyad, ''));
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  if v_ad = '' then
    raise exception 'Ogrenci adi bos olamaz.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.app_settings where okul_id = p_okul_id) then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  insert into public.kayitsiz_ogunler
    (okul_id, tarih, ad_soyad, sinif, aciklama, islemi_yapan_user_id)
  values (p_okul_id, p_tarih, upper(v_ad), nullif(btrim(p_sinif), ''),
          nullif(btrim(p_aciklama), ''), auth.uid())
  returning kayitsiz_ogunler.id into v_id;

  id := v_id;
  select count(*)::int into gun_toplami
  from public.kayitsiz_ogunler
  where okul_id = p_okul_id and tarih = p_tarih;

  return next;
end $$;

create or replace function public.kayitsiz_ogun_sil(p_id uuid)
returns void
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  delete from public.kayitsiz_ogunler where id = p_id;
  if not found then
    raise exception 'Kayit bulunamadi.' using errcode = 'P0002';
  end if;
end $$;

/**
 * Takip isaretleri. Yemekhane ekranini etkilemez: yalnizca raporda
 * "bu cocugun velisi arandi mi, ucreti alindi mi" bilgisini tutar.
 */
create or replace function public.kayitsiz_ogun_isaretle(
  p_id uuid,
  p_veli_arandi boolean default null,
  p_ucret_alindi boolean default null
)
returns void
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  update public.kayitsiz_ogunler
     set veli_arandi  = coalesce(p_veli_arandi, veli_arandi),
         ucret_alindi = coalesce(p_ucret_alindi, ucret_alindi)
   where id = p_id;

  if not found then
    raise exception 'Kayit bulunamadi.' using errcode = 'P0002';
  end if;
end $$;

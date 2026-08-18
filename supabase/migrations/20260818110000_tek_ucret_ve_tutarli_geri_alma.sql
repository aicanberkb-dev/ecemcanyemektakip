-- 20260818110000_tek_ucret_ve_tutarli_geri_alma.sql
--
-- Tek ücret kalemi ve tutarlı geri alma.
--
-- Tarifede üç ayrı fiyat tutmanın anlamı yoktu: misafirden ücret alınmıyor,
-- ücretli öğün de taban günlük ücretin ta kendisi. İki alan daha tutmak,
-- birbirinden ayrı düşüp sessizce yanlış tutar yazma riskiydi.
--
-- Geri almada da tutar girilebiliyor artık: kasadan 300 ₺ alınmışsa 300 ₺
-- iade edilmeli. O fiyattan yeterli kayıt yoksa sistem hata verir — sessizce
-- başka tutarlı bir kaydı silmek kasayı bozardı.

-- 1) Ücret fonksiyonu tek kalemden türetiyor
create or replace function public.ucretler(p_okul_id uuid, p_tarih date default current_date)
returns table (
  taban_gunluk_ucret  numeric,
  ucretli_ogun_ucreti numeric,
  misafir_ogun_ucreti numeric
)
language sql stable
set search_path = public
as $$
  select
    g.taban_gunluk_ucret,
    g.taban_gunluk_ucret,  -- ücretli öğün taban ücrete tabi
    0::numeric             -- misafirden ücret alınmaz
  from public.ucret_gecmisi g
  where g.okul_id = p_okul_id and g.gecerli_baslangic <= p_tarih
  order by g.gecerli_baslangic desc
  limit 1
$$;

revoke execute on function public.ucretler(uuid, date) from public, anon;
grant execute on function public.ucretler(uuid, date) to authenticated;

-- 2) Artık okunmayan kolonlar
alter table public.ucret_gecmisi drop column if exists ucretli_ogun_ucreti;
alter table public.ucret_gecmisi drop column if exists misafir_ogun_ucreti;
alter table public.app_settings  drop column if exists ucretli_ogun_ucreti;
alter table public.app_settings  drop column if exists misafir_ogun_ucreti;

-- 3) Serbest öğün kaydı sadeleşti
create or replace function public.serbest_ogun_kaydet(
  p_okul_id uuid,
  p_tip serbest_ogun_tipi,
  p_adet integer default 1,
  p_tarih date default current_date,
  p_aciklama text default null,
  p_birim_tutar numeric default null
)
returns table (eklenen integer, gun_toplami integer, birim_tutar numeric)
language plpgsql
set search_path = public
as $$
declare
  v_taban numeric;
  v_tutar numeric;
  v_adet  int := coalesce(p_adet, 1);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  if v_adet < 1 or v_adet > 500 then
    raise exception 'Adet 1 ile 500 arasinda olmali.' using errcode = 'P0001';
  end if;

  if p_birim_tutar is not null and p_birim_tutar < 0 then
    raise exception 'Birim tutar negatif olamaz.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.app_settings where okul_id = p_okul_id) then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  select u.taban_gunluk_ucret into v_taban from public.ucretler(p_okul_id, p_tarih) u;

  if p_birim_tutar is not null then
    v_tutar := p_birim_tutar;
  elsif p_tip = 'ucretli' then
    v_tutar := coalesce(v_taban, 0);
  else
    v_tutar := 0;  -- misafirden ücret alınmaz
  end if;

  insert into public.serbest_ogunler (okul_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id)
  select p_okul_id, p_tarih, p_tip, v_tutar, p_aciklama, auth.uid()
  from generate_series(1, v_adet);

  eklenen     := v_adet;
  birim_tutar := v_tutar;
  select count(*) into gun_toplami
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih;

  return next;
end $$;

revoke execute on function public.serbest_ogun_kaydet(uuid, serbest_ogun_tipi, integer, date, text, numeric) from public, anon;
grant execute on function public.serbest_ogun_kaydet(uuid, serbest_ogun_tipi, integer, date, text, numeric) to authenticated;

-- 4) Geri alma: adet ve tutar kontrollü
drop function if exists public.serbest_ogun_geri_al(uuid, serbest_ogun_tipi, integer, date);
create function public.serbest_ogun_geri_al(
  p_okul_id uuid,
  p_tip serbest_ogun_tipi,
  p_adet integer default 1,
  p_tarih date default current_date,
  p_birim_tutar numeric default null
)
returns table (silinen integer, gun_toplami integer, iade_tutari numeric)
language plpgsql
set search_path = public
as $$
declare
  v_adet    int := coalesce(p_adet, 1);
  v_mevcut  int;
  v_uygun   int;
  v_ad      text := case when p_tip = 'ucretli' then 'ucretli' else 'misafir' end;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  if v_adet < 1 or v_adet > 500 then
    raise exception 'Adet 1 ile 500 arasinda olmali.' using errcode = 'P0001';
  end if;

  if p_birim_tutar is not null and p_birim_tutar < 0 then
    raise exception 'Birim tutar negatif olamaz.' using errcode = 'P0001';
  end if;

  select count(*) into v_mevcut
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih;

  if v_mevcut = 0 then
    raise exception '% tarihinde geri alinacak % ogun kaydi yok.',
      to_char(p_tarih, 'DD.MM.YYYY'), v_ad using errcode = 'P0002';
  end if;

  if v_adet > v_mevcut then
    raise exception '% tarihinde % adet % ogun var, % adet geri alinamaz.',
      to_char(p_tarih, 'DD.MM.YYYY'), v_mevcut, v_ad, v_adet using errcode = 'P0002';
  end if;

  -- Tutar verildiyse yalnızca o tutardan girilmiş kayıtlar geri alınır:
  -- kasadan 300 alindiysa 300 iade edilmeli, 250'lik bir kayit silinmemeli.
  if p_birim_tutar is not null then
    select count(*) into v_uygun
    from public.serbest_ogunler
    where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
      and tutar = p_birim_tutar;

    if v_uygun < v_adet then
      raise exception '% tarihinde % tutarindan % adet % ogun var, % adet geri alinamaz.',
        to_char(p_tarih, 'DD.MM.YYYY'),
        to_char(p_birim_tutar, 'FM999G999D00') || ' TL',
        v_uygun, v_ad, v_adet using errcode = 'P0002';
    end if;
  end if;

  with silinecek as (
    select id, tutar from public.serbest_ogunler
    where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
      and (p_birim_tutar is null or tutar = p_birim_tutar)
    order by created_at desc
    limit v_adet
  ), silinen_kayitlar as (
    delete from public.serbest_ogunler s
    using silinecek k where s.id = k.id
    returning s.tutar
  )
  select count(*)::int, coalesce(sum(tutar), 0)
    into silinen, iade_tutari
  from silinen_kayitlar;

  select count(*) into gun_toplami
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih;

  return next;
end $$;

revoke execute on function public.serbest_ogun_geri_al(uuid, serbest_ogun_tipi, integer, date, numeric) from public, anon;
grant execute on function public.serbest_ogun_geri_al(uuid, serbest_ogun_tipi, integer, date, numeric) to authenticated;

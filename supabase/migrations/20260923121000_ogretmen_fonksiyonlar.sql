-- 20260923121000_ogretmen_fonksiyonlar.sql
--
-- Öğretmen öğünü ve ödeme yöntemi: ücret tarifesi, kayıt, geri alma ve gün
-- sonu sayacı yeni alanları tanısın.

-- Tarife: öğretmen ücreti de tarihli tarifeden okunur
drop function if exists public.ucretler(uuid, date);
create function public.ucretler(p_okul_id uuid, p_tarih date default current_date)
returns table(
  taban_gunluk_ucret numeric,
  ucretli_ogun_ucreti numeric,
  misafir_ogun_ucreti numeric,
  ogretmen_ogun_ucreti numeric
)
language sql stable set search_path to 'public' as $$
  select
    g.taban_gunluk_ucret,
    g.taban_gunluk_ucret,   -- ücretli öğün taban ücrete tabi
    0::numeric,             -- misafirden ücret alınmaz
    g.ogretmen_ucreti
  from public.ucret_gecmisi g
  where g.okul_id = p_okul_id and g.gecerli_baslangic <= p_tarih
  order by g.gecerli_baslangic desc
  limit 1
$$;

-- Kayıt: ödeme yöntemi ve öğretmen tarifesi
create or replace function public.serbest_ogun_kaydet(
  p_okul_id uuid,
  p_tip serbest_ogun_tipi,
  p_adet integer default 1,
  p_tarih date default current_date,
  p_aciklama text default null,
  p_birim_tutar numeric default null,
  p_odeme_yontemi text default null
)
returns table(eklenen integer, gun_toplami integer, birim_tutar numeric)
language plpgsql set search_path to 'public' as $$
declare
  v_taban numeric;
  v_ogretmen numeric;
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

  if p_odeme_yontemi is not null and p_odeme_yontemi not in ('nakit', 'kredi_karti') then
    raise exception 'Odeme yontemi nakit ya da kredi_karti olmali.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.app_settings where okul_id = p_okul_id) then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  select u.taban_gunluk_ucret, u.ogretmen_ogun_ucreti
    into v_taban, v_ogretmen
  from public.ucretler(p_okul_id, p_tarih) u;

  if p_birim_tutar is not null then
    v_tutar := p_birim_tutar;
  elsif p_tip = 'ucretli' then
    v_tutar := coalesce(v_taban, 0);
  elsif p_tip = 'ogretmen' then
    v_tutar := coalesce(v_ogretmen, 0);
  else
    v_tutar := 0;  -- misafirden ücret alınmaz
  end if;

  insert into public.serbest_ogunler
    (okul_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id, odeme_yontemi)
  select p_okul_id, p_tarih, p_tip, v_tutar, p_aciklama, auth.uid(), p_odeme_yontemi
  from generate_series(1, v_adet);

  eklenen     := v_adet;
  birim_tutar := v_tutar;
  select count(*) into gun_toplami
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
    and (p_odeme_yontemi is null or odeme_yontemi = p_odeme_yontemi);

  return next;
end $$;

-- Geri alma: yanlış yöntemden silinmesin diye ödeme yöntemi de eşleşir
create or replace function public.serbest_ogun_geri_al(
  p_okul_id uuid,
  p_tip serbest_ogun_tipi,
  p_adet integer default 1,
  p_tarih date default current_date,
  p_birim_tutar numeric default null,
  p_odeme_yontemi text default null
)
returns table(silinen integer, gun_toplami integer, iade_tutari numeric)
language plpgsql set search_path to 'public' as $$
declare
  v_adet    int := coalesce(p_adet, 1);
  v_mevcut  int;
  v_uygun   int;
  v_ad      text := p_tip::text;
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
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
    and (p_odeme_yontemi is null or odeme_yontemi = p_odeme_yontemi);

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
      and tutar = p_birim_tutar
      and (p_odeme_yontemi is null or odeme_yontemi = p_odeme_yontemi);

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
      and (p_odeme_yontemi is null or odeme_yontemi = p_odeme_yontemi)
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
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
    and (p_odeme_yontemi is null or odeme_yontemi = p_odeme_yontemi);

  return next;
end $$;

-- Gün sonu sayacı: öğretmen öğünü ve nakit/kart kırılımı
drop function if exists public.gun_sonu(uuid, date);
create function public.gun_sonu(p_okul_id uuid, p_tarih date default current_date)
returns table(
  gunlukcu integer, aylikci integer, ucretli integer, misafir integer,
  toplam integer, gunlukcu_tutar numeric, ucretli_tutar numeric, misafir_tutar numeric,
  ogretmen integer, ogretmen_tutar numeric,
  ucretli_nakit integer, ucretli_kart integer,
  ogretmen_nakit integer, ogretmen_kart integer
)
language sql stable set search_path to 'public' as $$
  with ogrenci as (
    select
      count(*) filter (where t.ogun_abone_tipi = 'gunluk')::int as gunlukcu,
      count(*) filter (where t.ogun_abone_tipi = 'aylik')::int  as aylikci,
      coalesce(sum(t.tutar) filter (where t.ogun_abone_tipi = 'gunluk'), 0) as gunlukcu_tutar
    from public.transactions t
    join public.students s on s.id = t.student_id
    where t.tarih = p_tarih and t.ogun_abone_tipi is not null and s.okul_id = p_okul_id
  ),
  serbest as (
    select
      count(*) filter (where tip = 'ucretli')::int as ucretli,
      count(*) filter (where tip = 'misafir')::int as misafir,
      count(*) filter (where tip = 'ogretmen')::int as ogretmen,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0) as ucretli_tutar,
      coalesce(sum(tutar) filter (where tip = 'misafir'), 0) as misafir_tutar,
      coalesce(sum(tutar) filter (where tip = 'ogretmen'), 0) as ogretmen_tutar,
      count(*) filter (where tip = 'ucretli' and odeme_yontemi = 'nakit')::int as ucretli_nakit,
      count(*) filter (where tip = 'ucretli' and odeme_yontemi = 'kredi_karti')::int as ucretli_kart,
      count(*) filter (where tip = 'ogretmen' and odeme_yontemi = 'nakit')::int as ogretmen_nakit,
      count(*) filter (where tip = 'ogretmen' and odeme_yontemi = 'kredi_karti')::int as ogretmen_kart
    from public.serbest_ogunler
    where tarih = p_tarih and okul_id = p_okul_id
  )
  select
    ogrenci.gunlukcu, ogrenci.aylikci, serbest.ucretli, serbest.misafir,
    ogrenci.gunlukcu + ogrenci.aylikci + serbest.ucretli + serbest.misafir + serbest.ogretmen,
    ogrenci.gunlukcu_tutar, serbest.ucretli_tutar, serbest.misafir_tutar,
    serbest.ogretmen, serbest.ogretmen_tutar,
    serbest.ucretli_nakit, serbest.ucretli_kart,
    serbest.ogretmen_nakit, serbest.ogretmen_kart
  from ogrenci, serbest;
$$;

-- 20260814100000_odeme_detayi_ve_serbest_fiyat.sql
--
-- 1) Devam çizelgesinde ödeme günü ayrıntısı (bakiye öncesi/sonrası)
-- 2) Serbest öğünde (ücretli/misafir) fiyatın işlem anında değiştirilebilmesi

-- ---------------------------------------------------------------------------
-- 1) Ödeme günü ayrıntısı
-- ---------------------------------------------------------------------------
-- Çizelgede turuncu işaretin üstüne gelince "o gün ne oldu" görünmeli:
-- ödeme öncesi bakiye, alınan tutar, gün sonundaki bakiye.
--
-- Bakiye gün sonuna göre hesaplanır: "öncesi" bir önceki günün kapanışı,
-- "sonrası" o günün kapanışıdır. Aynı gün birden fazla tahsilat varsa
-- toplanır. Gün içi sıralama tutulmadığı için tek doğru okuma budur.
drop function if exists public.devam_cizelgesi(uuid, integer, integer);
create function public.devam_cizelgesi(p_okul_id uuid, p_yil integer, p_ay integer)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  abone_tipi public.abone_tipi, ogrenci_tipi public.ogrenci_tipi,
  geldigi_gunler integer[], odeme_gunleri integer[], odeme_detay jsonb,
  geldi_sayisi integer, gelmedi_sayisi integer
)
language sql stable
set search_path = public
as $$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as ay_bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as ay_bit
  ),
  hafta_ici as (
    select count(*)::int as gun_sayisi
    from sinir, generate_series(sinir.ay_bas, sinir.ay_bit, interval '1 day') g
    where extract(isodow from g) < 6
  ),
  gelis as (
    select
      t.student_id,
      array_agg(extract(day from t.tarih)::int order by t.tarih)    as gunler,
      count(*)::int                                                 as adet,
      count(*) filter (where extract(isodow from t.tarih) < 6)::int as hafta_ici_adet
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.ogun_abone_tipi is not null
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id
  ),
  -- Ay içindeki tahsilat günleri ve o günün toplam tahsilatı
  odeme_gun as (
    select t.student_id, t.tarih, sum(t.tutar) as gun_tahsilat
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.tip = 'tahsilat'
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id, t.tarih
  ),
  -- Gün sonu bakiyeleri: devir + o güne kadarki tahsilat − harcama
  bakiye as (
    select
      o.student_id,
      o.tarih,
      o.gun_tahsilat,
      s.devir
        + coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'tahsilat'
                       and x.tarih < o.tarih), 0)
        - coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'harcama'
                       and x.tarih < o.tarih), 0) as oncesi,
      s.devir
        + coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'tahsilat'
                       and x.tarih <= o.tarih), 0)
        - coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'harcama'
                       and x.tarih <= o.tarih), 0) as sonrasi
    from odeme_gun o
    join public.students s on s.id = o.student_id
  ),
  odeme as (
    select
      b.student_id,
      array_agg(extract(day from b.tarih)::int order by b.tarih) as gunler,
      jsonb_object_agg(
        extract(day from b.tarih)::int,
        jsonb_build_object(
          'tutar',   b.gun_tahsilat,
          'oncesi',  b.oncesi,
          'sonrasi', b.sonrasi
        )
      ) as detay
    from bakiye b
    group by b.student_id
  )
  select
    s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.abone_tipi, s.ogrenci_tipi,
    coalesce(g.gunler, '{}'::int[]),
    coalesce(o.gunler, '{}'::int[]),
    coalesce(o.detay, '{}'::jsonb),
    coalesce(g.adet, 0),
    greatest(0, hafta_ici.gun_sayisi - coalesce(g.hafta_ici_adet, 0))
  from public.students s
  cross join hafta_ici
  left join gelis g on g.student_id = s.id
  left join odeme o on o.student_id = s.id
  where s.aktif and s.okul_id = p_okul_id
  order by s.ad_soyad;
$$;

revoke execute on function public.devam_cizelgesi(uuid, integer, integer) from public, anon;
grant execute on function public.devam_cizelgesi(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Serbest öğünde fiyat değiştirilebilsin
-- ---------------------------------------------------------------------------
-- Yemekhanede ücretli öğün her zaman tarifedeki fiyattan satılmıyor.
-- Fiyat girilmezse o günün tarifesi uygulanır; girilirse o kullanılır.
create or replace function public.serbest_ogun_kaydet(
  p_okul_id     uuid,
  p_tip         public.serbest_ogun_tipi,
  p_adet        integer default 1,
  p_tarih       date    default current_date,
  p_aciklama    text    default null,
  p_birim_tutar numeric default null
)
returns table(eklenen integer, gun_toplami integer, birim_tutar numeric)
language plpgsql
set search_path = public
as $$
declare
  v_ucret record;
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

  select * into v_ucret from public.ucretler(p_okul_id, p_tarih);

  if p_birim_tutar is not null then
    v_tutar := p_birim_tutar;
  elsif p_tip = 'ucretli' then
    v_tutar := case
                 when coalesce(v_ucret.ucretli_ogun_ucreti, 0) > 0 then v_ucret.ucretli_ogun_ucreti
                 else coalesce(v_ucret.taban_gunluk_ucret, 0)
               end;
  else
    v_tutar := coalesce(v_ucret.misafir_ogun_ucreti, 0);
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

revoke execute on function public.serbest_ogun_kaydet(
  uuid, public.serbest_ogun_tipi, integer, date, text, numeric) from public, anon;
grant execute on function public.serbest_ogun_kaydet(
  uuid, public.serbest_ogun_tipi, integer, date, text, numeric) to authenticated;

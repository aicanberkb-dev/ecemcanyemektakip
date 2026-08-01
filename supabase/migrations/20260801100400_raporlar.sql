-- 0005_raporlar.sql — Rapor fonksiyonları

-- ---------------------------------------------------------------------------
-- taksit_durumu — aylıkçı taksit takibi (kümülatif mantık)
--
-- Her vade tarihinde, o tarihe kadar birikmiş taksit toplamı ile yıl içinde
-- yapılan TÜM tahsilat (geç ödemeler dahil) karşılaştırılır. Geç ama kısmi
-- ödeme borcu azaltır; tamamlamıyorsa öğrenci hâlâ borçlu görünür.
-- ---------------------------------------------------------------------------
create or replace function public.taksit_durumu(
  p_yil   int,
  p_tarih date default current_date
) returns table (
  student_id      uuid,
  ogrenci_no      text,
  ad_soyad        text,
  sinif           text,
  yillik_toplam   numeric,
  vadesi_gelen    numeric,
  odenen          numeric,
  eksik           numeric,
  odeme_alinmali  boolean,
  son_vade        date
)
language sql stable security invoker
set search_path = public
as $$
  with plan as (
    select
      coalesce(sum(tutar), 0)                                          as yillik_toplam,
      coalesce(sum(tutar) filter (where vade_tarihi <= p_tarih), 0)    as vadesi_gelen,
      max(vade_tarihi) filter (where vade_tarihi <= p_tarih)           as son_vade
    from public.taksit_plani
    where yil = p_yil
  ),
  odeme as (
    select t.student_id, coalesce(sum(t.tutar), 0) as odenen
    from public.transactions t
    where t.tip = 'tahsilat'
      and extract(year from t.tarih) = p_yil
    group by t.student_id
  )
  select
    s.id,
    s.ogrenci_no,
    s.ad_soyad,
    s.sinif,
    plan.yillik_toplam,
    plan.vadesi_gelen,
    coalesce(o.odenen, 0),
    greatest(0, plan.vadesi_gelen - coalesce(o.odenen, 0))        as eksik,
    (plan.vadesi_gelen - coalesce(o.odenen, 0)) > 0               as odeme_alinmali,
    plan.son_vade
  from public.students s
  cross join plan
  left join odeme o on o.student_id = s.id
  where s.abone_tipi = 'aylik' and s.aktif
  order by (plan.vadesi_gelen - coalesce(o.odenen, 0)) desc, s.ad_soyad;
$$;

-- ---------------------------------------------------------------------------
-- devam_cizelgesi — aylık devam ızgarası
-- "Gelmeyen gün" sayısı hafta içi günler üzerinden hesaplanır.
-- ---------------------------------------------------------------------------
create or replace function public.devam_cizelgesi(
  p_yil int,
  p_ay  int
) returns table (
  student_id      uuid,
  ogrenci_no      text,
  ad_soyad        text,
  sinif           text,
  abone_tipi      public.abone_tipi,
  geldigi_gunler  int[],
  geldi_sayisi    int,
  gelmedi_sayisi  int
)
language sql stable security invoker
set search_path = public
as $$
  with sinir as (
    select
      make_date(p_yil, p_ay, 1)                              as ay_bas,
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
      array_agg(extract(day from t.tarih)::int order by t.tarih) as gunler,
      count(*)::int as adet
    from public.transactions t, sinir
    where t.ogun_abone_tipi is not null
      and t.tarih between sinir.ay_bas and sinir.ay_bit
    group by t.student_id
  )
  select
    s.id,
    s.ogrenci_no,
    s.ad_soyad,
    s.sinif,
    s.abone_tipi,
    coalesce(g.gunler, '{}'::int[]),
    coalesce(g.adet, 0),
    greatest(0, hafta_ici.gun_sayisi - coalesce(g.adet, 0))
  from public.students s
  cross join hafta_ici
  left join gelis g on g.student_id = s.id
  where s.aktif
  order by s.ad_soyad;
$$;

-- ---------------------------------------------------------------------------
-- gun_sonu — o gün kaç kişi yemek yedi (kırılımlı)
-- ---------------------------------------------------------------------------
create or replace function public.gun_sonu(p_tarih date default current_date)
returns table (
  gunlukcu        int,
  aylikci         int,
  ucretli         int,
  misafir         int,
  toplam          int,
  gunlukcu_tutar  numeric,
  ucretli_tutar   numeric,
  misafir_tutar   numeric
)
language sql stable security invoker
set search_path = public
as $$
  with ogrenci as (
    select
      count(*) filter (where ogun_abone_tipi = 'gunluk')::int as gunlukcu,
      count(*) filter (where ogun_abone_tipi = 'aylik')::int  as aylikci,
      coalesce(sum(tutar) filter (where ogun_abone_tipi = 'gunluk'), 0) as gunlukcu_tutar
    from public.transactions
    where tarih = p_tarih and ogun_abone_tipi is not null
  ),
  serbest as (
    select
      count(*) filter (where tip = 'ucretli')::int as ucretli,
      count(*) filter (where tip = 'misafir')::int as misafir,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0) as ucretli_tutar,
      coalesce(sum(tutar) filter (where tip = 'misafir'), 0) as misafir_tutar
    from public.serbest_ogunler
    where tarih = p_tarih
  )
  select
    ogrenci.gunlukcu,
    ogrenci.aylikci,
    serbest.ucretli,
    serbest.misafir,
    ogrenci.gunlukcu + ogrenci.aylikci + serbest.ucretli + serbest.misafir,
    ogrenci.gunlukcu_tutar,
    serbest.ucretli_tutar,
    serbest.misafir_tutar
  from ogrenci, serbest;
$$;

-- ---------------------------------------------------------------------------
-- nakit_raporu — gün gün kasaya giren nakit
-- ---------------------------------------------------------------------------
create or replace function public.nakit_raporu(
  p_bas date,
  p_bit date
) returns table (
  tarih            date,
  tahsilat_tutar   numeric,
  tahsilat_adet    int,
  ucretli_tutar    numeric,
  ucretli_adet     int,
  toplam           numeric
)
language sql stable security invoker
set search_path = public
as $$
  with gunler as (
    select g::date as tarih
    from generate_series(p_bas, p_bit, interval '1 day') g
  ),
  tahsilat as (
    select t.tarih, sum(t.tutar) as tutar, count(*)::int as adet
    from public.transactions t
    where t.tip = 'tahsilat' and t.tarih between p_bas and p_bit
    group by t.tarih
  ),
  ucretli as (
    select s.tarih, sum(s.tutar) as tutar, count(*)::int as adet
    from public.serbest_ogunler s
    where s.tip = 'ucretli' and s.tarih between p_bas and p_bit
    group by s.tarih
  )
  select
    gunler.tarih,
    coalesce(tahsilat.tutar, 0),
    coalesce(tahsilat.adet, 0),
    coalesce(ucretli.tutar, 0),
    coalesce(ucretli.adet, 0),
    coalesce(tahsilat.tutar, 0) + coalesce(ucretli.tutar, 0)
  from gunler
  left join tahsilat on tahsilat.tarih = gunler.tarih
  left join ucretli  on ucretli.tarih  = gunler.tarih
  where coalesce(tahsilat.adet, 0) + coalesce(ucretli.adet, 0) > 0
  order by gunler.tarih desc;
$$;

-- ---------------------------------------------------------------------------
-- gelen_giden_raporu — tarih aralığında öğrenci kırılımlı özet
-- ---------------------------------------------------------------------------
create or replace function public.gelen_giden_raporu(
  p_bas date,
  p_bit date
) returns table (
  student_id     uuid,
  ogrenci_no     text,
  ad_soyad       text,
  sinif          text,
  abone_tipi     public.abone_tipi,
  devir          numeric,
  donem_tahsilat numeric,
  donem_harcama  numeric,
  donem_ogun     int,
  guncel_kalan   numeric
)
language sql stable security invoker
set search_path = public
as $$
  with donem as (
    select
      t.student_id,
      coalesce(sum(t.tutar) filter (where t.tip = 'tahsilat'), 0) as tahsilat,
      coalesce(sum(t.tutar) filter (where t.tip = 'harcama'), 0)  as harcama,
      count(*) filter (where t.ogun_abone_tipi is not null)::int  as ogun
    from public.transactions t
    where t.tarih between p_bas and p_bit
    group by t.student_id
  )
  select
    b.student_id,
    b.ogrenci_no,
    b.ad_soyad,
    b.sinif,
    b.abone_tipi,
    b.devir,
    coalesce(d.tahsilat, 0),
    coalesce(d.harcama, 0),
    coalesce(d.ogun, 0),
    b.kalan
  from public.student_balances b
  left join donem d on d.student_id = b.student_id
  where b.aktif or coalesce(d.ogun, 0) > 0 or coalesce(d.tahsilat, 0) > 0
  order by b.ad_soyad;
$$;

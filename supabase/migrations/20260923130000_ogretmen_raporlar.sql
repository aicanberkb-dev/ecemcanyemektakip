-- 20260923130000_ogretmen_raporlar.sql
--
-- Öğretmen öğünü ve nakit/kart ayrımının raporlara yansıması.
--
-- Üç sorun vardı:
--  1) serbest_ogun_kaydet/geri_al'a p_odeme_yontemi eklenirken eski imzalar
--     yerinde kaldı; iki aday fonksiyon oluşunca çağrı belirsiz hale geliyor.
--  2) Nakit raporu bütün ücretli öğünleri kasaya nakit sayıyordu; artık
--     kartla ödenen öğün var, kasa sayımı tutmaz.
--  3) Öğretmen öğünü hiçbir ciro/kişi sayısına girmiyordu.
--
-- Ödeme yöntemi boş olan kayıtlar (ayrım öncesi girilen her şey) nakit
-- sayılır: o dönemde kart seçeneği yoktu, geçmiş rakamlar aynen korunur.

drop function if exists public.serbest_ogun_kaydet(uuid, serbest_ogun_tipi, integer, date, text, numeric);
drop function if exists public.serbest_ogun_geri_al(uuid, serbest_ogun_tipi, integer, date, numeric);

-- Nakit raporu: öğün tahsilatı nakit ve kart olarak ayrışır
drop function if exists public.nakit_raporu(uuid, date, date);
create function public.nakit_raporu(p_okul_id uuid, p_bas date, p_bit date)
returns table(
  tarih date,
  nakit_tutar numeric,
  havale_tutar numeric,
  kart_tutar numeric,
  belirsiz_tutar numeric,
  tahsilat_tutar numeric,
  tahsilat_adet integer,
  ucretli_tutar numeric,
  ucretli_adet integer,
  ucretli_nakit_tutar numeric,
  ucretli_kart_tutar numeric,
  toplam numeric,
  kasa_nakit numeric
)
language sql stable set search_path to 'public' as $$
  with gunler as (
    select g::date as tarih from generate_series(p_bas, p_bit, interval '1 day') g
  ),
  tahsilat as (
    select
      t.tarih,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'nakit'), 0)       as nakit,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'havale'), 0)      as havale,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'kredi_karti'), 0) as kart,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi is null), 0)         as belirsiz,
      sum(t.tutar)  as tutar,
      count(*)::int as adet
    from public.transactions t
    join public.students s on s.id = t.student_id
    where t.tip = 'tahsilat' and t.tarih between p_bas and p_bit and s.okul_id = p_okul_id
    group by t.tarih
  ),
  ucretli as (
    -- Öğretmen öğünü de kapıda tahsil edilen bir gelir
    select
      s.tarih,
      sum(s.tutar)  as tutar,
      count(*)::int as adet,
      coalesce(sum(s.tutar) filter (where s.odeme_yontemi is distinct from 'kredi_karti'), 0) as nakit,
      coalesce(sum(s.tutar) filter (where s.odeme_yontemi = 'kredi_karti'), 0) as kart
    from public.serbest_ogunler s
    where s.tip in ('ucretli', 'ogretmen')
      and s.tarih between p_bas and p_bit and s.okul_id = p_okul_id
    group by s.tarih
  )
  select
    gunler.tarih,
    coalesce(tahsilat.nakit, 0),
    coalesce(tahsilat.havale, 0),
    coalesce(tahsilat.kart, 0),
    coalesce(tahsilat.belirsiz, 0),
    coalesce(tahsilat.tutar, 0),
    coalesce(tahsilat.adet, 0),
    coalesce(ucretli.tutar, 0),
    coalesce(ucretli.adet, 0),
    coalesce(ucretli.nakit, 0),
    coalesce(ucretli.kart, 0),
    coalesce(tahsilat.tutar, 0) + coalesce(ucretli.tutar, 0),
    -- Kasaya fiilen giren para: nakit tahsilat + nakit odenen ogunler.
    -- Kartla odenen ogun kasaya girmez, bankaya gider.
    coalesce(tahsilat.nakit, 0) + coalesce(tahsilat.belirsiz, 0) + coalesce(ucretli.nakit, 0)
  from gunler
  left join tahsilat on tahsilat.tarih = gunler.tarih
  left join ucretli  on ucretli.tarih  = gunler.tarih
  where coalesce(tahsilat.adet, 0) + coalesce(ucretli.adet, 0) > 0
  order by gunler.tarih desc;
$$;

-- Günlük okul özeti (Kâr/Zarar): öğretmen öğünü kişi sayısına ve ciroya girer
create or replace function public.okul_gunluk_ozet(p_okul_id uuid, p_bas date, p_bit date)
returns table(tarih date, kisi integer, misafir integer, ciro numeric)
language sql stable set search_path to 'public' as $$
  with ogrenci as (
    select t.tarih,
      count(*) filter (where t.ogun_abone_tipi = 'gunluk')::int as gunlukcu,
      count(*) filter (where t.ogun_abone_tipi = 'aylik')::int  as aylikci,
      coalesce(sum(t.tutar) filter (where t.ogun_abone_tipi = 'gunluk'), 0) as gunlukcu_tutar
    from public.transactions t
    join public.students s on s.id = t.student_id
    where s.okul_id = p_okul_id
      and t.tarih between p_bas and p_bit
      and t.ogun_abone_tipi is not null
    group by t.tarih
  ),
  serbest as (
    select tarih,
      count(*) filter (where tip = 'ucretli')::int  as ucretli,
      count(*) filter (where tip = 'ogretmen')::int as ogretmen,
      count(*) filter (where tip = 'misafir')::int  as misafir,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0)  as ucretli_tutar,
      coalesce(sum(tutar) filter (where tip = 'ogretmen'), 0) as ogretmen_tutar
    from public.serbest_ogunler
    where okul_id = p_okul_id and tarih between p_bas and p_bit
    group by tarih
  ),
  tahakkuk as (
    select tarih, tutar from public.aylik_tahakkuk(p_okul_id, p_bas, p_bit)
  ),
  -- Tahakkuk günleri de listeye girer: kimse yemese bile o gün ciro var
  gunler as (
    select tarih from ogrenci
    union select tarih from serbest
    union select tarih from tahakkuk
  )
  select
    g.tarih,
    coalesce(o.gunlukcu, 0) + coalesce(o.aylikci, 0)
      + coalesce(s.ucretli, 0) + coalesce(s.ogretmen, 0),
    coalesce(s.misafir, 0),
    round(
      coalesce(o.gunlukcu_tutar, 0)
      + coalesce(s.ucretli_tutar, 0)
      + coalesce(s.ogretmen_tutar, 0)
      + coalesce(th.tutar, 0), 2)
  from gunler g
  left join ogrenci  o  on o.tarih  = g.tarih
  left join serbest  s  on s.tarih  = g.tarih
  left join tahakkuk th on th.tarih = g.tarih
  order by g.tarih;
$$;

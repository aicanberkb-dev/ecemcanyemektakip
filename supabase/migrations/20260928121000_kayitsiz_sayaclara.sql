-- 20260928121000_kayitsiz_sayaclara.sql
--
-- Kayitsiz ogrenciler de yiyen sayisina girsin.
--
-- Mutfak kac tabak cikardigini bilmeli; kayitli olmamasi cocugun yemedigi
-- anlamina gelmiyor. Ucret tahsil edilmedigi icin hicbir para alanina
-- girmez, yalnizca kisi sayisina girer.

drop function if exists public.gun_sonu(uuid, date);
create function public.gun_sonu(p_okul_id uuid, p_tarih date default current_date)
returns table(
  gunlukcu integer, aylikci integer, ucretli integer, misafir integer,
  toplam integer, gunlukcu_tutar numeric, ucretli_tutar numeric, misafir_tutar numeric,
  ogretmen integer, ogretmen_tutar numeric,
  ucretli_nakit integer, ucretli_kart integer,
  ogretmen_nakit integer, ogretmen_kart integer,
  ogun_nakit_tutar numeric, ogun_kart_tutar numeric,
  kasa_giris numeric, kasa_cikis numeric,
  kasa_nakit numeric, kasa_kart numeric,
  kayitsiz integer
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
      count(*) filter (where tip = 'ogretmen' and odeme_yontemi = 'kredi_karti')::int as ogretmen_kart,
      coalesce(sum(tutar) filter (
        where tip in ('ucretli', 'ogretmen') and odeme_yontemi is distinct from 'kredi_karti'
      ), 0) as ogun_nakit_tutar,
      coalesce(sum(tutar) filter (
        where tip in ('ucretli', 'ogretmen') and odeme_yontemi = 'kredi_karti'
      ), 0) as ogun_kart_tutar
    from public.serbest_ogunler
    where tarih = p_tarih and okul_id = p_okul_id
  ),
  kasa as (
    select
      coalesce(sum(tutar) filter (where yon = 'giris'), 0) as giris,
      coalesce(sum(tutar) filter (where yon = 'cikis'), 0) as cikis,
      coalesce(sum(tutar) filter (where yon = 'giris' and odeme_yontemi = 'nakit'), 0) as giris_nakit,
      coalesce(sum(tutar) filter (where yon = 'cikis' and odeme_yontemi = 'nakit'), 0) as cikis_nakit,
      coalesce(sum(tutar) filter (where yon = 'giris' and odeme_yontemi = 'kredi_karti'), 0) as giris_kart,
      coalesce(sum(tutar) filter (where yon = 'cikis' and odeme_yontemi = 'kredi_karti'), 0) as cikis_kart
    from public.kasa_hareketleri
    where tarih = p_tarih and okul_id = p_okul_id
  ),
  kayitsizlar as (
    select count(*)::int as adet
    from public.kayitsiz_ogunler
    where tarih = p_tarih and okul_id = p_okul_id
  )
  select
    ogrenci.gunlukcu, ogrenci.aylikci, serbest.ucretli, serbest.misafir,
    ogrenci.gunlukcu + ogrenci.aylikci + serbest.ucretli + serbest.misafir
      + serbest.ogretmen + kayitsizlar.adet,
    ogrenci.gunlukcu_tutar, serbest.ucretli_tutar, serbest.misafir_tutar,
    serbest.ogretmen, serbest.ogretmen_tutar,
    serbest.ucretli_nakit, serbest.ucretli_kart,
    serbest.ogretmen_nakit, serbest.ogretmen_kart,
    serbest.ogun_nakit_tutar, serbest.ogun_kart_tutar,
    kasa.giris, kasa.cikis,
    serbest.ogun_nakit_tutar + kasa.giris_nakit - kasa.cikis_nakit,
    serbest.ogun_kart_tutar + kasa.giris_kart - kasa.cikis_kart,
    kayitsizlar.adet
  from ogrenci, serbest, kasa, kayitsizlar;
$$;

-- Yemek katilimi: kayitsizlar da o gun yemek yiyen sayisina girer
drop function if exists public.yemek_katilimi(uuid);
create function public.yemek_katilimi(p_okul_id uuid)
returns table(
  ana_yemek text,
  gun_sayisi integer,
  toplam_ogun integer,
  ortalama numeric,
  ogrenci_ogun integer,
  serbest_ogun integer,
  kayitsiz_ogun integer
)
language sql stable set search_path to 'public' as $$
  with gunluk as (
    select
      m.tarih,
      m.ana_yemek,
      (select count(*) from public.transactions t
        join public.students s on s.id = t.student_id
       where s.okul_id = p_okul_id and t.tarih = m.tarih
         and t.ogun_abone_tipi is not null)::int as ogrenci,
      (select count(*) from public.serbest_ogunler o
       where o.okul_id = p_okul_id and o.tarih = m.tarih
         and o.tip in ('ucretli', 'ogretmen'))::int as serbest,
      (select count(*) from public.kayitsiz_ogunler k
       where k.okul_id = p_okul_id and k.tarih = m.tarih)::int as kayitsiz
    from public.menu_gunleri m
    join public.menu_listeleri l on l.id = m.liste_id
    where l.okul_id = p_okul_id and m.ana_yemek is not null and btrim(m.ana_yemek) <> ''
  )
  select
    ana_yemek,
    count(*)::int,
    sum(ogrenci + serbest + kayitsiz)::int,
    round(avg(ogrenci + serbest + kayitsiz)::numeric, 1),
    sum(ogrenci)::int,
    sum(serbest)::int,
    sum(kayitsiz)::int
  from gunluk
  where ogrenci + serbest + kayitsiz > 0
  group by ana_yemek
  order by avg(ogrenci + serbest + kayitsiz) desc, ana_yemek;
$$;

-- Gunluk okul ozeti (Kar/Zarar): kisi sayisina girer, ciroya girmez
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
  kayitsizlar as (
    select tarih, count(*)::int as adet
    from public.kayitsiz_ogunler
    where okul_id = p_okul_id and tarih between p_bas and p_bit
    group by tarih
  ),
  tahakkuk as (
    select tarih, tutar from public.aylik_tahakkuk(p_okul_id, p_bas, p_bit)
  ),
  gunler as (
    select tarih from ogrenci
    union select tarih from serbest
    union select tarih from kayitsizlar
    union select tarih from tahakkuk
  )
  select
    g.tarih,
    coalesce(o.gunlukcu, 0) + coalesce(o.aylikci, 0)
      + coalesce(s.ucretli, 0) + coalesce(s.ogretmen, 0) + coalesce(kz.adet, 0),
    coalesce(s.misafir, 0),
    round(
      coalesce(o.gunlukcu_tutar, 0)
      + coalesce(s.ucretli_tutar, 0)
      + coalesce(s.ogretmen_tutar, 0)
      + coalesce(th.tutar, 0), 2)
  from gunler g
  left join ogrenci    o  on o.tarih  = g.tarih
  left join serbest    s  on s.tarih  = g.tarih
  left join kayitsizlar kz on kz.tarih = g.tarih
  left join tahakkuk   th on th.tarih = g.tarih
  order by g.tarih;
$$;

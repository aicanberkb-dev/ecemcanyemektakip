-- 20260924120000_yemek_katilimi_ucretli.sql
--
-- Yemek katilimi yalnizca ogrenci ogunlerini sayiyordu: gunlukcu ve aylikci
-- tabloya giriyor, ucretli ve ogretmen ogunu hic gorunmuyordu. O gun kac
-- kisinin yedigi sorusunun cevabi eksik cikiyordu.
--
-- Misafir disarida kalir: ucret alinmiyor ve sayisi personel hareketine gore
-- degisiyor, yemegin tutup tutmadigi hakkinda bir sey soylemiyor.
--
-- Kirilim da donuyor ki ekranda toplamin nereden geldigi gorulebilsin.

drop function if exists public.yemek_katilimi(uuid);
create function public.yemek_katilimi(p_okul_id uuid)
returns table(
  ana_yemek text,
  gun_sayisi integer,
  toplam_ogun integer,
  ortalama numeric,
  ogrenci_ogun integer,
  serbest_ogun integer
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
         and o.tip in ('ucretli', 'ogretmen'))::int as serbest
    from public.menu_gunleri m
    join public.menu_listeleri l on l.id = m.liste_id
    where l.okul_id = p_okul_id and m.ana_yemek is not null and btrim(m.ana_yemek) <> ''
  )
  select
    ana_yemek,
    count(*)::int,
    sum(ogrenci + serbest)::int,
    round(avg(ogrenci + serbest)::numeric, 1),
    sum(ogrenci)::int,
    sum(serbest)::int
  from gunluk
  where ogrenci + serbest > 0
  group by ana_yemek
  order by avg(ogrenci + serbest) desc, ana_yemek;
$$;

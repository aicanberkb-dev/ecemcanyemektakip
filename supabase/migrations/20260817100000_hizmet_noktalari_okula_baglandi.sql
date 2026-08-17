-- 20260817100000_hizmet_noktalari_okula_baglandi.sql
--
-- Hizmet noktaları artık okulla eşleşiyor.
--
-- GÖKSU ve AHMET MİTHAT için fiyat da kişi sayısı da zaten sistemin içinde:
-- ücret tarifesi ayarlarda, kaç kişinin yediği gün sonunda. Bunları ikinci
-- kez elle girmek iki kaynağın çatışması demekti. Okula bağlı noktalar
-- verisini kendi okulundan çeker; dışarıdaki noktalar (taşımalı, özel eğitim,
-- kaymakamlık) elle girilir ama artık sabit bir varsayılan kişi sayısı
-- tanımlanabiliyor — her gün aynı sayıyı yazmak yerine bir kez giriliyor,
-- gerektiğinde o gün için değiştirilebiliyor.

alter table public.hizmet_noktalari
  add column if not exists okul_id uuid references public.okullar(id) on delete cascade;

alter table public.hizmet_noktalari
  add column if not exists varsayilan_kisi_sayisi int not null default 0
  check (varsayilan_kisi_sayisi >= 0);

-- Okul eşleşmesi: menü listesi zaten okula bağlı olan noktaları eşle
update public.hizmet_noktalari h
   set okul_id = l.okul_id
  from public.menu_listeleri l
 where h.okul_id is null and l.id = h.liste_id and l.okul_id is not null;

-- ---------------------------------------------------------------------------
-- Okulun günlük özeti: kaç kişi yedi, kaçı misafir, o gün ne kadar ciro oldu
--
-- Misafirden para alınmıyor; ciroya girmez ama yemeği yediği için maliyete
-- girer. Aylıkçı öğrenci öğün başına ödeme yapmadığı için o günün tarifesi
-- üzerinden değerlenir; günlükçü ve ücretli öğünler gerçek tutarlarıyla.
-- ---------------------------------------------------------------------------
create or replace function public.okul_gunluk_ozet(p_okul_id uuid, p_bas date, p_bit date)
returns table (tarih date, kisi integer, misafir integer, ciro numeric)
language sql stable
set search_path = public
as $$
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
      count(*) filter (where tip = 'ucretli')::int as ucretli,
      count(*) filter (where tip = 'misafir')::int as misafir,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0) as ucretli_tutar
    from public.serbest_ogunler
    where okul_id = p_okul_id and tarih between p_bas and p_bit
    group by tarih
  ),
  gunler as (
    select tarih from ogrenci union select tarih from serbest
  )
  select
    g.tarih,
    coalesce(o.gunlukcu, 0) + coalesce(o.aylikci, 0) + coalesce(s.ucretli, 0),
    coalesce(s.misafir, 0),
    round(
      coalesce(o.gunlukcu_tutar, 0)
      + coalesce(o.aylikci, 0) * coalesce(u.taban_gunluk_ucret, 0)
      + coalesce(s.ucretli_tutar, 0), 2)
  from gunler g
  left join ogrenci o on o.tarih = g.tarih
  left join serbest s on s.tarih = g.tarih
  left join lateral public.ucretler(p_okul_id, g.tarih) u on true
  order by g.tarih;
$$;

revoke execute on function public.okul_gunluk_ozet(uuid, date, date) from public, anon;
grant execute on function public.okul_gunluk_ozet(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Kâr / zarar — iki kaynağı birleştirir
-- ---------------------------------------------------------------------------
drop function if exists public.kar_zarar(date, date);
create function public.kar_zarar(p_bas date, p_bit date)
returns table (
  hizmet_noktasi text,
  kaynak         text,
  gun_sayisi     integer,
  toplam_kisi    integer,
  misafir        integer,
  ciro           numeric,
  maliyet        numeric,
  kar            numeric,
  kisi_basi_kar  numeric
)
language sql stable
set search_path = public
as $$
  with noktalar as (
    select id, ad, liste_id, okul_id, varsayilan_kisi_sayisi
    from public.hizmet_noktalari where aktif
  ),
  -- Okula bağlı noktalar: veri gün sonundan gelir
  okul_gunler as (
    select n.ad as nokta, n.liste_id, o.tarih, o.kisi, o.misafir, o.ciro,
           'okul'::text as kaynak
    from noktalar n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.okul_id is not null
  ),
  -- Dışarıdaki noktalar: menüsü olan her gün varsayılan sayı, girilmişse o
  manuel_tarihler as (
    select n.id as nokta_id, m.tarih
    from noktalar n
    join public.menu_gunleri m on m.liste_id = n.liste_id
    where n.okul_id is null and m.tarih between p_bas and p_bit
    union
    select g.hizmet_noktasi_id, g.tarih
    from public.gunluk_hizmet g
    join noktalar n on n.id = g.hizmet_noktasi_id
    where n.okul_id is null and g.tarih between p_bas and p_bit
  ),
  manuel_gunler as (
    select
      n.ad as nokta, n.liste_id, d.tarih,
      coalesce(g.kisi_sayisi, n.varsayilan_kisi_sayisi) as kisi,
      0 as misafir,
      round(coalesce(g.kisi_sayisi, n.varsayilan_kisi_sayisi) * coalesce((
        select f.kisi_basi_fiyat from public.hizmet_fiyatlari f
        where f.hizmet_noktasi_id = n.id and f.gecerli_baslangic <= d.tarih
        order by f.gecerli_baslangic desc limit 1
      ), 0), 2) as ciro,
      'manuel'::text as kaynak
    from noktalar n
    join manuel_tarihler d on d.nokta_id = n.id
    left join public.gunluk_hizmet g
      on g.hizmet_noktasi_id = n.id and g.tarih = d.tarih
    where n.okul_id is null
  ),
  tum as (
    select * from okul_gunler
    union all
    select * from manuel_gunler
  )
  select
    nokta,
    min(kaynak),
    count(*) filter (where kisi + misafir > 0)::int,
    sum(kisi)::int,
    sum(misafir)::int,
    round(sum(ciro), 2),
    round(sum((kisi + misafir) * coalesce(public.gun_maliyeti(liste_id, tarih), 0)), 2),
    round(sum(ciro) - sum((kisi + misafir) * coalesce(public.gun_maliyeti(liste_id, tarih), 0)), 2),
    case when sum(kisi) > 0 then round(
      (sum(ciro) - sum((kisi + misafir) * coalesce(public.gun_maliyeti(liste_id, tarih), 0)))
      / sum(kisi), 2) else 0 end
  from tum
  group by nokta
  having sum(kisi) + sum(misafir) > 0
  order by nokta;
$$;

revoke execute on function public.kar_zarar(date, date) from public, anon;
grant execute on function public.kar_zarar(date, date) to authenticated;

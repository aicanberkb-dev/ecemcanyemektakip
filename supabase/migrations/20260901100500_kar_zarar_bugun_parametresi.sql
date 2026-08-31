-- 20260901100500_kar_zarar_bugun_parametresi.sql
--
-- Kâr/zarar "bugün"ü dışarıdan alabilsin.
--
-- Fonksiyonun içinde current_date sabitti; sezon öncesinde sistemi denemek
-- imkânsızdı çünkü ileri tarihli hiçbir gün hesaba girmiyordu. Diğer bütün
-- fonksiyonlar tarihi zaten parametre olarak alıyordu (yemek_kaydet,
-- gun_sonu, taksit_durumu, ogrenci_hakedis...), tek istisna buydu.
--
-- Uygulama tarafında simülasyon tarihi bir çerezde duruyor; sunucu onu
-- p_bugun olarak geçiyor. Varsayılan gerçek bugün, yani simülasyon kapalıyken
-- davranış değişmiyor.

drop function if exists public.kar_zarar(date, date);
create function public.kar_zarar(p_bas date, p_bit date, p_bugun date default current_date)
returns table (
  hizmet_noktasi     text,
  kaynak             text,
  gun_sayisi         integer,
  is_gunu            integer,
  toplam_kisi        integer,
  misafir            integer,
  cikan_porsiyon     integer,
  ciro               numeric,
  malzeme_maliyeti   numeric,
  genel_gider        numeric,
  toplam_maliyet     numeric,
  kar                numeric,
  kisi_basi_maliyet  numeric,
  kisi_basi_kar      numeric,
  cikansiz_gun       integer
)
language sql stable
set search_path = public
as $$
  with noktalar as (
    select id, ad, liste_id, okul_id, varsayilan_kisi_sayisi, varsayilan_cikan_porsiyon
    from public.hizmet_noktalari where aktif
  ),
  is_gunu as (
    select n.id as nokta_id, g.tarih
    from noktalar n
    cross join lateral public.nokta_hizmet_gunleri(n.id, p_bas, p_bit) g
    where g.tarih <= p_bugun
  ),
  okul_veri as (
    select n.id as nokta_id, o.tarih, o.kisi, o.misafir, o.ciro
    from noktalar n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.okul_id is not null
  ),
  birlesik as (
    select
      n.id as nokta_id, n.ad as nokta, n.liste_id, n.okul_id,
      n.varsayilan_kisi_sayisi, n.varsayilan_cikan_porsiyon,
      ig.tarih,
      case when n.okul_id is not null then coalesce(ov.kisi, 0)
           else coalesce(gh.kisi_sayisi, n.varsayilan_kisi_sayisi) end as kisi,
      case when n.okul_id is not null then coalesce(ov.misafir, 0) else 0 end as misafir,
      case when n.okul_id is not null then coalesce(ov.ciro, 0)
           else round(coalesce(gh.kisi_sayisi, n.varsayilan_kisi_sayisi) * coalesce((
             select f.kisi_basi_fiyat from public.hizmet_fiyatlari f
             where f.hizmet_noktasi_id = n.id and f.gecerli_baslangic <= ig.tarih
             order by f.gecerli_baslangic desc limit 1
           ), 0), 2) end as ciro,
      case when n.okul_id is not null then 'okul'::text else 'manuel'::text end as kaynak
    from is_gunu ig
    join noktalar n on n.id = ig.nokta_id
    left join okul_veri ov on ov.nokta_id = n.id and ov.tarih = ig.tarih
    left join public.gunluk_hizmet gh
      on gh.hizmet_noktasi_id = n.id and gh.tarih = ig.tarih
  ),
  gunler as (
    select
      b.nokta_id, b.nokta, b.kaynak, b.tarih, b.kisi, b.misafir, b.ciro,
      b.kisi + b.misafir as yiyen,
      c.porsiyon as cikan,
      c.maliyet,
      (not c.girilmis
        and (b.okul_id is not null or b.varsayilan_cikan_porsiyon = 0)
        and b.kisi + b.misafir > 0) as cikan_bilinmiyor
    from birlesik b
    cross join lateral public.gun_cikan(
      b.nokta_id, b.liste_id, b.tarih,
      case when b.okul_id is not null then 0
           else coalesce(nullif(b.varsayilan_cikan_porsiyon, 0), b.kisi + b.misafir) end) c
  ),
  ay_gider as (
    select a.nokta_id, a.ay_bas, o.gunluk_gider
    from (select distinct nokta_id, date_trunc('month', tarih)::date as ay_bas
            from gunler) a
    cross join lateral public.aylik_gider_ozeti(
      a.nokta_id,
      extract(year from a.ay_bas)::int,
      extract(month from a.ay_bas)::int) o
  ),
  gunluk as (
    select g.*, coalesce(ag.gunluk_gider, 0) as gider_payi
    from gunler g
    left join ay_gider ag
      on ag.nokta_id = g.nokta_id
     and ag.ay_bas = date_trunc('month', g.tarih)::date
  )
  select
    nokta,
    min(kaynak),
    count(*) filter (where yiyen > 0 or cikan > 0)::int,
    count(*)::int,
    sum(kisi)::int,
    sum(misafir)::int,
    sum(cikan)::int,
    round(sum(ciro), 2),
    round(sum(maliyet), 2),
    round(sum(gider_payi), 2),
    round(sum(maliyet) + sum(gider_payi), 2),
    round(sum(ciro) - sum(maliyet) - sum(gider_payi), 2),
    case when sum(yiyen) > 0
      then round((sum(maliyet) + sum(gider_payi)) / sum(yiyen), 2) else 0 end,
    case when sum(yiyen) > 0
      then round((sum(ciro) - sum(maliyet) - sum(gider_payi)) / sum(yiyen), 2) else 0 end,
    count(*) filter (where cikan_bilinmiyor)::int
  from gunluk
  group by nokta
  having sum(yiyen) + sum(cikan) + sum(gider_payi) > 0
  order by nokta;
$$;

revoke execute on function public.kar_zarar(date, date, date) from public, anon;
grant execute on function public.kar_zarar(date, date, date) to authenticated;

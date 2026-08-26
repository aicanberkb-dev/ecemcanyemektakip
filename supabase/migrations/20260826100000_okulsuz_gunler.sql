-- 20260826100000_okulsuz_gunler.sql
--
-- "Okul yok" günleri ve iş günü kavramı.
--
-- İki ayrı sorunu birlikte çözer:
--
-- 1) Hafta sonu her zaman kapalıdır. Kâr/zarar tablosunda cumartesi-pazar
--    satırları çıkıyordu, çünkü o günlere yanlışlıkla yemek kaydı girilmişti.
--    Artık gün kümesi hafta içinden üretilir; hafta sonu kaydı hesaba girmez.
--
-- 2) Resmi tatil ve gezi günleri. Hafta içi olduğu hâlde okulun olmadığı
--    günler elle işaretlenir. Nokta boş bırakılırsa gün tüm yerlerde kapalı
--    sayılır (resmi tatil); nokta verilirse yalnızca o yerde (gezi).
--
-- Genel giderin böleni buradan çıkar: ayın iş günü = hafta içi günler eksi
-- okulsuz günler. 100.000 TL / 20 iş günü = her iş gününe 5.000 TL. Bölen
-- ayın tamamıdır, bugüne kadarki kısmı değil — yoksa ayın başında günlük
-- gider olduğundan yüksek çıkardı. Yapıştırma ise yalnızca bugüne kadar
-- yapılır, geleceğe dönük gider yazılmaz.

create table if not exists public.okulsuz_gunler (
  id                 uuid primary key default gen_random_uuid(),
  tarih              date not null,
  -- null = tüm hizmet yerleri (resmi tatil)
  hizmet_noktasi_id  uuid references public.hizmet_noktalari(id) on delete cascade,
  sebep              text,
  olusturma          timestamptz not null default now()
);

-- Aynı gün iki kez işaretlenmesin. null nokta ayrı bir kayıt sayıldığı için
-- iki kısmi indeks gerekiyor.
create unique index if not exists okulsuz_gunler_genel_benzersiz
  on public.okulsuz_gunler (tarih) where hizmet_noktasi_id is null;
create unique index if not exists okulsuz_gunler_nokta_benzersiz
  on public.okulsuz_gunler (tarih, hizmet_noktasi_id) where hizmet_noktasi_id is not null;

alter table public.okulsuz_gunler enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'okulsuz_gunler' and policyname = 'okulsuz_gunler_hepsi'
  ) then
    create policy okulsuz_gunler_hepsi on public.okulsuz_gunler
      to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bir yerin iş günleri: hafta içi, okulsuz işaretlenmemiş
--
-- Eski tanım "yemek kaydı olan gün" idi. O tanım genel gideri bozuyordu:
-- ayın 13 gününe kayıt girilmişse 100.000 TL 13'e bölünüyor, günlük gider
-- 7.692 TL çıkıyordu. Oysa okul 21 gün açıktı; kimsenin yemediği gün de
-- kiranın ve maaşın işlediği bir iş günüdür.
-- ---------------------------------------------------------------------------
create or replace function public.nokta_hizmet_gunleri(
  p_nokta_id uuid, p_bas date, p_bit date
)
returns table (tarih date)
language sql stable
set search_path = public
as $$
  select d::date
  from generate_series(p_bas, p_bit, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (
      select 1 from public.okulsuz_gunler o
      where o.tarih = d::date
        and (o.hizmet_noktasi_id is null or o.hizmet_noktasi_id = p_nokta_id)
    )
  order by 1;
$$;

revoke execute on function public.nokta_hizmet_gunleri(uuid, date, date) from public, anon;
grant execute on function public.nokta_hizmet_gunleri(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Kâr / zarar
--
-- Gün kümesi artık iş gününden üretiliyor, yemek kaydından değil. Böylece
-- menüsü olan ama kimsenin yemediği gün de tabloda görünür ve o günün genel
-- gideri yazılır — gerçek maliyet budur.
-- ---------------------------------------------------------------------------
drop function if exists public.kar_zarar(date, date);
create function public.kar_zarar(p_bas date, p_bit date)
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
  -- Ayın iş günleri, yer yer. Bugünden sonrası hesaba girmez.
  is_gunu as (
    select n.id as nokta_id, g.tarih
    from noktalar n
    cross join lateral public.nokta_hizmet_gunleri(n.id, p_bas, p_bit) g
    where g.tarih <= current_date
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
  -- Her yer ve her ay için o yerin günlük genel gideri. Bölen ayın tamamı.
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

revoke execute on function public.kar_zarar(date, date) from public, anon;
grant execute on function public.kar_zarar(date, date) to authenticated;

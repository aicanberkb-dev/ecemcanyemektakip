-- 20260817110100_kar_zarar_cikan_porsiyondan.sql
--
-- Kâr/zarar: maliyet çıkan porsiyondan, ciro yiyen kişiden.
--
-- Çıkan porsiyon hiç girilmemişse maliyet yiyen kişiden hesaplanmaya devam
-- eder ama bu eksik bir hesaptır; kaç günün çıkanı bilinmiyorsa rapor bunu
-- ayrı bir kolonda söyler ki sessizce olduğundan kârlı görünmesin.

drop function if exists public.kar_zarar(date, date);
create function public.kar_zarar(p_bas date, p_bit date)
returns table (
  hizmet_noktasi  text,
  mutfak          text,
  kaynak          text,
  gun_sayisi      integer,
  toplam_kisi     integer,
  misafir         integer,
  cikan           integer,
  fire_porsiyon   integer,
  ciro            numeric,
  maliyet         numeric,
  fire_tutar      numeric,
  kar             numeric,
  kisi_basi_kar   numeric,
  kisi_basi_maliyet numeric,
  cikansiz_gun    integer
)
language sql stable
set search_path = public
as $$
  with noktalar as (
    select h.id, h.ad, h.liste_id, h.okul_id, h.varsayilan_kisi_sayisi,
           h.varsayilan_cikan_porsiyon, coalesce(m.ad, '—') as mutfak
    from public.hizmet_noktalari h
    left join public.mutfaklar m on m.id = h.mutfak_id
    where h.aktif
  ),
  -- Okula bağlı noktalar: yiyen gün sonundan
  okul_gunler as (
    select n.id as nokta_id, n.ad as nokta, n.mutfak, n.liste_id,
           n.varsayilan_cikan_porsiyon, o.tarih, o.kisi, o.misafir, o.ciro,
           'okul'::text as kaynak
    from noktalar n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.okul_id is not null
  ),
  -- Dış hizmet noktaları: bugüne kadarki hafta içi günler + elle girilenler
  manuel_tarihler as (
    select n.id as nokta_id, d::date as tarih
    from noktalar n
    cross join generate_series(p_bas, least(p_bit, current_date), interval '1 day') d
    where n.okul_id is null and extract(isodow from d) < 6
    union
    select g.hizmet_noktasi_id, g.tarih
    from public.gunluk_hizmet g
    join noktalar n on n.id = g.hizmet_noktasi_id
    where n.okul_id is null and g.tarih between p_bas and p_bit
  ),
  manuel_gunler as (
    select
      n.id as nokta_id, n.ad as nokta, n.mutfak, n.liste_id,
      n.varsayilan_cikan_porsiyon, d.tarih,
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
  birlesik as (
    select * from okul_gunler
    union all
    select * from manuel_gunler
  ),
  gunler as (
    select
      b.nokta, b.mutfak, b.kaynak, b.liste_id, b.tarih,
      b.kisi, b.misafir, b.ciro,
      b.kisi + b.misafir as yiyen,
      -- Çıkan: o güne girilen, yoksa yerin varsayılanı, o da yoksa yiyen
      coalesce(
        g.cikan_porsiyon,
        nullif(b.varsayilan_cikan_porsiyon, 0),
        b.kisi + b.misafir
      ) as cikan,
      (g.cikan_porsiyon is null and b.varsayilan_cikan_porsiyon = 0
        and b.kisi + b.misafir > 0) as cikan_bilinmiyor
    from birlesik b
    left join public.gunluk_hizmet g
      on g.hizmet_noktasi_id = b.nokta_id and g.tarih = b.tarih
  )
  select
    nokta,
    min(mutfak),
    min(kaynak),
    count(*) filter (where yiyen > 0 or cikan > 0)::int,
    sum(kisi)::int,
    sum(misafir)::int,
    sum(cikan)::int,
    (sum(cikan) - sum(yiyen))::int,
    round(sum(ciro), 2),
    round(sum(cikan * coalesce(public.gun_maliyeti(liste_id, tarih), 0)), 2),
    round(sum((cikan - yiyen) * coalesce(public.gun_maliyeti(liste_id, tarih), 0)), 2),
    round(sum(ciro) - sum(cikan * coalesce(public.gun_maliyeti(liste_id, tarih), 0)), 2),
    case when sum(yiyen) > 0 then round(
      (sum(ciro) - sum(cikan * coalesce(public.gun_maliyeti(liste_id, tarih), 0))) / sum(yiyen), 2)
      else 0 end,
    case when sum(yiyen) > 0 then round(
      sum(cikan * coalesce(public.gun_maliyeti(liste_id, tarih), 0)) / sum(yiyen), 2)
      else 0 end,
    count(*) filter (where cikan_bilinmiyor)::int
  from gunler
  group by nokta
  having sum(yiyen) + sum(cikan) > 0
  order by nokta;
$$;

revoke execute on function public.kar_zarar(date, date) from public, anon;
grant execute on function public.kar_zarar(date, date) to authenticated;

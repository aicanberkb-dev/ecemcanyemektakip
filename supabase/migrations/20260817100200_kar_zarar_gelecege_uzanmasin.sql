-- 20260817100200_kar_zarar_gelecege_uzanmasin.sql
--
-- Dış hizmet yerlerinin sabit kişi sayısı geleceğe uygulanmıyor.
--
-- Ayın 17'sinde bakıldığında ay sonuna kadar her gün 50 kişi yemiş gibi
-- görünüyordu; henüz olmamış günlerin cirosu ve maliyeti de toplama giriyordu.
-- Artık sabit sayı yalnızca bugüne kadarki günlere uygulanır, gün ilerledikçe
-- kendiliğinden eklenir. İleri tarih için sayı biliniyorsa elle girilebilir;
-- elle girilen gün her hâlükârda sayılır.

create or replace function public.kar_zarar(p_bas date, p_bit date)
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
  okul_gunler as (
    select n.ad as nokta, n.liste_id, o.tarih, o.kisi, o.misafir, o.ciro,
           'okul'::text as kaynak
    from noktalar n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.okul_id is not null
  ),
  manuel_tarihler as (
    -- Bugüne kadarki hafta içi günler
    select n.id as nokta_id, d::date as tarih
    from noktalar n
    cross join generate_series(p_bas, least(p_bit, current_date), interval '1 day') d
    where n.okul_id is null and extract(isodow from d) < 6
    union
    -- Elle girilmiş günler (ileri tarih ya da hafta sonu olsa da dahil)
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

-- 20260818120000_okullarda_porsiyon_onerilmesin.sql
--
-- Kendi okullarımızda çıkan porsiyon tahmin edilmiyor.
--
-- Yemekhane o gün kaç kişilik çıktığını biliyor ve giriyor. Sistemin yiyen
-- kişiden ya da sabit bir sayıdan tahmin yürütmesi, girilmiş veriyle
-- karışıyor ve hangi rakamın gerçek olduğu anlaşılmıyordu. Okula bağlı
-- noktalarda artık yalnızca girilen porsiyon sayılır; dış hizmet yerlerinde
-- sabit porsiyon geçerli kalır, çünkü oralara her gün aynı miktar gidiyor.

update public.hizmet_noktalari
   set varsayilan_cikan_porsiyon = 0
 where okul_id is not null;

create or replace function public.kar_zarar(p_bas date, p_bit date)
returns table (
  hizmet_noktasi    text,
  kaynak            text,
  gun_sayisi        integer,
  toplam_kisi       integer,
  misafir           integer,
  cikan_porsiyon    integer,
  ciro              numeric,
  maliyet           numeric,
  kar               numeric,
  kisi_basi_kar     numeric,
  kisi_basi_maliyet numeric,
  cikansiz_gun      integer
)
language sql stable
set search_path = public
as $$
  with noktalar as (
    select id, ad, liste_id, okul_id, varsayilan_kisi_sayisi, varsayilan_cikan_porsiyon
    from public.hizmet_noktalari where aktif
  ),
  okul_gunler as (
    select n.id as nokta_id, n.ad as nokta, n.liste_id, n.okul_id,
           n.varsayilan_cikan_porsiyon,
           o.tarih, o.kisi, o.misafir, o.ciro, 'okul'::text as kaynak
    from noktalar n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.okul_id is not null
  ),
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
      n.id as nokta_id, n.ad as nokta, n.liste_id, n.okul_id,
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
      b.nokta, b.kaynak, b.tarih, b.kisi, b.misafir, b.ciro,
      b.kisi + b.misafir as yiyen,
      c.porsiyon as cikan,
      c.maliyet,
      -- Porsiyon girilmemişse hesap eksiktir; dış yerlerde sabit porsiyon
      -- devreye girdiği için yalnızca o da yoksa eksik sayılır.
      (not c.girilmis
        and (b.okul_id is not null or b.varsayilan_cikan_porsiyon = 0)
        and b.kisi + b.misafir > 0) as cikan_bilinmiyor
    from birlesik b
    cross join lateral public.gun_cikan(
      b.nokta_id, b.liste_id, b.tarih,
      -- Okullarda tahmin yok: girilmeyen kalem 0
      case when b.okul_id is not null then 0
           else coalesce(nullif(b.varsayilan_cikan_porsiyon, 0), b.kisi + b.misafir) end
    ) c
  )
  select
    nokta,
    min(kaynak),
    count(*) filter (where yiyen > 0 or cikan > 0)::int,
    sum(kisi)::int,
    sum(misafir)::int,
    sum(cikan)::int,
    round(sum(ciro), 2),
    round(sum(maliyet), 2),
    round(sum(ciro) - sum(maliyet), 2),
    case when sum(yiyen) > 0
         then round((sum(ciro) - sum(maliyet)) / sum(yiyen), 2) else 0 end,
    case when sum(yiyen) > 0 then round(sum(maliyet) / sum(yiyen), 2) else 0 end,
    count(*) filter (where cikan_bilinmiyor)::int
  from gunler
  group by nokta
  having sum(yiyen) + sum(cikan) > 0
  order by nokta;
$$;

revoke execute on function public.kar_zarar(date, date) from public, anon;
grant execute on function public.kar_zarar(date, date) to authenticated;

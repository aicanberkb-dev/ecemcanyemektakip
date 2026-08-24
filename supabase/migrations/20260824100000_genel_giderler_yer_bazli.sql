-- 20260824100000_genel_giderler_yer_bazli.sql
--
-- Genel giderler: maaş, sigorta, kira, mazot ve diğerleri.
--
-- Malzeme maliyeti tek başına gerçek maliyet değil. Her hizmet yerinin kendi
-- personeli ve kendi sabit giderleri var: birinde üç kişi çalışıyor,
-- diğerinde hiç yok; birinde kira ödeniyor, diğerinde ödenmiyor. Bu yüzden
-- gider doğrudan yere yazılır, yerler arasında dağıtılmaz.
--
-- Yerin aylık gideri, o ay o yere hizmet verilen gün sayısına bölünür ve
-- günün maliyetine eklenir.

alter table public.donemsel_giderler
  add column if not exists kategori text not null default 'diger';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'donemsel_giderler_kategori_kontrol'
  ) then
    alter table public.donemsel_giderler
      add constraint donemsel_giderler_kategori_kontrol
      check (kategori in ('maas', 'sgk', 'kira', 'mazot', 'diger'));
  end if;
end $$;

update public.donemsel_giderler set kategori = 'sgk'
 where kategori = 'diger' and upper(tur) in ('SSK', 'SGK');

alter table public.donemsel_giderler
  add column if not exists hizmet_noktasi_id uuid
  references public.hizmet_noktalari(id) on delete cascade;

alter table public.personeller
  add column if not exists hizmet_noktasi_id uuid
  references public.hizmet_noktalari(id) on delete set null;

create index if not exists donemsel_giderler_nokta_donem_idx
  on public.donemsel_giderler (hizmet_noktasi_id, donem_yil, donem_ay);

-- Adı birebir tutan personelleri otomatik eşle; kalanı kullanıcı seçer
update public.personeller p set hizmet_noktasi_id = h.id
from public.hizmet_noktalari h
where p.hizmet_noktasi_id is null and upper(p.calistigi_yer) = upper(h.ad);

-- ---------------------------------------------------------------------------
-- Bir yere hizmet verilen günler
-- ---------------------------------------------------------------------------
create or replace function public.nokta_hizmet_gunleri(
  p_nokta_id uuid, p_bas date, p_bit date
)
returns table (tarih date)
language sql stable
set search_path = public
as $$
  select distinct g.tarih from (
    select o.tarih
    from public.hizmet_noktalari n
    cross join lateral public.okul_gunluk_ozet(n.okul_id, p_bas, p_bit) o
    where n.id = p_nokta_id and n.okul_id is not null and o.kisi + o.misafir > 0
    union
    select d::date
    from public.hizmet_noktalari n
    cross join generate_series(p_bas, least(p_bit, current_date), interval '1 day') d
    where n.id = p_nokta_id and n.okul_id is null
      and extract(isodow from d) < 6
      and coalesce(nullif(n.varsayilan_cikan_porsiyon, 0), n.varsayilan_kisi_sayisi) > 0
  ) g
  order by 1;
$$;

revoke execute on function public.nokta_hizmet_gunleri(uuid, date, date) from public, anon;
grant execute on function public.nokta_hizmet_gunleri(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Bir yerin aylık gider özeti
--
-- Maaş, o yere bağlı personelin kartlarından hesaplanır; o dönem için gerçek
-- ödeme girilmişse o esas alınır. Diğer kalemler elle girilir.
-- ---------------------------------------------------------------------------
create or replace function public.aylik_gider_ozeti(p_nokta_id uuid, p_yil int, p_ay int)
returns table (
  maas          numeric,
  sgk           numeric,
  kira          numeric,
  mazot         numeric,
  diger         numeric,
  toplam        numeric,
  hizmet_gunu   integer,
  gunluk_gider  numeric
)
language sql stable
set search_path = public
as $$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as bit
  ),
  personel_maas as (
    select coalesce(sum(
      coalesce(
        (select o.tutar from public.maas_odemeleri o
          where o.personel_id = p.id and o.donem_yil = p_yil and o.donem_ay = p_ay),
        (select u.tutar from public.personel_ucretleri u
          where u.personel_id = p.id and u.gecerli_baslangic <= (select bit from sinir)
          order by u.gecerli_baslangic desc limit 1),
        0)
    ), 0) as tutar
    from public.personeller p
    where p.aktif and p.hizmet_noktasi_id = p_nokta_id
  ),
  elle as (
    select
      coalesce(sum(tutar) filter (where kategori = 'maas'), 0)  as maas,
      coalesce(sum(tutar) filter (where kategori = 'sgk'), 0)   as sgk,
      coalesce(sum(tutar) filter (where kategori = 'kira'), 0)  as kira,
      coalesce(sum(tutar) filter (where kategori = 'mazot'), 0) as mazot,
      coalesce(sum(tutar) filter (where kategori = 'diger'), 0) as diger
    from public.donemsel_giderler
    where donem_yil = p_yil and donem_ay = p_ay
      and hizmet_noktasi_id = p_nokta_id
  ),
  gun as (
    select count(*)::int as adet
    from public.nokta_hizmet_gunleri(
      p_nokta_id, (select bas from sinir), (select bit from sinir))
  )
  select
    pm.tutar + e.maas, e.sgk, e.kira, e.mazot, e.diger,
    pm.tutar + e.maas + e.sgk + e.kira + e.mazot + e.diger,
    g.adet,
    case when g.adet > 0
      then round((pm.tutar + e.maas + e.sgk + e.kira + e.mazot + e.diger) / g.adet, 2)
      else 0 end
  from personel_maas pm, elle e, gun g;
$$;

revoke execute on function public.aylik_gider_ozeti(uuid, int, int) from public, anon;
grant execute on function public.aylik_gider_ozeti(uuid, int, int) to authenticated;

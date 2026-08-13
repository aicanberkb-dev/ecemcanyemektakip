-- 20260806100300_arama_turkce_bagimsiz.sql
--
-- POS aramasında Türkçe karakter bağımsızlığı.
--
-- Kullanıcı yemekhanede hızlı yazıyor: "omer" yazınca "Ömer", "citlak" yazınca
-- "Çıtlak" bulunmalı. Bunun için hem aranan terim hem de hedef alanlar ortak
-- bir sadeleştirmeden geçirilir. Uygulama tarafındaki lib/arama.ts ile aynı
-- kuralları uygular; ikisi ayrışırsa arama sonuçları ekrandan ekrana değişir.

create or replace function public.arama_sadelestir(p_metin text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  -- Önce harf çevirisi, SONRA küçültme. Ters sırada 'İ' harfi lower() ile
  -- 'i' + birleşik nokta olarak iki karaktere ayrılıyor ve translate tutmuyor;
  -- "seniha" araması "SENİHA KELEŞ"i bulamaz hale geliyor.
  select lower(
           translate(coalesce(p_metin, ''), 'ıİşŞğĞüÜöÖçÇ', 'iIsSgGuUoOcC')
         )
$$;

comment on function public.arama_sadelestir(text) is
  'Aramada karsilastirma icin metni sadelestirir: kucuk harf + Turkce karakterlerin ASCII karsiligi.';

-- Sadeleştirilmiş ada göre arama indeksi
create index if not exists students_ad_sade_idx
  on public.students (public.arama_sadelestir(ad_soyad));

create or replace function public.pos_ara(
  p_okul_id uuid,
  p_terim   text,
  p_tarih   date default current_date,
  p_limit   integer default 15
)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text, kimlik_no text,
  abone_tipi public.abone_tipi, kalan numeric, gunluk_ucret numeric,
  bugun_yedi boolean, tam_eslesme boolean
)
language sql stable
set search_path = public
as $$
  with terim as (
    select btrim(coalesce(p_terim, '')) as t,
           public.arama_sadelestir(btrim(coalesce(p_terim, ''))) as sade
  )
  select
    b.student_id, b.ogrenci_no, b.ad_soyad, b.sinif, b.kimlik_no,
    b.abone_tipi, b.kalan, b.gunluk_ucret,
    exists (
      select 1 from public.transactions tr
      where tr.student_id = b.student_id
        and tr.tarih = p_tarih
        and tr.ogun_abone_tipi is not null
    ) as bugun_yedi,
    (b.ogrenci_no = (select t from terim) or b.kimlik_no = (select t from terim)) as tam_eslesme
  from public.student_balances b, terim
  where b.okul_id = p_okul_id
    and terim.t <> ''
    and b.aktif
    and (
      b.ogrenci_no ilike '%' || terim.t || '%'
      or public.arama_sadelestir(b.ad_soyad) like '%' || terim.sade || '%'
      or coalesce(b.kimlik_no, '') ilike '%' || terim.t || '%'
      -- Veli adından da bulunabilsin: veli parayı yatırırken adını söylüyor
      or public.arama_sadelestir(coalesce(b.veli_adi, '')) like '%' || terim.sade || '%'
      or public.arama_sadelestir(coalesce(b.veli2_adi, '')) like '%' || terim.sade || '%'
    )
  order by
    (b.ogrenci_no = (select t from terim) or b.kimlik_no = (select t from terim)) desc,
    b.ad_soyad
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

revoke execute on function public.pos_ara(uuid, text, date, integer) from public, anon;
grant execute on function public.pos_ara(uuid, text, date, integer) to authenticated;

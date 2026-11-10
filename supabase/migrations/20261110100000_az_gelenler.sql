-- ---------------------------------------------------------------------------
-- az_gelenler — sezon başından bugüne devam oranı düşük aylıkçı öğrenciler
--
-- Taksit dönemi başlarken veliye haber verilecek öğrencileri bulmak için.
-- Devam Çizelgesi tek bir ayı gün gün gösteriyor; buradaki soru başka:
-- "sezon boyunca kim neredeyse hiç gelmedi". Oran sıralı tek liste veriyor.
--
-- Yalnız aylıkçılar var. Günlükçünün devamı sorun değil: gelmediği gün
-- ücret de işlemiyor, parasını yemek başına ödüyor. Aylıkçı gelmese de
-- taksidi işliyor, veliyle konuşulacak olan o.
--
-- Payda "okulun gerçekten yemek verdiği gün": sezon içindeki ders günü olup
-- en az bir öğün kaydı düşülmüş günler. Takvimdeki bütün ders günleri
-- sayılsaydı servis başlamadan önceki günler (GÖKSU'da sezon 7 Eylül'de
-- açıldı, ilk yemek 15 Eylül) herkese devamsızlık yazardı.
--
-- Pay da aynı kümeden sayılır: öğrencinin o günlerde kaydı var mı. Böylece
-- hafta sonuna ya da tatile düşmüş bir kayıt oranı %100'ün üstüne çıkarmaz.
--
-- Ölçüm öğrenci başına, aylık aboneliğinin başladığı günden başlar; sonradan
-- kaydolan ya da günlükçüden aylıkçıya geçen öğrenci, gelmediği günlerden
-- değil, abone olmadığı günlerden ötürü düşük görünmesin.
-- ---------------------------------------------------------------------------

create or replace function public.az_gelenler(p_okul_id uuid)
returns table(
  student_id uuid,
  ogrenci_no text,
  ad_soyad text,
  sinif text,
  ogrenci_tipi ogrenci_tipi,
  veli_adi text,
  veli_telefon text,
  veli2_adi text,
  veli2_telefon text,
  deneme boolean,
  olcum_baslangici date,
  gelis integer,
  ders_gunu integer,
  oran numeric,
  son_gelis date,
  kalan numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with sezon as (
    select z.baslangic,
           least(coalesce(z.bitis, current_date), current_date) as bitis
    from public.sezonlar z
    where z.okul_id = p_okul_id and z.aktif
    order by z.baslangic desc
    limit 1
  ),
  -- Okulun yemek verdiği günler
  hizmet as (
    select distinct t.tarih
    from public.transactions t
    join public.students st on st.id = t.student_id
    cross join sezon
    where st.okul_id = p_okul_id
      and t.ogun_abone_tipi is not null
      and t.tarih between sezon.baslangic and sezon.bitis
      and extract(isodow from t.tarih) < 6
      and not public.okul_kapali(p_okul_id, t.tarih)
  ),
  ogrenci as (
    select
      s.*,
      greatest(
        (select sezon.baslangic from sezon),
        coalesce(
          (select a.baslangic
             from public.abonelik_donemleri a
            where a.student_id = s.id and a.tip = 'aylik'
            order by a.baslangic desc
            limit 1),
          s.created_at::date
        )
      ) as olcum_baslangici
    from public.students s
    where s.okul_id = p_okul_id
      and s.aktif
      and s.abone_tipi = 'aylik'
  ),
  sayim as (
    select
      o.id,
      (select count(*)::int
         from hizmet h
        where h.tarih >= o.olcum_baslangici) as ders_gunu,
      (select count(*)::int
         from hizmet h
        where h.tarih >= o.olcum_baslangici
          and exists (
            select 1 from public.transactions t
             where t.student_id = o.id
               and t.tarih = h.tarih
               and t.ogun_abone_tipi is not null
          )) as gelis,
      (select max(t.tarih)
         from public.transactions t
        where t.student_id = o.id
          and t.ogun_abone_tipi is not null) as son_gelis
    from ogrenci o
  )
  select
    o.id,
    o.ogrenci_no,
    o.ad_soyad,
    o.sinif,
    o.ogrenci_tipi,
    o.veli_adi,
    o.veli_telefon,
    o.veli2_adi,
    o.veli2_telefon,
    o.deneme,
    o.olcum_baslangici,
    s.gelis,
    s.ders_gunu,
    -- Ölçülecek günü olmayan öğrencide oran yok: sıfır yazmak "hiç gelmedi"
    -- demek olurdu, oysa henüz ölçülecek günü geçmemiş.
    case when s.ders_gunu > 0 then round(100.0 * s.gelis / s.ders_gunu) end as oran,
    s.son_gelis,
    b.kalan
  from ogrenci o
  join sayim s on s.id = o.id
  left join public.student_balances b on b.student_id = o.id
  order by
    case when s.ders_gunu > 0 then round(100.0 * s.gelis / s.ders_gunu) end nulls last,
    o.ad_soyad;
$function$;

grant execute on function public.az_gelenler(uuid) to authenticated;

-- 20260811110000_odeme_gunu_ve_abone_degisimi.sql
--
-- 1) Devam çizelgesinde ödeme alınan günler
-- 2) Abone tipi değişince geçmiş öğünlerin yeniden hesaplanması

-- ---------------------------------------------------------------------------
-- 1) Devam çizelgesine ödeme günleri
-- ---------------------------------------------------------------------------
drop function if exists public.devam_cizelgesi(uuid, integer, integer);
create function public.devam_cizelgesi(p_okul_id uuid, p_yil integer, p_ay integer)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  abone_tipi public.abone_tipi, ogrenci_tipi public.ogrenci_tipi,
  geldigi_gunler integer[], odeme_gunleri integer[],
  geldi_sayisi integer, gelmedi_sayisi integer
)
language sql stable
set search_path = public
as $$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as ay_bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as ay_bit
  ),
  hafta_ici as (
    select count(*)::int as gun_sayisi
    from sinir, generate_series(sinir.ay_bas, sinir.ay_bit, interval '1 day') g
    where extract(isodow from g) < 6
  ),
  gelis as (
    select
      t.student_id,
      array_agg(extract(day from t.tarih)::int order by t.tarih)    as gunler,
      count(*)::int                                                 as adet,
      count(*) filter (where extract(isodow from t.tarih) < 6)::int as hafta_ici_adet
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.ogun_abone_tipi is not null
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id
  ),
  -- Çizelgeye bakınca o gün tahsilat alındığı da görünsün
  odeme as (
    select
      t.student_id,
      array_agg(distinct extract(day from t.tarih)::int) as gunler
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.tip = 'tahsilat'
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id
  )
  select
    s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.abone_tipi, s.ogrenci_tipi,
    coalesce(g.gunler, '{}'::int[]),
    coalesce(o.gunler, '{}'::int[]),
    coalesce(g.adet, 0),
    greatest(0, hafta_ici.gun_sayisi - coalesce(g.hafta_ici_adet, 0))
  from public.students s
  cross join hafta_ici
  left join gelis g on g.student_id = s.id
  left join odeme o on o.student_id = s.id
  where s.aktif and s.okul_id = p_okul_id
  order by s.ad_soyad;
$$;

revoke execute on function public.devam_cizelgesi(uuid, integer, integer) from public, anon;
grant execute on function public.devam_cizelgesi(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Abone tipi değişiminde geçmiş öğünlerin yeniden hesaplanması
-- ---------------------------------------------------------------------------
--
-- Öğrenci yıl içinde günlükçüden aylıkçıya (ya da tersine) geçebiliyor.
-- Öğün kayıtlarının tutarı kaydedildiği andaki abone tipine göre yazılıyor:
-- günlükçüde efektif günlük ücret, aylıkçıda 0 (devam kaydı).
--
-- Tip değişince geçmiş kayıtlar olduğu gibi kalırsa bakiye yanlış olur:
-- aylıkçıyken yediği öğünler 0 ₺ görünmeye devam eder. Bu fonksiyon öğrencinin
-- TÜM öğün kayıtlarını güncel tipine göre yeniden fiyatlandırır. Tahsilatlara
-- dokunmaz; bakiye zaten tahsilat − harcama olduğu için borç kendiliğinden
-- doğru duruma gelir.
--
-- Not: yeniden fiyatlandırma GÜNCEL taban ücret ve GÜNCEL iskonto ile yapılır.
-- Yıl içinde fiyat değiştiyse geçmiş öğünler de yeni fiyattan hesaplanır.
create or replace function public.ogun_tutarlarini_yenile(p_student_id uuid)
returns table (guncellenen integer, yeni_kalan numeric)
language plpgsql
set search_path = public
as $$
declare
  v_tip    public.abone_tipi;
  v_ucret  numeric;
  v_sayi   int;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  select s.abone_tipi,
         public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
    into v_tip, v_ucret
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  where s.id = p_student_id;

  if not found then
    raise exception 'Ogrenci bulunamadi.' using errcode = 'P0002';
  end if;

  update public.transactions t
     set tutar           = case when v_tip = 'aylik' then 0 else v_ucret end,
         ogun_abone_tipi = v_tip,
         aciklama        = case when v_tip = 'aylik'
                                then 'Aylikci devam kaydi (tip degisimi)'
                                else 'Yemek (tip degisimi)' end
   where t.student_id = p_student_id
     and t.ogun_abone_tipi is not null
     and (t.ogun_abone_tipi <> v_tip
          or t.tutar <> case when v_tip = 'aylik' then 0 else v_ucret end);

  get diagnostics v_sayi = row_count;

  guncellenen := v_sayi;
  select b.kalan into yeni_kalan from public.student_balances b where b.student_id = p_student_id;
  return next;
end $$;

revoke execute on function public.ogun_tutarlarini_yenile(uuid) from public, anon;
grant execute on function public.ogun_tutarlarini_yenile(uuid) to authenticated;

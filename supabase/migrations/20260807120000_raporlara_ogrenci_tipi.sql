-- 20260807120000_raporlara_ogrenci_tipi.sql
--
-- Öğrenci tipi, günlükçü/aylıkçı kadar kritik bir bilgi: hangi taksit planına
-- tabi olduğunu belirliyor. Rozetin gösterildiği her ekranın veri kaynağına
-- alanı ekliyoruz.

drop function if exists public.devam_cizelgesi(uuid, integer, integer);
create function public.devam_cizelgesi(p_okul_id uuid, p_yil integer, p_ay integer)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  abone_tipi public.abone_tipi, ogrenci_tipi public.ogrenci_tipi,
  geldigi_gunler integer[], geldi_sayisi integer, gelmedi_sayisi integer
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
  )
  select
    s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.abone_tipi, s.ogrenci_tipi,
    coalesce(g.gunler, '{}'::int[]),
    coalesce(g.adet, 0),
    greatest(0, hafta_ici.gun_sayisi - coalesce(g.hafta_ici_adet, 0))
  from public.students s
  cross join hafta_ici
  left join gelis g on g.student_id = s.id
  where s.aktif and s.okul_id = p_okul_id
  order by s.ad_soyad;
$$;

revoke execute on function public.devam_cizelgesi(uuid, integer, integer) from public, anon;
grant execute on function public.devam_cizelgesi(uuid, integer, integer) to authenticated;

drop function if exists public.gelen_giden_raporu(uuid, date, date);
create function public.gelen_giden_raporu(p_okul_id uuid, p_bas date, p_bit date)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  abone_tipi public.abone_tipi, ogrenci_tipi public.ogrenci_tipi,
  devir numeric, donem_tahsilat numeric, donem_harcama numeric,
  donem_ogun integer, guncel_kalan numeric
)
language sql stable
set search_path = public
as $$
  with donem as (
    select
      t.student_id,
      coalesce(sum(t.tutar) filter (where t.tip = 'tahsilat'), 0) as tahsilat,
      coalesce(sum(t.tutar) filter (where t.tip = 'harcama'), 0)  as harcama,
      count(*) filter (where t.ogun_abone_tipi is not null)::int  as ogun
    from public.transactions t
    where t.tarih between p_bas and p_bit
    group by t.student_id
  )
  select
    b.student_id, b.ogrenci_no, b.ad_soyad, b.sinif, b.abone_tipi, b.ogrenci_tipi, b.devir,
    coalesce(d.tahsilat, 0), coalesce(d.harcama, 0), coalesce(d.ogun, 0), b.kalan
  from public.student_balances b
  left join donem d on d.student_id = b.student_id
  where b.okul_id = p_okul_id
    and (b.aktif or coalesce(d.ogun, 0) > 0 or coalesce(d.tahsilat, 0) > 0)
  order by b.ad_soyad;
$$;

revoke execute on function public.gelen_giden_raporu(uuid, date, date) from public, anon;
grant execute on function public.gelen_giden_raporu(uuid, date, date) to authenticated;

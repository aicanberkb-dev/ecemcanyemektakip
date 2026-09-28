-- 20260928110000_taksit_yaklasan_vade.sql
--
-- Taksit takibinde yaklasan vade.
--
-- Rapor yalnizca vadesi gecmis eksigi gosteriyordu: bir ogrencinin vadesi
-- yarin dolacak olsa bile listede sira disi bir sey gorunmuyordu. Vadesi
-- yaklasanlari onceden gormek, odemeyi vaktinde istemeyi sagliyor.
--
-- Yaklasan vade = bugunden SONRAKI ilk taksit vadesi. Vadesi gecmis eksik
-- ayri bir sey; ikisi ayni anda olabilir, ekran once eksigi gosterir.

drop function if exists public.taksit_durumu(uuid, date);
create function public.taksit_durumu(p_sezon_id uuid, p_tarih date default current_date)
returns table(
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  ogrenci_tipi ogrenci_tipi, yillik_toplam numeric, vadesi_gelen numeric,
  odenen numeric, eksik numeric, odeme_alinmali boolean, son_vade date,
  ozel_plan boolean,
  yaklasan_vade date,
  yaklasan_tutar numeric
)
language sql stable set search_path to 'public' as $$
  with sezon as (
    select z.id, z.okul_id, z.baslangic, z.bitis,
           (select max(o.bitis) from public.sezonlar o
             where o.okul_id = z.okul_id and o.id <> z.id
               and o.bitis is not null and o.bitis < z.baslangic) as onceki_bitis
    from public.sezonlar z where z.id = p_sezon_id
  ),
  ogrenciler as (
    select s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.ogrenci_tipi,
           public.plan_tipi(s.ogrenci_tipi) as plan_tipi
    from public.students s, sezon
    where s.abone_tipi = 'aylik' and s.aktif and s.okul_id = sezon.okul_id
  ),
  plan as (
    select id, tutar, vade_tarihi, ogrenci_tipi
    from public.taksit_plani where sezon_id = p_sezon_id
  ),
  etkin as (
    select
      o.id as student_id,
      coalesce(ot.tutar, p.tutar)             as tutar,
      coalesce(ot.vade_tarihi, p.vade_tarihi) as vade_tarihi,
      (ot.id is not null)                     as ozel
    from ogrenciler o
    join plan p on p.ogrenci_tipi = o.plan_tipi
    left join public.ogrenci_taksit ot
      on ot.taksit_plani_id = p.id and ot.student_id = o.id
    union all
    select o.id, ot.tutar, ot.vade_tarihi, true
    from ogrenciler o
    join public.ogrenci_taksit ot
      on ot.student_id = o.id and ot.taksit_plani_id is null and ot.sezon_id = p_sezon_id
  ),
  toplam as (
    select
      student_id,
      coalesce(sum(tutar), 0)                                       as yillik,
      coalesce(sum(tutar) filter (where vade_tarihi <= p_tarih), 0) as vadesi_gelen,
      max(vade_tarihi) filter (where vade_tarihi <= p_tarih)        as son_vade,
      min(vade_tarihi) filter (where vade_tarihi > p_tarih)         as yaklasan_vade,
      bool_or(ozel)                                                 as ozel
    from etkin
    group by student_id
  ),
  -- Yaklasan vadedeki tutar: ayni gune birden fazla taksit dusebilir
  yaklasan as (
    select e.student_id, sum(e.tutar) as tutar
    from etkin e
    join toplam tp on tp.student_id = e.student_id
    where e.vade_tarihi = tp.yaklasan_vade
    group by e.student_id
  ),
  odeme as (
    select t.student_id, coalesce(sum(t.tutar), 0) as odenen
    from public.transactions t
    join public.students s on s.id = t.student_id
    cross join sezon
    where t.tip = 'tahsilat'
      and s.okul_id = sezon.okul_id
      -- Alt sinir onceki sezonun sonu; yoksa sinir yok (kayit donemi dahil).
      and (sezon.onceki_bitis is null or t.tarih > sezon.onceki_bitis)
      and (sezon.bitis is null or t.tarih <= sezon.bitis)
    group by t.student_id
  )
  select
    o.id, o.ogrenci_no, o.ad_soyad, o.sinif, o.ogrenci_tipi,
    coalesce(tp.yillik, 0),
    coalesce(tp.vadesi_gelen, 0),
    coalesce(od.odenen, 0),
    greatest(0, coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)),
    (coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)) > 0,
    tp.son_vade,
    coalesce(tp.ozel, false),
    tp.yaklasan_vade,
    coalesce(y.tutar, 0)
  from ogrenciler o
  left join toplam   tp on tp.student_id = o.id
  left join yaklasan y  on y.student_id  = o.id
  left join odeme    od on od.student_id = o.id
  order by (coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)) desc, o.ad_soyad;
$$;

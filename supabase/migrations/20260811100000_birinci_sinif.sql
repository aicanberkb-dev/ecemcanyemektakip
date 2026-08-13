-- 20260811100000_birinci_sinif.sql
--
-- 1. sınıf öğrenci tipi.
--
-- 1. sınıfların AYRI BİR ÜCRETİ YOK — standart planla aynı ödüyorlar. Tip
-- yalnızca işleyiş için var: bu öğrenciler sınıflarından toplu alınıyor,
-- yemeğe gelip gelmedikleri kâğıda işaretlenip sonradan sisteme giriliyor.
-- O yüzden ekranlarda ayrı bir rozetle görünmeleri gerekiyor.
--
-- Ücret tarafında tipi standarda eşleyen tek bir yer var: plan_tipi().
-- Böylece 1. sınıf için ayrı taksit satırı girilmesi gerekmiyor; standart
-- planı değiştirdiğinde 1. sınıflar da otomatik takip ediyor.

-- Enum değeri ayrı çalıştırıldı (aynı işlemde hem eklenip hem kullanılamıyor):
--   alter type public.ogrenci_tipi add value 'birinci_sinif' after 'standart';

create or replace function public.plan_tipi(p_tip public.ogrenci_tipi)
returns public.ogrenci_tipi
language sql
immutable
parallel safe
set search_path = public
as $$
  -- 1. sınıf standart planı kullanır; diğer tipler kendi planına tabidir.
  select case when p_tip = 'birinci_sinif' then 'standart'::public.ogrenci_tipi else p_tip end
$$;

comment on function public.plan_tipi(public.ogrenci_tipi) is
  'Ogrenci tipinin hangi taksit planina tabi oldugunu verir. 1. sinif standart plani kullanir.';

-- taksit_durumu: plan eşleşmesi plan_tipi üzerinden
drop function if exists public.taksit_durumu(uuid, date);
create function public.taksit_durumu(
  p_sezon_id uuid,
  p_tarih    date default current_date
) returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  ogrenci_tipi public.ogrenci_tipi,
  yillik_toplam numeric, vadesi_gelen numeric, odenen numeric,
  eksik numeric, odeme_alinmali boolean, son_vade date, ozel_plan boolean
)
language sql stable security invoker
set search_path = public
as $$
  with sezon as (
    select id, okul_id, baslangic, bitis from public.sezonlar where id = p_sezon_id
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
      bool_or(ozel)                                                 as ozel
    from etkin
    group by student_id
  ),
  odeme as (
    select t.student_id, coalesce(sum(t.tutar), 0) as odenen
    from public.transactions t
    join public.students s on s.id = t.student_id
    cross join sezon
    where t.tip = 'tahsilat'
      and s.okul_id = sezon.okul_id
      and (sezon.baslangic is null or t.tarih >= sezon.baslangic)
      and (sezon.bitis     is null or t.tarih <= sezon.bitis)
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
    coalesce(tp.ozel, false)
  from ogrenciler o
  left join toplam tp on tp.student_id = o.id
  left join odeme  od on od.student_id = o.id
  order by (coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)) desc, o.ad_soyad;
$$;

revoke execute on function public.taksit_durumu(uuid, date) from public, anon;
grant execute on function public.taksit_durumu(uuid, date) to authenticated;

create or replace function public.ogrenci_taksit_plani(p_student_id uuid, p_sezon_id uuid)
returns table (
  istisna_id uuid, taksit_plani_id uuid, ad text, okul_tutar numeric, okul_vade date,
  tutar numeric, vade_tarihi date, ozel_tutar boolean, ozel_vade boolean,
  ekstra boolean, aciklama text
)
language sql stable
set search_path = public
as $$
  select
    ot.id, p.id, p.ad, p.tutar, p.vade_tarihi,
    coalesce(ot.tutar, p.tutar),
    coalesce(ot.vade_tarihi, p.vade_tarihi),
    ot.tutar is not null,
    ot.vade_tarihi is not null,
    false,
    ot.aciklama
  from public.taksit_plani p
  join public.sezonlar sz on sz.id = p.sezon_id
  join public.students s  on s.id = p_student_id and s.okul_id = sz.okul_id
  left join public.ogrenci_taksit ot
    on ot.taksit_plani_id = p.id and ot.student_id = p_student_id
  where p.sezon_id = p_sezon_id
    and p.ogrenci_tipi = public.plan_tipi(s.ogrenci_tipi)
  union all
  select
    ot.id, null, ot.ad, null, null,
    ot.tutar, ot.vade_tarihi, true, true, true, ot.aciklama
  from public.ogrenci_taksit ot
  where ot.student_id = p_student_id
    and ot.taksit_plani_id is null
    and ot.sezon_id = p_sezon_id
  order by 7;
$$;

revoke execute on function public.ogrenci_taksit_plani(uuid, uuid) from public, anon;
grant execute on function public.ogrenci_taksit_plani(uuid, uuid) to authenticated;

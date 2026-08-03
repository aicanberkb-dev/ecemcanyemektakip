-- 20260804100000_sezon_tarih_bagimsiz.sql
--
-- Sezon tarihleri artık İSTEĞE BAĞLI.
--
-- Katı bir tarih penceresi sessiz hataya yol açıyordu: pencere dışında kalan
-- tahsilat sayılmıyor, öğrenci ödediği halde borçlu görünüyordu. Sezon başında
-- veri sıfırlanıp yeniden başlandığı için pencerenin faydası da yok.
-- Tarih girilmezse hiçbir filtre uygulanmaz; öğrencinin tüm tahsilatı sayılır.

alter table public.sezonlar alter column baslangic drop not null;
alter table public.sezonlar alter column bitis     drop not null;

alter table public.sezonlar drop constraint if exists sezonlar_tarih_ck;
alter table public.sezonlar add constraint sezonlar_tarih_ck
  check (baslangic is null or bitis is null or bitis > baslangic);

drop function if exists public.taksit_durumu(uuid, date);
create function public.taksit_durumu(
  p_sezon_id uuid,
  p_tarih    date default current_date
) returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
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
    select s.id, s.ogrenci_no, s.ad_soyad, s.sinif
    from public.students s, sezon
    where s.abone_tipi = 'aylik' and s.aktif and s.okul_id = sezon.okul_id
  ),
  plan as (
    select id, tutar, vade_tarihi from public.taksit_plani where sezon_id = p_sezon_id
  ),
  etkin as (
    select
      o.id as student_id,
      coalesce(ot.tutar, p.tutar)             as tutar,
      coalesce(ot.vade_tarihi, p.vade_tarihi) as vade_tarihi,
      (ot.id is not null)                     as ozel
    from ogrenciler o
    cross join plan p
    left join public.ogrenci_taksit ot
      on ot.student_id = o.id and ot.taksit_plani_id = p.id

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
    -- Sezonda tarih tanımlıysa o aralıktaki, tanımlı değilse TÜM tahsilat sayılır
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
    o.id, o.ogrenci_no, o.ad_soyad, o.sinif,
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

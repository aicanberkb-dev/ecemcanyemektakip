-- 20260803130000_ogrenci_ekstra_taksit.sql
--
-- Öğrenciye özel EK taksit. Bir öğrencinin taksit sayısı okul planından fazla
-- olabilir: okul 3 taksitse veliyle 6 taksitte anlaşılmış olabilir.
-- taksit_plani_id null ise satırın okul planında karşılığı yoktur.

alter table public.ogrenci_taksit alter column taksit_plani_id drop not null;
alter table public.ogrenci_taksit add column if not exists ad  text;
alter table public.ogrenci_taksit add column if not exists yil int;

alter table public.ogrenci_taksit drop constraint if exists ogrenci_taksit_dolu_ck;
alter table public.ogrenci_taksit add constraint ogrenci_taksit_dolu_ck check (
  case
    -- Okul planındaki bir satırın istisnası: en az bir alan değişmiş olmalı
    when taksit_plani_id is not null
      then (tutar is not null or vade_tarihi is not null)
    -- Öğrenciye özel ek taksit: kendi başına ayakta durmalı
    else (ad is not null and tutar is not null and vade_tarihi is not null and yil is not null)
  end
);

create index if not exists ogrenci_taksit_ekstra_idx
  on public.ogrenci_taksit (student_id, yil) where taksit_plani_id is null;

-- Okul satırları (istisnalarıyla) + öğrenciye özel ek taksitler
drop function if exists public.ogrenci_taksit_plani(uuid, int);
create function public.ogrenci_taksit_plani(
  p_student_id uuid,
  p_yil        int
) returns table (
  istisna_id      uuid,
  taksit_plani_id uuid,
  ad              text,
  okul_tutar      numeric,
  okul_vade       date,
  tutar           numeric,
  vade_tarihi     date,
  ozel_tutar      boolean,
  ozel_vade       boolean,
  ekstra          boolean,
  aciklama        text
)
language sql stable security invoker
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
  join public.students s on s.id = p_student_id and s.okul_id = p.okul_id
  left join public.ogrenci_taksit ot
    on ot.taksit_plani_id = p.id and ot.student_id = p_student_id
  where p.yil = p_yil

  union all

  select
    ot.id, null, ot.ad, null, null,
    ot.tutar, ot.vade_tarihi, true, true, true, ot.aciklama
  from public.ogrenci_taksit ot
  where ot.student_id = p_student_id
    and ot.taksit_plani_id is null
    and ot.yil = p_yil

  order by 7;
$$;

-- taksit_durumu: ek taksitler de öğrencinin planına dahil
drop function if exists public.taksit_durumu(uuid, int, date);
create function public.taksit_durumu(
  p_okul_id uuid,
  p_yil     int,
  p_tarih   date default current_date
) returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  yillik_toplam numeric, vadesi_gelen numeric, odenen numeric,
  eksik numeric, odeme_alinmali boolean, son_vade date, ozel_plan boolean
)
language sql stable security invoker
set search_path = public
as $$
  with ogrenciler as (
    select s.id, s.ogrenci_no, s.ad_soyad, s.sinif
    from public.students s
    where s.abone_tipi = 'aylik' and s.aktif and s.okul_id = p_okul_id
  ),
  plan as (
    select id, tutar, vade_tarihi
    from public.taksit_plani
    where yil = p_yil and okul_id = p_okul_id
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
      on ot.student_id = o.id and ot.taksit_plani_id is null and ot.yil = p_yil
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
    where t.tip = 'tahsilat'
      and extract(year from t.tarih) = p_yil
      and s.okul_id = p_okul_id
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

revoke execute on function
  public.taksit_durumu(uuid, int, date),
  public.ogrenci_taksit_plani(uuid, int)
  from public, anon;
grant execute on function
  public.taksit_durumu(uuid, int, date),
  public.ogrenci_taksit_plani(uuid, int)
  to authenticated;

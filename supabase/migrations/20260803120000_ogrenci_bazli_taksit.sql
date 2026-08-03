-- 20260803120000_ogrenci_bazli_taksit.sql
--
-- Öğrenci bazlı taksit istisnası.
-- Okul planı varsayılandır. Bir öğrenci için tutar veya vade değiştirilirse
-- yalnızca o satır özel olur; dokunulmayan satırlar okul planını izlemeye
-- devam eder (null = okul planındaki değer). Böylece okul planı sonradan
-- değişirse öğrencinin özel olmayan satırları kendiliğinden güncellenir.

create table if not exists public.ogrenci_taksit (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  taksit_plani_id  uuid not null references public.taksit_plani(id) on delete cascade,
  tutar            numeric(12,2) check (tutar is null or tutar >= 0),
  vade_tarihi      date,
  aciklama         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, taksit_plani_id),
  -- En az bir alan değişmiş olmalı; ikisi de boşsa satırın varlık sebebi yok
  constraint ogrenci_taksit_dolu_ck check (tutar is not null or vade_tarihi is not null)
);

create index if not exists ogrenci_taksit_student_idx on public.ogrenci_taksit (student_id);

drop trigger if exists set_updated_at on public.ogrenci_taksit;
create trigger set_updated_at before update on public.ogrenci_taksit
  for each row execute function public.set_updated_at();

drop trigger if exists audit_yaz on public.ogrenci_taksit;
create trigger audit_yaz after update or delete on public.ogrenci_taksit
  for each row execute function public.audit_yaz();

alter table public.ogrenci_taksit enable row level security;
revoke all on public.ogrenci_taksit from anon;
grant select, insert, update, delete on public.ogrenci_taksit to authenticated;

drop policy if exists ogrenci_taksit_select on public.ogrenci_taksit;
create policy ogrenci_taksit_select on public.ogrenci_taksit
  for select to authenticated using (true);
drop policy if exists ogrenci_taksit_insert on public.ogrenci_taksit;
create policy ogrenci_taksit_insert on public.ogrenci_taksit
  for insert to authenticated with check (true);
drop policy if exists ogrenci_taksit_update on public.ogrenci_taksit;
create policy ogrenci_taksit_update on public.ogrenci_taksit
  for update to authenticated using (true) with check (true);
drop policy if exists ogrenci_taksit_delete on public.ogrenci_taksit;
create policy ogrenci_taksit_delete on public.ogrenci_taksit
  for delete to authenticated using (true);

-- Bir öğrencinin etkin taksit satırları (okul varsayılanı + varsa istisna)
create or replace function public.ogrenci_taksit_plani(
  p_student_id uuid,
  p_yil        int
) returns table (
  taksit_plani_id uuid,
  ad              text,
  okul_tutar      numeric,
  okul_vade       date,
  tutar           numeric,
  vade_tarihi     date,
  ozel_tutar      boolean,
  ozel_vade       boolean,
  aciklama        text
)
language sql stable security invoker
set search_path = public
as $$
  select
    p.id,
    p.ad,
    p.tutar,
    p.vade_tarihi,
    coalesce(ot.tutar, p.tutar),
    coalesce(ot.vade_tarihi, p.vade_tarihi),
    ot.tutar is not null,
    ot.vade_tarihi is not null,
    ot.aciklama
  from public.taksit_plani p
  join public.students s on s.id = p_student_id and s.okul_id = p.okul_id
  left join public.ogrenci_taksit ot
    on ot.taksit_plani_id = p.id and ot.student_id = p_student_id
  where p.yil = p_yil
  order by coalesce(ot.vade_tarihi, p.vade_tarihi);
$$;

-- taksit_durumu artık her öğrencinin kendi etkin planı üzerinden hesaplar
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

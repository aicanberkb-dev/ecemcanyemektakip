-- 20260803140000_sezon_yapisi.sql
--
-- Okul yılı takvim yılıyla örtüşmez: Eylül'de başlar, Haziran'da biter.
-- Taksitler takvim yılına bağlıyken sezon ikiye bölünüyor ve daha kötüsü,
-- Şubat'ta yapılan ödeme bir sonraki takvim yılına sayıldığı için öğrenci
-- ödediği halde borçlu görünüyordu. Artık taksitler sezona bağlanır ve
-- tahsilat sezonun tarih aralığında toplanır.

create table if not exists public.sezonlar (
  id          uuid primary key default gen_random_uuid(),
  okul_id     uuid not null references public.okullar(id) on delete cascade,
  ad          text not null,
  baslangic   date not null,
  -- Tahsilat penceresinin sonu: dersler Haziran'da bitse de yaz aylarındaki
  -- geç ödemelerin doğru sezona sayılması için bitiş ileri alınabilir.
  bitis       date not null,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (okul_id, ad),
  constraint sezonlar_tarih_ck check (bitis > baslangic)
);

create index if not exists sezonlar_okul_idx on public.sezonlar (okul_id, baslangic desc);

drop trigger if exists set_updated_at on public.sezonlar;
create trigger set_updated_at before update on public.sezonlar
  for each row execute function public.set_updated_at();

drop trigger if exists audit_yaz on public.sezonlar;
create trigger audit_yaz after update or delete on public.sezonlar
  for each row execute function public.audit_yaz();

alter table public.sezonlar enable row level security;
revoke all on public.sezonlar from anon;
grant select, insert, update, delete on public.sezonlar to authenticated;

drop policy if exists sezonlar_select on public.sezonlar;
create policy sezonlar_select on public.sezonlar for select to authenticated using (true);
drop policy if exists sezonlar_insert on public.sezonlar;
create policy sezonlar_insert on public.sezonlar for insert to authenticated with check (true);
drop policy if exists sezonlar_update on public.sezonlar;
create policy sezonlar_update on public.sezonlar for update to authenticated using (true) with check (true);
drop policy if exists sezonlar_delete on public.sezonlar;
create policy sezonlar_delete on public.sezonlar for delete to authenticated using (true);

-- --- Mevcut takvim yılı verisini sezona taşı ------------------------------
alter table public.taksit_plani   add column if not exists sezon_id uuid references public.sezonlar(id) on delete cascade;
alter table public.ogrenci_taksit add column if not exists sezon_id uuid references public.sezonlar(id) on delete cascade;

insert into public.sezonlar (okul_id, ad, baslangic, bitis)
select distinct
  t.okul_id,
  t.yil || '-' || (t.yil + 1),
  make_date(t.yil, 9, 1),
  make_date(t.yil + 1, 8, 31)
from public.taksit_plani t
where t.yil is not null
on conflict (okul_id, ad) do nothing;

update public.taksit_plani t
   set sezon_id = s.id
  from public.sezonlar s
 where s.okul_id = t.okul_id
   and s.ad = t.yil || '-' || (t.yil + 1)
   and t.sezon_id is null;

update public.ogrenci_taksit ot
   set sezon_id = p.sezon_id
  from public.taksit_plani p
 where p.id = ot.taksit_plani_id and ot.sezon_id is null;

update public.ogrenci_taksit ot
   set sezon_id = s.id
  from public.students st
  join public.sezonlar s on s.okul_id = st.okul_id
 where st.id = ot.student_id
   and ot.taksit_plani_id is null
   and ot.sezon_id is null
   and s.ad = ot.yil || '-' || (ot.yil + 1);

delete from public.taksit_plani   where sezon_id is null;
delete from public.ogrenci_taksit where sezon_id is null;

alter table public.taksit_plani   alter column sezon_id set not null;
alter table public.ogrenci_taksit alter column sezon_id set not null;

alter table public.taksit_plani drop constraint if exists taksit_plani_yil_ad_key;
drop index if exists public.taksit_plani_okul_yil_ad_uniq;
create unique index if not exists taksit_plani_sezon_ad_uniq
  on public.taksit_plani (sezon_id, ad);

drop index if exists public.taksit_plani_okul_idx;
create index if not exists taksit_plani_sezon_idx on public.taksit_plani (sezon_id, vade_tarihi);

drop index if exists public.ogrenci_taksit_ekstra_idx;
create index if not exists ogrenci_taksit_ekstra_idx
  on public.ogrenci_taksit (student_id, sezon_id) where taksit_plani_id is null;

alter table public.ogrenci_taksit drop constraint if exists ogrenci_taksit_dolu_ck;
alter table public.ogrenci_taksit add constraint ogrenci_taksit_dolu_ck check (
  case
    when taksit_plani_id is not null
      then (tutar is not null or vade_tarihi is not null)
    else (ad is not null and tutar is not null and vade_tarihi is not null)
  end
);

alter table public.taksit_plani   drop column if exists yil;
alter table public.ogrenci_taksit drop column if exists yil;

-- --- Fonksiyonlar sezon üzerinden ----------------------------------------
drop function if exists public.ogrenci_taksit_plani(uuid, int);
create function public.ogrenci_taksit_plani(
  p_student_id uuid,
  p_sezon_id   uuid
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
  join public.sezonlar sz on sz.id = p.sezon_id
  join public.students s  on s.id = p_student_id and s.okul_id = sz.okul_id
  left join public.ogrenci_taksit ot
    on ot.taksit_plani_id = p.id and ot.student_id = p_student_id
  where p.sezon_id = p_sezon_id

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

drop function if exists public.taksit_durumu(uuid, int, date);
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
    -- Tahsilat sezonun tarih aralığında sayılır, takvim yılında değil
    select t.student_id, coalesce(sum(t.tutar), 0) as odenen
    from public.transactions t
    join public.students s on s.id = t.student_id
    cross join sezon
    where t.tip = 'tahsilat'
      and s.okul_id = sezon.okul_id
      and t.tarih between sezon.baslangic and sezon.bitis
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
  public.taksit_durumu(uuid, date),
  public.ogrenci_taksit_plani(uuid, uuid)
  from public, anon;
grant execute on function
  public.taksit_durumu(uuid, date),
  public.ogrenci_taksit_plani(uuid, uuid)
  to authenticated;

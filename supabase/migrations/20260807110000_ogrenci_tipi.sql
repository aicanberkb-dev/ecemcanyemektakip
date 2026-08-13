-- 20260807110000_ogrenci_tipi.sql
--
-- Öğrenci tipi ve tipe göre taksit planı.
--
-- Aylıkçılar tek fiyattan takip ediliyordu; oysa standart, anasınıfı ve
-- anasınıfı+etüt öğrencilerinin ücretleri farklı. Taksit planı artık tip
-- kırılımında tutulur: her tip kendi taksit satırlarına sahiptir ve öğrenci
-- kendi tipinin planına göre değerlendirilir.
--
-- Öğrenci bazlı istisna (ogrenci_taksit) aynen çalışmaya devam eder; tipin
-- planındaki satırı ezer ya da plana ek taksit tanımlar.

do $$ begin
  create type public.ogrenci_tipi as enum ('standart', 'anasinifi', 'anasinifi_etut');
exception when duplicate_object then null;
end $$;

-- Mevcut kayıtlar standart sayılır: davranış değişmesin.
alter table public.students
  add column if not exists ogrenci_tipi public.ogrenci_tipi not null default 'standart';

alter table public.taksit_plani
  add column if not exists ogrenci_tipi public.ogrenci_tipi not null default 'standart';

create index if not exists students_ogrenci_tipi_idx on public.students (ogrenci_tipi);

-- Taksit adı artık sezon + tip içinde benzersiz: "1. Taksit" her tipte olabilir.
alter table public.taksit_plani drop constraint if exists taksit_plani_sezon_ad_uniq;
drop index if exists public.taksit_plani_sezon_ad_uniq;

create unique index if not exists taksit_plani_sezon_tip_ad_uniq
  on public.taksit_plani (sezon_id, ogrenci_tipi, ad);

comment on column public.students.ogrenci_tipi is
  'Ucretlendirme tipi. Aylikci ogrenci kendi tipinin taksit planina gore degerlendirilir.';

-- ---------------------------------------------------------------------------
-- taksit_durumu: her öğrenci kendi tipinin planına göre
-- ---------------------------------------------------------------------------
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
    select s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.ogrenci_tipi
    from public.students s, sezon
    where s.abone_tipi = 'aylik' and s.aktif and s.okul_id = sezon.okul_id
  ),
  plan as (
    select id, tutar, vade_tarihi, ogrenci_tipi
    from public.taksit_plani where sezon_id = p_sezon_id
  ),
  etkin as (
    -- Öğrencinin tipine ait plan satırları; varsa öğrenciye özel değerlerle ezilir
    select
      o.id as student_id,
      coalesce(ot.tutar, p.tutar)             as tutar,
      coalesce(ot.vade_tarihi, p.vade_tarihi) as vade_tarihi,
      (ot.id is not null)                     as ozel
    from ogrenciler o
    join plan p on p.ogrenci_tipi = o.ogrenci_tipi
    left join public.ogrenci_taksit ot
      on ot.taksit_plani_id = p.id and ot.student_id = o.id

    union all

    -- Plana bağlı olmayan, yalnızca bu öğrenciye tanımlı ek taksitler
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

-- ---------------------------------------------------------------------------
-- ogrenci_taksit_plani: öğrencinin kendi tipinin plan satırları
-- ---------------------------------------------------------------------------
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
    and p.ogrenci_tipi = s.ogrenci_tipi

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

-- ---------------------------------------------------------------------------
-- ogrenci_ekle: tip parametresi
-- ---------------------------------------------------------------------------
drop function if exists public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  public.abone_tipi, boolean, text, text);

create or replace function public.ogrenci_ekle(
  p_okul_id        uuid,
  p_ad_soyad       text,
  p_sinif          text    default null,
  p_kimlik_no      text    default null,
  p_veli_adi       text    default null,
  p_veli_telefon   text    default null,
  p_iskonto_orani  numeric default 0,
  p_iskonto_tutar  numeric default 0,
  p_devir          numeric default 0,
  p_abone_tipi     public.abone_tipi default 'gunluk',
  p_aktif          boolean default true,
  p_veli2_adi      text    default null,
  p_veli2_telefon  text    default null,
  p_ogrenci_tipi   public.ogrenci_tipi default 'standart'
) returns public.students
language plpgsql security invoker
set search_path = public
as $$
declare
  v_kayit  public.students;
  v_kisit  text;
  v_deneme int := 0;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  loop
    begin
      insert into public.students
        (okul_id, ogrenci_no, ad_soyad, sinif, kimlik_no, veli_adi, veli_telefon,
         iskonto_orani, iskonto_tutar, devir, abone_tipi, aktif,
         veli2_adi, veli2_telefon, ogrenci_tipi)
      values
        (p_okul_id, public.sonraki_ogrenci_no(p_okul_id), p_ad_soyad, p_sinif,
         nullif(btrim(coalesce(p_kimlik_no, '')), ''), p_veli_adi, p_veli_telefon,
         p_iskonto_orani, p_iskonto_tutar, p_devir, p_abone_tipi, p_aktif,
         nullif(btrim(coalesce(p_veli2_adi, '')), ''),
         nullif(btrim(coalesce(p_veli2_telefon, '')), ''),
         p_ogrenci_tipi)
      returning * into v_kayit;

      return v_kayit;

    exception when unique_violation then
      get stacked diagnostics v_kisit = constraint_name;
      if v_kisit <> 'students_okul_ogrenci_no_uniq' then
        raise;
      end if;
      v_deneme := v_deneme + 1;
      if v_deneme > 10 then
        raise exception 'Ogrenci numarasi uretilemedi, tekrar deneyin.';
      end if;
    end;
  end loop;
end $$;

revoke execute on function public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  public.abone_tipi, boolean, text, text, public.ogrenci_tipi) from public, anon;
grant execute on function public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  public.abone_tipi, boolean, text, text, public.ogrenci_tipi) to authenticated;

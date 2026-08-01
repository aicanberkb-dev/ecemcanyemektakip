-- 0001_sema.sql — Tablolar, enum tipleri ve indeksler

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum tipleri
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.abone_tipi as enum ('gunluk', 'aylik');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.islem_tipi as enum ('tahsilat', 'harcama');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.serbest_ogun_tipi as enum ('ucretli', 'misafir');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kullanici_rolu as enum ('admin', 'personel');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  rol         public.kullanici_rolu not null default 'personel',
  ad_soyad    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id             uuid primary key default gen_random_uuid(),
  ogrenci_no     text not null unique,
  ad_soyad       text not null,
  sinif          text,
  kimlik_no      text,
  veli_adi       text,
  veli_telefon   text,
  iskonto_orani  numeric(5,2)  not null default 0 check (iskonto_orani >= 0 and iskonto_orani <= 100),
  iskonto_tutar  numeric(12,2) not null default 0 check (iskonto_tutar >= 0),
  devir          numeric(12,2) not null default 0,
  abone_tipi     public.abone_tipi not null default 'gunluk',
  aktif          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Kart okutmada tek eşleşme garantisi için: dolu kimlik numaraları benzersiz olmalı
create unique index if not exists students_kimlik_no_uniq
  on public.students (kimlik_no) where kimlik_no is not null and kimlik_no <> '';

create index if not exists students_ad_soyad_idx on public.students (ad_soyad);
create index if not exists students_sinif_idx    on public.students (sinif);
create index if not exists students_aktif_idx    on public.students (aktif);

-- ---------------------------------------------------------------------------
-- app_settings — tek satırlık ayar tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                   uuid primary key default gen_random_uuid(),
  taban_gunluk_ucret   numeric(12,2) not null default 0 check (taban_gunluk_ucret >= 0),
  ucretli_ogun_ucreti  numeric(12,2) not null default 0 check (ucretli_ogun_ucreti >= 0),
  misafir_ogun_ucreti  numeric(12,2) not null default 0 check (misafir_ogun_ucreti >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Tabloda birden fazla satır oluşmasını engeller
create unique index if not exists app_settings_tek_satir on public.app_settings ((true));

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references public.students(id) on delete cascade,
  tarih                 date not null default current_date,
  tip                   public.islem_tipi not null,
  tutar                 numeric(12,2) not null check (tutar >= 0),
  aciklama              text,
  islemi_yapan_user_id  uuid not null default auth.uid() references auth.users(id),
  ogun_abone_tipi       public.abone_tipi,
  created_at            timestamptz not null default now()
);

create index if not exists transactions_student_idx on public.transactions (student_id, tarih desc);
create index if not exists transactions_tarih_idx   on public.transactions (tarih desc);
create index if not exists transactions_tip_idx     on public.transactions (tip);

-- Aynı gün aynı öğrenciye ikinci yemek kaydı girilemez
create unique index if not exists transactions_gunluk_tek_ogun
  on public.transactions (student_id, tarih) where ogun_abone_tipi is not null;

-- ---------------------------------------------------------------------------
-- serbest_ogunler — öğrenciye bağlı olmayan öğünler
-- ---------------------------------------------------------------------------
create table if not exists public.serbest_ogunler (
  id                    uuid primary key default gen_random_uuid(),
  tarih                 date not null default current_date,
  tip                   public.serbest_ogun_tipi not null,
  tutar                 numeric(12,2) not null default 0 check (tutar >= 0),
  aciklama              text,
  islemi_yapan_user_id  uuid not null default auth.uid() references auth.users(id),
  created_at            timestamptz not null default now()
);

create index if not exists serbest_ogunler_tarih_idx on public.serbest_ogunler (tarih desc, tip);

-- ---------------------------------------------------------------------------
-- taksit_plani — aylıkçıların yıllık ücret takvimi
-- ---------------------------------------------------------------------------
create table if not exists public.taksit_plani (
  id            uuid primary key default gen_random_uuid(),
  yil           int  not null check (yil between 2000 and 2100),
  ad            text not null,
  vade_tarihi   date not null,
  tutar         numeric(12,2) not null check (tutar >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (yil, ad)
);

create index if not exists taksit_plani_yil_idx on public.taksit_plani (yil, vade_tarihi);

-- ---------------------------------------------------------------------------
-- audit_log — yalnızca trigger tarafından yazılır
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  tarih       timestamptz not null default now(),
  islem_tipi  text not null,
  tablo_adi   text not null,
  kayit_id    uuid,
  eski_deger  jsonb,
  yeni_deger  jsonb
);

create index if not exists audit_log_tarih_idx on public.audit_log (tarih desc);
create index if not exists audit_log_tablo_idx on public.audit_log (tablo_adi, kayit_id);

-- ---------------------------------------------------------------------------
-- updated_at otomatik güncelleme
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists set_updated_at on public.students;
create trigger set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.app_settings;
create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.taksit_plani;
create trigger set_updated_at before update on public.taksit_plani
  for each row execute function public.set_updated_at();

-- Ayar satırı yoksa oluştur
insert into public.app_settings (taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti)
select 0, 0, 0
where not exists (select 1 from public.app_settings);

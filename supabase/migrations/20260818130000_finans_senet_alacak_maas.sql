-- 20260818130000_finans_senet_alacak_maas.sql
--
-- Finans takibi: senetler, alacaklar, maaşlar.
--
-- Bu üç iş bugüne kadar ayrı bir Excel'de tutuluyordu. Aynı siteden takip
-- edilebilsin diye sisteme alındı; kurgu Excel'deki alışkanlığı bozmuyor.

-- ---------------------------------------------------------------------------
-- 1) Tekel senetleri — ödenecek borç senetleri
-- ---------------------------------------------------------------------------
create table if not exists public.senetler (
  id            uuid primary key default gen_random_uuid(),
  vade_tarihi   date not null,
  kime          text not null,
  tutar         numeric(14,2) not null check (tutar >= 0),
  banka         text,
  senet_no      text,
  odeme_tarihi  date,          -- doluysa ödenmiş sayılır
  aciklama      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists senetler_vade_idx on public.senetler (vade_tarihi);

-- ---------------------------------------------------------------------------
-- 2) Alacak takibi
--
-- Cariler hizmet noktalarıyla örtüşebilir ama fazlası da var (Beykoz Tapu,
-- vinç, Süleyman gibi). Eşleşen varsa bağlanır, yoksa serbest cari olur.
-- ---------------------------------------------------------------------------
create table if not exists public.cariler (
  id                uuid primary key default gen_random_uuid(),
  ad                text not null unique,
  hizmet_noktasi_id uuid references public.hizmet_noktalari(id) on delete set null,
  aktif             boolean not null default true,
  sira              int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.faturalar (
  id             uuid primary key default gen_random_uuid(),
  cari_id        uuid not null references public.cariler(id) on delete cascade,
  donem_yil      int  not null check (donem_yil between 2000 and 2100),
  donem_ay       int  not null check (donem_ay between 1 and 12),
  adet           int,                     -- Excel'de parantez içindeki sayı
  tutar          numeric(14,2) not null check (tutar >= 0),
  fatura_no      text,
  fatura_tarihi  date,
  aciklama       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists faturalar_donem_idx on public.faturalar (donem_yil, donem_ay);
create index if not exists faturalar_cari_idx on public.faturalar (cari_id);

-- Tahsilat parça parça gelebiliyor: Haziran'da Adliye 142.672'yi
-- 68.814 + 72.569 olarak ödemişti. Bu yüzden ayrı tablo.
create table if not exists public.fatura_tahsilatlari (
  id         uuid primary key default gen_random_uuid(),
  fatura_id  uuid not null references public.faturalar(id) on delete cascade,
  tarih      date not null,
  tutar      numeric(14,2) not null check (tutar > 0),
  aciklama   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fatura_tahsilatlari_fatura_idx
  on public.fatura_tahsilatlari (fatura_id);

-- ---------------------------------------------------------------------------
-- 3) Maaşlar
--
-- Çalıştığı yer ile sigortasının olduğu yer farklı olabiliyor: Hamdiye
-- Ahmet Mithat'ta çalışıyor, sigortası Elmalı'da. İki ayrı alan.
-- ---------------------------------------------------------------------------
create table if not exists public.personeller (
  id            uuid primary key default gen_random_uuid(),
  ad            text not null unique,
  calistigi_yer text,
  sigorta_yeri  text,
  maas_gunu     int check (maas_gunu between 1 and 31),
  aktif         boolean not null default true,
  sira          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Maaş ay ay değişmiyor ama zam dönemi gelince değişiyor: tarihli tutuluyor,
-- geçmiş aylar eski ücretiyle kalsın.
create table if not exists public.personel_ucretleri (
  id                uuid primary key default gen_random_uuid(),
  personel_id       uuid not null references public.personeller(id) on delete cascade,
  gecerli_baslangic date not null,
  tutar             numeric(14,2) not null check (tutar >= 0),
  aciklama          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (personel_id, gecerli_baslangic)
);

create table if not exists public.maas_odemeleri (
  id            uuid primary key default gen_random_uuid(),
  personel_id   uuid not null references public.personeller(id) on delete cascade,
  donem_yil     int not null check (donem_yil between 2000 and 2100),
  donem_ay      int not null check (donem_ay between 1 and 12),
  tutar         numeric(14,2) not null check (tutar >= 0),
  odeme_tarihi  date,
  aciklama      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (personel_id, donem_yil, donem_ay)
);

-- ---------------------------------------------------------------------------
-- 4) SSK ve vergi gibi maaş dışı dönemsel giderler
-- ---------------------------------------------------------------------------
create table if not exists public.donemsel_giderler (
  id           uuid primary key default gen_random_uuid(),
  tur          text not null,          -- SSK, VERGİ, …
  donem_yil    int not null check (donem_yil between 2000 and 2100),
  donem_ay     int not null check (donem_ay between 1 and 12),
  tutar        numeric(14,2) not null check (tutar >= 0),
  odeme_tarihi date,
  aciklama     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trigger, RLS ve yetkiler
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'senetler','cariler','faturalar','fatura_tahsilatlari',
    'personeller','personel_ucretleri','maas_odemeleri','donemsel_giderler']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_secme on public.%I', t, t);
    execute format('create policy %I_secme on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_yazma on public.%I', t, t);
    execute format('create policy %I_yazma on public.%I for all to authenticated using (true) with check (true)', t, t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

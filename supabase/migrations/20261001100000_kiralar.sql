-- 20261001100000_kiralar.sql
--
-- Kiralar: isletilen her birimin kira ve pay odemeleri.
--
-- Dort birim var (GOKSU KANTIN, GOKSU YEMEKHANE, AKBABA KANTIN ILKOKUL,
-- AKBABA KANTIN ORTAOKUL). Her birimde kira, il payi ve ilce payi aylik
-- odeniyor; bir de uc taksitte odenen bir kalem var.
--
-- Satirlar onceden acilmiyor: kullanici tutari girdiginde o satir olusuyor.
-- Ekran donem listesini kendisi uretiyor (Eylul 2026 - Haziran 2027), yani
-- bos donem icin veritabaninda kayit tutmaya gerek yok.
--
-- `donem`: aylik kalemlerde ayin ilk gunu (2026-09-01). Uc aylik kalemde
-- tarih anlamli degil, sira (1/2/3) ayirt edici; donem o yuzden null olur.

create table if not exists public.kiralar (
  id uuid primary key default gen_random_uuid(),
  birim text not null,
  kalem text not null check (kalem in ('kira', 'il_payi', 'ilce_payi', 'uc_aylik')),
  /** Aylik kalemlerde ayin ilk gunu; uc aylik kalemde null */
  donem date,
  /** Yalnizca uc aylik kalemde dolu: 1, 2, 3 */
  sira smallint check (sira between 1 and 3),
  tutar numeric(12,2) not null default 0,
  odeme_tarihi date,
  belge_no text,
  odendi boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ayni birim+kalem+donem (ya da sira) icin tek satir: ekran upsert ediyor
create unique index if not exists kiralar_aylik_benzersiz
  on public.kiralar (birim, kalem, donem) where donem is not null;
create unique index if not exists kiralar_taksit_benzersiz
  on public.kiralar (birim, kalem, sira) where sira is not null;

comment on table public.kiralar is
  'Birim bazli kira / il payi / ilce payi ve uc aylik odemeler.';

alter table public.kiralar enable row level security;

drop policy if exists kiralar_secme on public.kiralar;
create policy kiralar_secme on public.kiralar
  for select using (genel_erisim());

drop policy if exists kiralar_yazma on public.kiralar;
create policy kiralar_yazma on public.kiralar
  for all using (genel_erisim()) with check (genel_erisim());

drop trigger if exists kiralar_guncelleme on public.kiralar;
create trigger kiralar_guncelleme before update on public.kiralar
  for each row execute function public.set_updated_at();

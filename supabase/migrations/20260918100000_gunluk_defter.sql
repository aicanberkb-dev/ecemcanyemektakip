-- 20260918100000_gunluk_defter.sql
--
-- Finans → Günlük Defter: alışverişler, günlük gelen nakit vb.
--
-- Artı / Eksi defteriyle aynı mantık; nakit/havale yok, yerine firma var.
-- Firma serbest metin ama ekranda daha önce yazılanlardan seçilebiliyor;
-- aynı firmanın satırları toplanıp "ne aldım, ne verdim" görülüyor.

create table if not exists public.gunluk_defter (
  id          uuid primary key default gen_random_uuid(),
  yon         text not null check (yon in ('arti', 'eksi')),
  tarih       date not null default current_date,
  tutar       numeric(14,2) not null check (tutar > 0),
  firma       text,
  aciklama    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gunluk_defter_tarih_idx on public.gunluk_defter (yon, tarih);
create index if not exists gunluk_defter_firma_idx on public.gunluk_defter (firma);

drop trigger if exists set_updated_at on public.gunluk_defter;
create trigger set_updated_at before update on public.gunluk_defter
  for each row execute function public.set_updated_at();

alter table public.gunluk_defter enable row level security;
drop policy if exists gunluk_defter_secme on public.gunluk_defter;
create policy gunluk_defter_secme on public.gunluk_defter for select to authenticated using (true);
drop policy if exists gunluk_defter_yazma on public.gunluk_defter;
create policy gunluk_defter_yazma on public.gunluk_defter for all to authenticated using (true) with check (true);
revoke all on public.gunluk_defter from public, anon;
grant select, insert, update, delete on public.gunluk_defter to authenticated;

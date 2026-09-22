-- 20260922120000_gunluk_ciro.sql
--
-- Finans → Günlük Ciro: yerlerin (GÖKSU, AKBABA, TORİK) gün gün cirosu.
--
-- Yemekhane sistemindeki ciro öğrenci kayıtlarından çıkıyor; buraya elle
-- girilen rakamlar ayrı bir defter: işletmelerin günlük hasılatı. Yer serbest
-- metin ama ekranda daha önce yazılanlardan seçiliyor, aynı yer iki türlü
-- yazılıp ikiye bölünmesin.

create table if not exists public.gunluk_ciro (
  id          uuid primary key default gen_random_uuid(),
  tarih       date not null default current_date,
  yer         text not null,
  tutar       numeric(14,2) not null check (tutar >= 0),
  aciklama    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Aynı yerin aynı güne iki kaydı olmaz: ikinci giriş öncekini günceller
  unique (tarih, yer)
);

create index if not exists gunluk_ciro_tarih_idx on public.gunluk_ciro (tarih);

drop trigger if exists set_updated_at on public.gunluk_ciro;
create trigger set_updated_at before update on public.gunluk_ciro
  for each row execute function public.set_updated_at();

alter table public.gunluk_ciro enable row level security;
drop policy if exists gunluk_ciro_secme on public.gunluk_ciro;
create policy gunluk_ciro_secme on public.gunluk_ciro for select to authenticated
  using (public.genel_erisim());
drop policy if exists gunluk_ciro_yazma on public.gunluk_ciro;
create policy gunluk_ciro_yazma on public.gunluk_ciro for all to authenticated
  using (public.genel_erisim()) with check (public.genel_erisim());
revoke all on public.gunluk_ciro from public, anon;
grant select, insert, update, delete on public.gunluk_ciro to authenticated;

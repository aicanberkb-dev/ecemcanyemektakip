-- 20260922170000_gunluk_gider.sql
--
-- Finans → Günlük Gider: o gün ne harcandıysa satır satır yazılan defter.
--
-- Günlük Defter firma bazlı çalışıyor (alınan mal / ödenen). Buradaki kayıt
-- daha serbest: gün içindeki giderler not gibi düşülüyor, firma ya da eşleşme
-- aranmıyor. Tek gruplama gün.

create table if not exists public.gunluk_gider (
  id          uuid primary key default gen_random_uuid(),
  tarih       date not null default current_date,
  tutar       numeric(14,2) not null check (tutar >= 0),
  aciklama    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gunluk_gider_tarih_idx on public.gunluk_gider (tarih);

drop trigger if exists set_updated_at on public.gunluk_gider;
create trigger set_updated_at before update on public.gunluk_gider
  for each row execute function public.set_updated_at();

alter table public.gunluk_gider enable row level security;
drop policy if exists gunluk_gider_secme on public.gunluk_gider;
create policy gunluk_gider_secme on public.gunluk_gider for select to authenticated
  using (public.genel_erisim());
drop policy if exists gunluk_gider_yazma on public.gunluk_gider;
create policy gunluk_gider_yazma on public.gunluk_gider for all to authenticated
  using (public.genel_erisim()) with check (public.genel_erisim());
revoke all on public.gunluk_gider from public, anon;
grant select, insert, update, delete on public.gunluk_gider to authenticated;

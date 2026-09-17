-- 20260917100000_arti_eksi.sql
--
-- Finans → Artı / Eksi: elle tutulan gelir–gider defteri.
--
-- Okula bağlı değil (Genel mod). Her satır bir artı ya da eksi; tarih, tutar,
-- nakit/havale ve açıklama. Ekran artılardan eksileri çıkarıp farkı gösterir.

create table if not exists public.arti_eksi (
  id          uuid primary key default gen_random_uuid(),
  yon         text not null check (yon in ('arti', 'eksi')),
  tarih       date not null default current_date,
  tutar       numeric(14,2) not null check (tutar > 0),
  yontem      text not null check (yontem in ('nakit', 'havale')),
  aciklama    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists arti_eksi_tarih_idx on public.arti_eksi (yon, tarih);

drop trigger if exists set_updated_at on public.arti_eksi;
create trigger set_updated_at before update on public.arti_eksi
  for each row execute function public.set_updated_at();

alter table public.arti_eksi enable row level security;
drop policy if exists arti_eksi_secme on public.arti_eksi;
create policy arti_eksi_secme on public.arti_eksi for select to authenticated using (true);
drop policy if exists arti_eksi_yazma on public.arti_eksi;
create policy arti_eksi_yazma on public.arti_eksi for all to authenticated using (true) with check (true);
revoke all on public.arti_eksi from public, anon;
grant select, insert, update, delete on public.arti_eksi to authenticated;

-- Cumhuriyet defteri: Artı/Eksi ekranının birebir aynısı, ayrı hesap.
-- Aynı kurgu: artı giren, eksi çıkan; eksiler günlük masrafa da yazılıyor.
create table if not exists public.cumhuriyet (
  id uuid primary key default gen_random_uuid(),
  yon text not null check (yon in ('arti', 'eksi')),
  tarih date not null default current_date,
  tutar numeric not null check (tutar >= 0),
  yontem text not null check (yontem in ('nakit', 'havale')),
  aciklama text,
  gider_id uuid references public.gunluk_gider(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cumhuriyet_tarih_idx on public.cumhuriyet (tarih);
create index if not exists cumhuriyet_gider_id_idx on public.cumhuriyet (gider_id);

alter table public.cumhuriyet enable row level security;

drop policy if exists cumhuriyet_secme on public.cumhuriyet;
create policy cumhuriyet_secme on public.cumhuriyet for select using (genel_erisim());

drop policy if exists cumhuriyet_yazma on public.cumhuriyet;
create policy cumhuriyet_yazma on public.cumhuriyet for all
  using (genel_erisim()) with check (genel_erisim());

drop trigger if exists cumhuriyet_updated_at on public.cumhuriyet;
create trigger cumhuriyet_updated_at before update on public.cumhuriyet
  for each row execute function public.set_updated_at();

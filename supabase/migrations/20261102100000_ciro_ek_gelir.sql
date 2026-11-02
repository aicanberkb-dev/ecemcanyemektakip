-- Gunluk ciroda yerlerin hasilati disinda kalan gelirler.
--
-- Bir gun kaymakamliktan odeme, iade, bagis gibi yerlerin kasasindan
-- gelmeyen para girebiliyor. Yer sutunlarina sigmadigi icin ayri tabloda:
-- bir gunde birden fazla olabiliyor ve nereden geldigi yaziliyor.

create table if not exists public.ciro_ek_gelir (
  id uuid primary key default gen_random_uuid(),
  tarih date not null,
  kaynak text not null,
  tutar numeric(12, 2) not null check (tutar >= 0),
  aciklama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ciro_ek_gelir_tarih on public.ciro_ek_gelir (tarih);

drop trigger if exists ciro_ek_gelir_updated_at on public.ciro_ek_gelir;
create trigger ciro_ek_gelir_updated_at
  before update on public.ciro_ek_gelir
  for each row execute function public.set_updated_at();

alter table public.ciro_ek_gelir enable row level security;

drop policy if exists ciro_ek_gelir_erisim on public.ciro_ek_gelir;
create policy ciro_ek_gelir_erisim on public.ciro_ek_gelir
  for all using (genel_erisim()) with check (genel_erisim());

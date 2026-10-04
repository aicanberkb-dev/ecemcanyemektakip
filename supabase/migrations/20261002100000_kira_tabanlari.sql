-- 20261002100000_kira_tabanlari.sql
--
-- Kira bedeli (aylik taban) ve ondan turetilen kalemler.
--
-- Odemeler tek bir taban rakamdan cikiyor:
--   arz    = taban x %3           (3 ayda bir, aylik karsiliginin uc kati)
--   kalan  = taban - arz
--   il     = kalan x %10
--   ilce   = kalan x %10
--   kira   = kalan - il - ilce    (okula yatan)
--
-- Taban burada saklaniyor ki zam gelince yeni rakam girilip kalemler
-- yeniden hesaplanabilsin; kalemlerin kendisi `kiralar` tablosunda.
--
-- Anahtar, ekrandaki odeme grubunu temsil ediyor: Akbaba'da kira iki okula
-- bolunup paylar tek yattigi icin grup tek tabanla yonetiliyor.

create table if not exists public.kira_tabanlari (
  anahtar text primary key,
  tutar numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.kira_tabanlari is
  'Odeme grubunun aylik taban kira bedeli; kalemler bundan hesaplanir.';

alter table public.kira_tabanlari enable row level security;

drop policy if exists kira_tabanlari_secme on public.kira_tabanlari;
create policy kira_tabanlari_secme on public.kira_tabanlari
  for select using (genel_erisim());

drop policy if exists kira_tabanlari_yazma on public.kira_tabanlari;
create policy kira_tabanlari_yazma on public.kira_tabanlari
  for all using (genel_erisim()) with check (genel_erisim());

drop trigger if exists kira_tabanlari_guncelleme on public.kira_tabanlari;
create trigger kira_tabanlari_guncelleme before update on public.kira_tabanlari
  for each row execute function public.set_updated_at();

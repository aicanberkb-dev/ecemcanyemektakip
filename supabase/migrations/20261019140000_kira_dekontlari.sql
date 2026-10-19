-- Kira odeme dekontlari.
--
-- Bir dekont birden fazla taksiti kapsayabiliyor: dort taksit tek seferde
-- yatirildiginda tek dosya dort satira baglaniyor. Tersi de olabilir,
-- tek taksitlik dekont da yukleniyor. Bu yuzden ara tablo var.
--
-- Dosyalar kira-dekontlari kovasinda, okul klasorlerinde; kova herkese
-- acik degil, imzali baglantiyla aciliyor.

create table if not exists public.kira_dekontlari (
  id uuid primary key default gen_random_uuid(),
  birim text not null,
  dosya_yolu text not null unique,
  dosya_adi text not null,
  odeme_tarihi date,
  tutar numeric(12, 2),
  aciklama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kira_dekont_satirlari (
  dekont_id uuid not null references public.kira_dekontlari (id) on delete cascade,
  kira_id uuid not null references public.kiralar (id) on delete cascade,
  primary key (dekont_id, kira_id)
);

-- Bir taksitin tek dekontu olur: ekranda rozet tek, ikinci dosya baglanmak
-- istenirse once eskisi kaldiriliyor.
create unique index if not exists kira_dekont_satiri_benzersiz
  on public.kira_dekont_satirlari (kira_id);

create index if not exists kira_dekontlari_birim on public.kira_dekontlari (birim);

drop trigger if exists kira_dekontlari_updated_at on public.kira_dekontlari;
create trigger kira_dekontlari_updated_at
  before update on public.kira_dekontlari
  for each row execute function public.set_updated_at();

alter table public.kira_dekontlari enable row level security;
alter table public.kira_dekont_satirlari enable row level security;

drop policy if exists kira_dekontlari_erisim on public.kira_dekontlari;
create policy kira_dekontlari_erisim on public.kira_dekontlari
  for all using (genel_erisim()) with check (genel_erisim());

drop policy if exists kira_dekont_satirlari_erisim on public.kira_dekont_satirlari;
create policy kira_dekont_satirlari_erisim on public.kira_dekont_satirlari
  for all using (genel_erisim()) with check (genel_erisim());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kira-dekontlari', 'kira-dekontlari', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    public = excluded.public;

drop policy if exists kira_dekont_okuma on storage.objects;
create policy kira_dekont_okuma on storage.objects
  for select using (bucket_id = 'kira-dekontlari' and genel_erisim());

drop policy if exists kira_dekont_yukleme on storage.objects;
create policy kira_dekont_yukleme on storage.objects
  for insert with check (bucket_id = 'kira-dekontlari' and genel_erisim());

drop policy if exists kira_dekont_guncelleme on storage.objects;
create policy kira_dekont_guncelleme on storage.objects
  for update using (bucket_id = 'kira-dekontlari' and genel_erisim())
  with check (bucket_id = 'kira-dekontlari' and genel_erisim());

drop policy if exists kira_dekont_silme on storage.objects;
create policy kira_dekont_silme on storage.objects
  for delete using (bucket_id = 'kira-dekontlari' and genel_erisim());

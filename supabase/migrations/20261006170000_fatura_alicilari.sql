-- 20261006170000_fatura_alicilari.sql
--
-- Faturanin kime kesilecegi.
--
-- Ogrencinin iki velisi olabiliyor ve fatura bazen ikisinden birine, bazen
-- de bambaska birine (dede, sirket) kesiliyor. Bugune kadar bu bilgi
-- fatura_bilgisi serbest metninde duruyordu; Luca'da aranacak ad ve vergi
-- numarasi oradan okunamiyordu.
--
-- Kayit yoksa alici birinci veli, o da yoksa ogrencinin kendisi sayilir --
-- bugune kadarki davranis bu, kimse icin satir acmak gerekmesin.

create table if not exists public.fatura_alicilari (
  student_id uuid primary key references public.students(id) on delete cascade,
  -- veli1 / veli2 / ogrenci: ad anaveriden okunur, burada tutulmaz
  -- diger: ad ve vergi bilgileri asagidaki alanlarda
  tip text not null default 'veli1' check (tip in ('veli1', 'veli2', 'ogrenci', 'diger')),
  ad text,
  vergi_no text,
  vergi_dairesi text,
  adres text,
  updated_at timestamptz not null default now(),
  -- "Diger" secildiyse ad zorunlu: adsiz alici faturaya yazilamaz
  constraint fatura_alicilari_diger_ad check (tip <> 'diger' or btrim(coalesce(ad, '')) <> '')
);

comment on table public.fatura_alicilari is
  'Ogrencinin faturasinin kime kesilecegi; kayit yoksa birinci veli.';

alter table public.fatura_alicilari enable row level security;

drop policy if exists fatura_alicilari_secme on public.fatura_alicilari;
create policy fatura_alicilari_secme on public.fatura_alicilari
  for select using (
    exists (select 1 from public.students s
            where s.id = student_id and okul_erisimi(s.okul_id))
  );

drop policy if exists fatura_alicilari_yazma on public.fatura_alicilari;
create policy fatura_alicilari_yazma on public.fatura_alicilari
  for all using (
    exists (select 1 from public.students s
            where s.id = student_id and okul_erisimi(s.okul_id))
  ) with check (
    exists (select 1 from public.students s
            where s.id = student_id and okul_erisimi(s.okul_id))
  );

drop trigger if exists fatura_alicilari_guncelleme on public.fatura_alicilari;
create trigger fatura_alicilari_guncelleme before update on public.fatura_alicilari
  for each row execute function public.set_updated_at();

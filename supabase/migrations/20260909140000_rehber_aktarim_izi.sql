-- Telefon rehberine hangi numaralarin aktarildiginin izi.
--
-- Rehber dosyasi her indirildiginde butun veliler yeniden geliyordu; ogrenci
-- sayisi arttikca her aktarimda yuzlerce mukerrer kisi olusacakti. Bu tablo
-- daha once verilenleri tutuyor, indirme yalnizca yeni ve adi degismis
-- kisileri uretiyor.
--
-- Anahtar telefon numarasi: kisiyi rehberde tekillestiren sey numara. Ad
-- degisirse (veli adi duzeltildi, kardes eklendi) kart yeniden verilmeli,
-- bu yuzden ad da saklaniyor.
create table if not exists public.rehber_kayitlari (
  telefon text primary key,
  ad text not null,
  okul_id uuid references public.okullar(id) on delete set null,
  ilk_aktarim timestamptz not null default now(),
  son_aktarim timestamptz not null default now()
);

comment on table public.rehber_kayitlari is
  'Telefon rehberine aktarilmis veli numaralari; mukerrer kisi olusmasin diye.';

alter table public.rehber_kayitlari enable row level security;

drop policy if exists rehber_kayitlari_select on public.rehber_kayitlari;
drop policy if exists rehber_kayitlari_yaz on public.rehber_kayitlari;
drop policy if exists rehber_kayitlari_guncelle on public.rehber_kayitlari;
drop policy if exists rehber_kayitlari_sil on public.rehber_kayitlari;

create policy rehber_kayitlari_select on public.rehber_kayitlari
  for select using (true);

create policy rehber_kayitlari_yaz on public.rehber_kayitlari
  for insert with check (auth.uid() is not null);

create policy rehber_kayitlari_guncelle on public.rehber_kayitlari
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy rehber_kayitlari_sil on public.rehber_kayitlari
  for delete using (auth.uid() is not null);

-- Ekstre aktarımlarının kaydı.
--
-- Aktarımdan sonra "hangi dosyayı ne zaman, kim yükledi, kaç kayıt girdi"
-- sorusunun cevabı hiçbir yerde durmuyordu. Mükerrer bir ödeme fark edildiğinde
-- geriye dönüp bakılacak bir iz yok; işlemler tek tek tahsilat olarak
-- görünüyor ve hangisinin hangi dosyadan geldiği bilinmiyordu.
create table if not exists public.ekstre_aktarimlari (
  id uuid primary key default gen_random_uuid(),
  okul_id uuid not null references public.okullar(id) on delete cascade,
  dosya_adi text not null,
  aktaran_user_id uuid not null default auth.uid() references auth.users(id),
  satir_sayisi integer not null default 0,
  eklenen integer not null default 0,
  atlanan integer not null default 0,
  mukerrer_atlanan integer not null default 0,
  toplam_tutar numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.ekstre_aktarimlari is
  'Banka ekstresi aktarimlarinin kaydi: hangi dosya, ne zaman, kim, kac kayit.';

create index if not exists ekstre_aktarimlari_okul_tarih
  on public.ekstre_aktarimlari (okul_id, created_at desc);

alter table public.transactions
  add column if not exists ekstre_aktarim_id uuid
    references public.ekstre_aktarimlari(id) on delete set null;

create index if not exists transactions_ekstre_aktarim
  on public.transactions (ekstre_aktarim_id)
  where ekstre_aktarim_id is not null;

alter table public.ekstre_aktarimlari enable row level security;

drop policy if exists ekstre_aktarimlari_select on public.ekstre_aktarimlari;
drop policy if exists ekstre_aktarimlari_insert on public.ekstre_aktarimlari;
drop policy if exists ekstre_aktarimlari_update on public.ekstre_aktarimlari;
drop policy if exists ekstre_aktarimlari_delete on public.ekstre_aktarimlari;

create policy ekstre_aktarimlari_select on public.ekstre_aktarimlari
  for select using (true);

create policy ekstre_aktarimlari_insert on public.ekstre_aktarimlari
  for insert with check (aktaran_user_id = auth.uid());

create policy ekstre_aktarimlari_update on public.ekstre_aktarimlari
  for update using (true) with check (aktaran_user_id = auth.uid());

create policy ekstre_aktarimlari_delete on public.ekstre_aktarimlari
  for delete using (true);

-- Dosyanin kapsadigi tarih araligi: "su tarihler arasi ekstre, su saatte
-- aktarildi" diyebilmek icin. Aktarim saati ile ekstrenin ait oldugu gunler
-- farkli seyler.
alter table public.ekstre_aktarimlari
  add column if not exists ekstre_bas date,
  add column if not exists ekstre_bit date;

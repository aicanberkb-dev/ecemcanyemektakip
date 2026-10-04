-- 20261002120000_kiralar_taksit.sql
--
-- Kira, il payi ve ilce payi aylik donem yerine sekiz taksit olarak yatiyor.
--
-- Once iki ayin yan yana durdugu dokuz donemlik bir model kurulmustu; is
-- oyle yurumuyor: sekiz taksit yatiriliyor ve taksitin ay takvimiyle bagi
-- yok. Uc aylik arz aynen kaliyor (yilda uc kez, sira 1-3).
--
-- Donusum: her birim+kalem icin donem sirasina gore 1..8 taksit numarasi
-- verilir, dokuzuncu satir silinir. Silinen satirlarin hicbirinde odeme yok
-- (odendi false, tarih ve belge bos) -- yalnizca tutar tasiyorlar, o da
-- taksit 8'de ayni rakamla duruyor. Odenmis satirlar en eski donemler
-- oldugu icin taksit 1-3'e dusuyor; tutar, tarih ve odendi korunuyor.
--
-- Sonrasinda donem kolonu kalkiyor: artik hicbir satirda deger tasimiyor
-- ve benzersizlik indeksinde durmasi upsert'u yanlis anahtara baglar.

-- 1) Eski kisit once kalkar: `sira between 1 and 3` diyor, oysa asagidaki
-- guncelleme 4-8 yaziyor. Kisit en sona birakilirsa guncelleme hata verir.
alter table public.kiralar drop constraint if exists kiralar_sira_check;

-- 2) Dokuzuncu ve sonrasi: tasidigi bilgi yok, taksite sigmiyor
with sirali as (
  select id, row_number() over (partition by birim, kalem order by donem) as n
  from public.kiralar
  where kalem <> 'uc_aylik' and donem is not null
)
delete from public.kiralar k
using sirali s
where k.id = s.id and s.n > 8;

-- 3) Kalanlar donem sirasina gore taksit numarasi alir
with sirali as (
  select id, row_number() over (partition by birim, kalem order by donem) as n
  from public.kiralar
  where kalem <> 'uc_aylik' and donem is not null
)
update public.kiralar k
set sira = s.n, donem = null
from sirali s
where k.id = s.id;

-- 4) Model artik tamamen taksit uzerinden
drop index if exists public.kiralar_benzersiz;

alter table public.kiralar drop column if exists donem;

alter table public.kiralar alter column sira set not null;

alter table public.kiralar add constraint kiralar_sira_check
  check (case when kalem = 'uc_aylik' then sira between 1 and 3 else sira between 1 and 8 end);

create unique index kiralar_benzersiz on public.kiralar (birim, kalem, sira);

comment on column public.kiralar.sira is
  'Taksit sirasi: kira/il/ilce icin 1-8, uc aylik arz icin 1-3.';

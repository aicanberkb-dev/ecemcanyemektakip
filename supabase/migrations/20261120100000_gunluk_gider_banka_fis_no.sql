-- Kart harcamaları ekstreden aktarılıyor; aynı ekstre iki kez yüklenirse
-- satırlar ikilenmesin diye bankanın fiş numarası saklanıyor.
--
-- Elle girilen masraflarda fiş no yok, o yüzden sütun null kalabiliyor;
-- benzersizlik yalnız dolu olanlar için geçerli.
alter table public.gunluk_gider
  add column if not exists banka_fis_no text;

create unique index if not exists gunluk_gider_banka_fis_no_key
  on public.gunluk_gider (banka_fis_no)
  where banka_fis_no is not null;

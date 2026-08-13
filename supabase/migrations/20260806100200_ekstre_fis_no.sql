-- 20260806100200_ekstre_fis_no.sql
--
-- Banka ekstresinden aktarılan tahsilatlar için fiş numarası.
--
-- Aynı ekstre iki kez yüklenirse tahsilatlar ikinci kez işlenmemeli. Fiş
-- numarası tek başına yeterli değil (iki farklı hesabın fiş numaraları
-- teorik olarak çakışabilir), o yüzden benzersizlik fiş no + tarih + tutar
-- üçlüsünde. Elle girilen tahsilatlarda alan boş kalır ve kısıt işlemez.

alter table public.transactions add column if not exists banka_fis_no text;

create unique index if not exists transactions_banka_fis_uniq
  on public.transactions (banka_fis_no, tarih, tutar)
  where banka_fis_no is not null;

comment on column public.transactions.banka_fis_no is
  'Banka ekstresindeki fiş numarası. Yalnızca ekstre aktarımıyla oluşan '
  'tahsilatlarda dolu; mükerrer aktarımı engeller.';

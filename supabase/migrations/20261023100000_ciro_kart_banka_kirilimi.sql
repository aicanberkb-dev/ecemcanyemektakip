-- Gunluk ciroda kredi karti tutarinin banka kirilimi.
--
-- Poslar iki ayri bankaya bagli; hangi bankadan ne kadar geldigi
-- izlenebilsin isteniyor. Kirilim istege bagli: bos birakilinca kart
-- tutari eskisi gibi tek rakam olarak giriliyor.
--
-- Banka adi -> tutar seklinde jsonb: banka listesi sabit degil, kullanici
-- yeni banka adi yazabiliyor. Dolduruldugunda kart sutunu kirilimin
-- toplami oluyor, iki rakam birbirini tutmaz hale gelmesin.

alter table public.gunluk_ciro
  add column if not exists kart_kirilimi jsonb;

comment on column public.gunluk_ciro.kart_kirilimi is
  'Banka adi -> tutar. Bos ise kart tek rakam girilmis demektir.';

-- Hesaba yatan tutarin da banka kirilimi tutuluyor.
--
-- kart_kirilimi: banka -> Z raporu tutari (posun cektigi)
-- kart_yatan_kirilimi: banka -> hesaba gecen tutar
-- Ikisinin farki banka banka pos komisyonunu veriyor.

alter table public.gunluk_ciro
  add column if not exists kart_yatan_kirilimi jsonb;

comment on column public.gunluk_ciro.kart_yatan_kirilimi is
  'Banka adi -> hesaba gecen tutar. kart_kirilimi ile farki banka bazinda komisyon.';

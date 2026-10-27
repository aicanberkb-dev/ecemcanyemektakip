-- Kredi kartinda Z raporu ile hesaba yatan ayri tutuluyor.
--
-- kart sutunu Z raporudur: posun o gun cektigi brut tutar, ciroya o girer.
-- kart_yatan bankadan hesaba gecen net tutardir; aradaki fark pos
-- komisyonu. Yatan girilmezse komisyon hesaplanmaz, eski davranis surer.

alter table public.gunluk_ciro
  add column if not exists kart_yatan numeric(12, 2);

comment on column public.gunluk_ciro.kart is
  'Z raporu: posun cektigi brut kart tutari. Ciro bundan hesaplanir.';
comment on column public.gunluk_ciro.kart_yatan is
  'Hesaba gecen net tutar. kart - kart_yatan = pos komisyonu.';

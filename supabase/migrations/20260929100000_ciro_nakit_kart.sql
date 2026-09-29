-- 20260929100000_ciro_nakit_kart.sql
--
-- Gunluk ciro nakit ve kredi karti olarak ayrilsin.
--
-- Dukkanlarin hasilati tek kalemdi; ne kadarinin kasada nakit durdugu, ne
-- kadarinin hesaba gececegi gorunmuyordu.
--
-- `tutar` toplam olarak kaliyor ve uygulama nakit + kart olarak yaziyor.
-- Ayrimdan onceki satirlara dokunulmuyor: toplamlari dogru, kirilimlari
-- bos kaliyor. Bir gunu yeniden girince kirilimiyla yerine yaziliyor.

alter table public.gunluk_ciro
  add column if not exists nakit numeric(12,2) not null default 0,
  add column if not exists kart  numeric(12,2) not null default 0;

comment on column public.gunluk_ciro.nakit is
  'Gunun nakit hasilati; ayrimdan onceki kayitlarda 0 kalir.';
comment on column public.gunluk_ciro.kart is
  'Gunun kredi karti hasilati; ayrimdan onceki kayitlarda 0 kalir.';
comment on column public.gunluk_ciro.tutar is
  'Gunun toplam hasilati (nakit + kart).';

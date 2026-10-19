-- Ahmet Mithat yemekhanesinde kiraya ek olarak elektrik, su ve isinma
-- gideri de taksitle yatiriliyor; kalem listesine ekleniyor.
alter table public.kiralar drop constraint kiralar_kalem_check;

alter table public.kiralar
  add constraint kiralar_kalem_check
  check (kalem = any (array['kira', 'il_payi', 'ilce_payi', 'uc_aylik', 'giderler']));

insert into public.kiralar (birim, kalem, sira, tutar, odendi)
select 'AHMET MİTHAT YEMEKHANE', 'giderler', s, 1000.00, false
from generate_series(1, 8) s
on conflict (birim, kalem, sira) do nothing;

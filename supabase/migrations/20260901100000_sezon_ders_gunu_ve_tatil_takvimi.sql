-- 20260901100000_sezon_ders_gunu_ve_tatil_takvimi.sql
--
-- Sezonun planlanan ders gunu sayisi ve 2026-2027 MEB tatil takvimi.
--
-- Aylikcinin gunluk hakedisi = yillik ucret / ders gunu. Bolen sezon
-- basinda sabitlenir; sonradan eklenen bir gezi ya da kar tatili bu sayiyi
-- degistirmez, yoksa gecmis aylarin cirosu geriye donuk oynardi.
--
-- 205 hafta ici gun - 27 tatil = 178 ders gunu.

alter table public.sezonlar
  add column if not exists ders_gunu_sayisi int
  check (ders_gunu_sayisi is null or ders_gunu_sayisi between 1 and 300);

update public.sezonlar
set baslangic = '2026-09-14', bitis = '2027-06-25', ders_gunu_sayisi = 178
where ad = '2026-2027';

insert into public.okulsuz_gunler (tarih, hizmet_noktasi_id, sebep)
select d::date, null, v.sebep
from (values
  ('2026-10-28','2026-10-29','Cumhuriyet Bayrami'),
  ('2026-11-16','2026-11-20','1. ara tatil'),
  ('2027-01-01','2027-01-01','Yilbasi'),
  ('2027-01-25','2027-02-05','Yariyil tatili'),
  ('2027-03-08','2027-03-12','2. ara tatil / Ramazan Bayrami'),
  ('2027-04-23','2027-04-23','23 Nisan Ulusal Egemenlik ve Cocuk Bayrami'),
  ('2027-05-17','2027-05-19','Kurban Bayrami / 19 Mayis')
) as v(bas, bit, sebep)
cross join lateral generate_series(v.bas::date, v.bit::date, interval '1 day') d
where extract(isodow from d) < 6
on conflict do nothing;

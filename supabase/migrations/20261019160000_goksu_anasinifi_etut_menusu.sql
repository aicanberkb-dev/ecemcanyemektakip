-- GOKSU anasinifi etut yemegi icin ayri menu listesi.
--
-- Kendi listesi var cunku etut yemegi okulun ogle menusunden bagimsiz
-- yaziliyor. Uc cesit: corba, ana yemek, yardimci; ek satiri yok.
-- okul_id GOKSU: liste yalnizca genel modda ve GOKSU secildiginde gorunur.

insert into public.menu_listeleri (ad, havuz_grubu, okul_id, satir_sayisi, sira, aktif)
select
  'GÖKSU ANASINIFI ETÜT YEMEĞİ',
  'genel',
  (select id from public.okullar where upper(ad) like 'GÖKSU%' limit 1),
  3,
  6,
  true
where not exists (
  select 1 from public.menu_listeleri where ad = 'GÖKSU ANASINIFI ETÜT YEMEĞİ'
);

-- Afisin basligina listenin adi da yazilabilsin.
--
-- Okul menulerinde ad yazmiyor: afis zaten o okulun velilerine gidiyor.
-- Ama etut yemegi gibi ayri listelerde hangi liste oldugu belirtilmeli.
-- Bos birakilan listelerin afisi eskisi gibi kaliyor.

alter table public.menu_listeleri
  add column if not exists afis_basligi text;

update public.menu_listeleri
set afis_basligi = 'Göksu Anasınıfı Etüt Yemeği'
where ad = 'GÖKSU ANASINIFI ETÜT YEMEĞİ' and afis_basligi is null;

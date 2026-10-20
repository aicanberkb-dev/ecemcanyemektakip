-- Etut yemegi listesi okula bagli olmaktan cikariliyor.
--
-- okul_id GOKSU iken liste okulun kendi menusu sayiliyordu:
--   * Yemek Katilimi raporunda SUT, AYRAN, HAVUC birer "ana yemek" olarak
--     GOKSU'nun ogun sayilarina karisiyordu,
--   * Gun Sonu ekrani o gunun menusunu tek satir bekledigi icin iki liste
--     ayni gune dolunca menuyu hic gosteremiyordu.
--
-- TASIMALI, OZEL EGITIM ve KAYMAKAMLIK gibi bagimsiz listelerde okul_id
-- zaten bos; etut yemegi de onlarla ayni kategoride. Liste menu ekraninda
-- gorunmeye devam ediyor, okul raporlarina girmiyor.

update public.menu_listeleri
set okul_id = null
where ad = 'GÖKSU ANASINIFI ETÜT YEMEĞİ';

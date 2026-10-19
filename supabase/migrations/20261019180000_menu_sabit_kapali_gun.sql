-- Bir listede her hafta ayni gun yemek cikmiyorsa kural olarak yazilsin.
--
-- GOKSU anasinifi etut yemegi cuma gunleri hic verilmiyor. Her ay tek tek
-- kapali gun isaretlemek yerine listeye bagli bir kural tutuluyor: yalnizca
-- bu liste etkileniyor, oburlerinde alan bos oldugu icin hicbir sey degismiyor.
--
-- kapali_haftagunu: 1 pazartesi ... 7 pazar (ISO).

alter table public.menu_listeleri
  add column if not exists kapali_haftagunu smallint,
  add column if not exists kapali_notu text;

alter table public.menu_listeleri
  drop constraint if exists menu_listeleri_kapali_haftagunu_check;
alter table public.menu_listeleri
  add constraint menu_listeleri_kapali_haftagunu_check
  check (kapali_haftagunu is null or kapali_haftagunu between 1 and 7);

update public.menu_listeleri
set kapali_haftagunu = 5,
    kapali_notu = 'CUMA - ETÜT YEMEĞİ YOK'
where ad = 'GÖKSU ANASINIFI ETÜT YEMEĞİ' and kapali_haftagunu is null;

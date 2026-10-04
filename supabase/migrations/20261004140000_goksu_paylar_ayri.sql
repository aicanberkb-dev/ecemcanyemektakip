-- 20261004140000_goksu_paylar_ayri.sql
--
-- GOKSU'da kira ortak, paylar ayri.
--
-- Bir onceki adimda hepsi tek birimde toplanmisti; oysa yalnizca kira
-- ortak yatiyor. Il payi, ilce payi ve arz yeniden kantin ve yemekhane
-- olarak ikiye ayriliyor (tutar tam yariya boluyor, odendi isareti ve
-- tarih korunuyor). Kira 'GÖKSU' biriminde tek kalem olarak kaliyor.
--
-- Elle girilmis satirlar dokunulmadan birakiliyor: ayni (birim, kalem,
-- taksit) icin kayit varsa o kalir.

insert into public.kiralar (birim, kalem, sira, tutar, odeme_tarihi, belge_no, odendi)
select b.birim, k.kalem, k.sira, k.tutar / 2, k.odeme_tarihi, k.belge_no, k.odendi
from public.kiralar k
cross join (values ('GÖKSU KANTİN'), ('GÖKSU YEMEKHANE')) as b(birim)
where k.birim = 'GÖKSU' and k.kalem <> 'kira'
on conflict (birim, kalem, sira) do nothing;

delete from public.kiralar where birim = 'GÖKSU' and kalem <> 'kira';

-- Kantinin arz odemesi 28.09'da yapilmisti; birlestirmede gec tarih kalmisti
update public.kiralar set odeme_tarihi = '2026-09-28'
where birim = 'GÖKSU KANTİN' and kalem = 'uc_aylik' and sira = 1 and odendi;

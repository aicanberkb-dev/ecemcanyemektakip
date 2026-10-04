-- 20261004130000_goksu_birlesik.sql
--
-- GOKSU kantin ve yemekhane tek birim.
--
-- Kira ikisi icin ayni yere, tek kalemde yatiyor; ayri ayri girmek hem
-- fazladan is hem de yaniltiyordu. Satirlar (kalem, taksit) basinda
-- toplaniyor: tutar iki birimin toplami, odendi ancak ikisi de odenmisse
-- dogru, tarih ikisinden gec olani. Toplam tutar degismiyor.

insert into public.kiralar (birim, kalem, sira, tutar, odeme_tarihi, belge_no, odendi)
select 'GÖKSU', kalem, sira, sum(tutar), max(odeme_tarihi),
       string_agg(belge_no, ' / '), bool_and(odendi)
from public.kiralar
where birim in ('GÖKSU KANTİN', 'GÖKSU YEMEKHANE')
group by kalem, sira;

delete from public.kiralar where birim in ('GÖKSU KANTİN', 'GÖKSU YEMEKHANE');

-- Taban da birlesiyor: 37.500 + 37.500 = 75.000
insert into public.kira_tabanlari (anahtar, sira, tutar)
select 'GÖKSU', sira, sum(tutar)
from public.kira_tabanlari
where anahtar in ('GÖKSU KANTİN', 'GÖKSU YEMEKHANE')
group by sira;

delete from public.kira_tabanlari where anahtar in ('GÖKSU KANTİN', 'GÖKSU YEMEKHANE');

-- 20260814120100_menu_satir_sayisi.sql
--
-- Her listenin satır sayısı ve okulsuz listeler.
--
-- Okul menüsü dört kalem (çorba / ana yemek / yardımcı / 4. kalem); taşımalı
-- menü üç kalem ve satırların içeriği sabit değil — bir gün ilk satır çorba,
-- başka gün pilav olabiliyor. Ekran etiketleri buna göre değişsin diye satır
-- sayısını listenin kendisinde tutuyoruz.

alter table public.menu_listeleri
  add column if not exists satir_sayisi int not null default 4
  check (satir_sayisi between 1 and 4);

update public.menu_listeleri set satir_sayisi = 3 where havuz_grubu = 'tasimali';

-- Taşımalı / özel eğitim / kaymakamlık listelerinin okulu yok
alter table public.menu_gunleri alter column okul_id drop not null;

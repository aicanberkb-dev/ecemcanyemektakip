-- 20260827100000_fatura_donem_benzersiz.sql
--
-- Bir cariye bir dönemde tek fatura.
--
-- Alacaklar ekranı artık her ay için şablon açıyor: aktif carilerin hepsi
-- satır olarak geliyor, kullanıcı yalnızca adet ve tutarı yazıyor. Kaydetme
-- upsert ile çalıştığı için (cari, yıl, ay) üçlüsünün benzersiz olması şart;
-- aksi hâlde aynı ay için ikinci bir satır oluşur ve toplam ikiye katlanır.

create unique index if not exists faturalar_cari_donem_benzersiz
  on public.faturalar (cari_id, donem_yil, donem_ay);

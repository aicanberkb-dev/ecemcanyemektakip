-- 20261001150000_kiralar_benzersiz.sql
--
-- Kiralar ekraninda girilen satir kaydedilmiyordu.
--
-- Benzersizlik iki **kismi** indeksle kurulmustu (donem is not null /
-- sira is not null). PostgREST'in upsert'u ON CONFLICT (birim,kalem,donem)
-- seklinde cikiyor ve Postgres kismi bir indeksi ancak indeksin WHERE
-- kosulu da verilirse eslestiriyor. Kosul gonderilmedigi icin upsert
-- "matching ON CONFLICT specification yok" diye hata veriyordu: elle
-- girilen satir kaydedilmiyor, yalnizca tutar yayma (update/insert ile
-- calistigi icin) tutuyordu.
--
-- Cozum tek bir tam indeks. Aylik satirda sira, uc aylik satirda donem
-- null oldugu icin `nulls not distinct` sart: Postgres'in varsayilaninda
-- null'lar birbirinden farkli sayilir ve ayni donem icin ikinci bir satir
-- acilabilirdi.

drop index if exists public.kiralar_aylik_benzersiz;
drop index if exists public.kiralar_taksit_benzersiz;

create unique index if not exists kiralar_benzersiz
  on public.kiralar (birim, kalem, donem, sira) nulls not distinct;

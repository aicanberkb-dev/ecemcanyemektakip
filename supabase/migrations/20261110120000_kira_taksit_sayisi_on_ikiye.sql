-- GÖKSU 8,5 aylık sözleşmede on taksite çıktı: geçen sezonun kapanış
-- taksiti, sekiz tam ay (Kasım 2026 – Haziran 2027) ve bir yarım ay
-- (Kasım 2027). Sınır on ikiye açılıyor ki başka okul daha uzun bir
-- düzene geçerse tekrar şema değişikliği gerekmesin.
alter table public.kiralar drop constraint if exists kiralar_sira_check;
alter table public.kiralar add constraint kiralar_sira_check check (sira between 1 and 12);

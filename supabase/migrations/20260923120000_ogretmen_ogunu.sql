-- 20260923120000_ogretmen_ogunu.sql
--
-- Yemekhanede ücretli öğün nakit ve kredi kartı olarak ayrılıyor; ayrıca
-- öğretmen öğünü kendi ücretiyle ayrı bir tip oluyor.
--
-- Şimdiye kadar "ücretli" tek kalemdi ve nakit sayılıyordu; kartla ödenen
-- öğünler gün sonunda kasayla tutmuyordu. Öğretmenlerden alınan ücret de
-- taban ücretten farklı olduğu için her seferinde elle yazılıyordu.

alter type public.serbest_ogun_tipi add value if not exists 'ogretmen';

alter table public.serbest_ogunler
  add column if not exists odeme_yontemi text
    check (odeme_yontemi in ('nakit', 'kredi_karti'));

comment on column public.serbest_ogunler.odeme_yontemi is
  'Ücretli ve öğretmen öğünlerinde ödeme yöntemi; misafirde boş kalır.';

-- Öğretmen ücreti okul bazlı ve tarihli: tarife değişince geçmiş bozulmasın
alter table public.ucret_gecmisi
  add column if not exists ogretmen_ucreti numeric(10,2) not null default 0;

alter table public.app_settings
  add column if not exists ogretmen_ucreti numeric(10,2) not null default 0;

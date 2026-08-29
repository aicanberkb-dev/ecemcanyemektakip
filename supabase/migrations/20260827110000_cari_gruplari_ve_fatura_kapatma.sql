-- 20260827110000_cari_gruplari_ve_fatura_kapatma.sql
--
-- Cari grupları ve elle fatura kapatma.
--
-- Alacaklar tek düz liste hâlindeydi; kurum faturaları, taşımalı eğitim ve
-- dış hizmetler aynı yığında duruyordu. Artık dört sabit grup var ve her ay
-- şablon bu sırayla açılıyor. Grup içi sıra `sira` sütununda.
--
-- `faturalar.kapatildi`: tahsilat kuruşu kuruşuna tutmayabiliyor (kesinti,
-- yuvarlama, birleşik ödeme). Tahsilat kayıtlarını zorlamak yerine faturayı
-- elle kapatma imkânı var; gerçek tahsilat toplamı ekranda görünmeye devam
-- eder, yani fark gizlenmez.

alter table public.cariler
  add column if not exists grup text not null default 'diger';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cariler_grup_kontrol') then
    alter table public.cariler add constraint cariler_grup_kontrol
      check (grup in ('adliye', 'tasimali', 'ozel_egitim', 'dis_hizmet', 'diger'));
  end if;
end $$;

alter table public.faturalar
  add column if not exists kapatildi date;

update public.cariler set ad = 'ELEKTROMOSİS SÜLEYMAN' where ad = 'SÜLEYMAN';
update public.cariler set ad = 'VİNÇ FURKAN KURNE'     where ad = 'VİNÇ';
update public.cariler set ad = 'YEMEK'                 where ad = 'YEMEK (TEVKİFATSIZ)';
update public.cariler set ad = 'ARAÇ'                  where ad = 'TAŞIMALI ARAÇ (TEVKİFATLI)';

insert into public.cariler (ad, grup, sira, aktif)
select v.ad, v.grup, v.sira, true
from (values
  ('POYRAZ AYETULLAH',     'ozel_egitim', 1),
  ('BEYKOZ ÖZEL EĞİTİM',   'ozel_egitim', 2),
  ('SIDIKA DOĞRUÖZ',       'ozel_egitim', 3)
) as v(ad, grup, sira)
where not exists (select 1 from public.cariler c where c.ad = v.ad);

update public.cariler c set grup = v.grup, sira = v.sira
from (values
  ('BEYKOZ ADLİYE',          'adliye',      1),
  ('BEYKOZ MEM',             'adliye',      2),
  ('BEYKOZ TARIM',           'adliye',      3),
  ('BEYKOZ MAL MÜDÜRLÜĞÜ',   'adliye',      4),
  ('BEYKOZ TAPU',            'adliye',      5),
  ('YEMEK',                  'tasimali',    1),
  ('ARAÇ',                   'tasimali',    2),
  ('POYRAZ AYETULLAH',       'ozel_egitim', 1),
  ('BEYKOZ ÖZEL EĞİTİM',     'ozel_egitim', 2),
  ('SIDIKA DOĞRUÖZ',         'ozel_egitim', 3),
  ('ELEKTROMOSİS SÜLEYMAN',  'dis_hizmet',  1),
  ('VİNÇ FURKAN KURNE',      'dis_hizmet',  2)
) as v(ad, grup, sira)
where c.ad = v.ad;

update public.cariler c set hizmet_noktasi_id = h.id
from public.hizmet_noktalari h
where c.hizmet_noktasi_id is null and upper(c.ad) = upper(h.ad);

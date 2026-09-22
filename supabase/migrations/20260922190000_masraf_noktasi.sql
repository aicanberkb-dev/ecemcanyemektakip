-- 20260922190000_masraf_noktasi.sql
--
-- Ekrem Günlük Masraf: masraf noktası alanı ve tedarikçi ödemelerinin aynı
-- defterde görünmesi.
--
-- Gider satırları şimdiye kadar tek serbest metinle (açıklama) tutuluyordu;
-- "MEGA", "SUCUKÇU" gibi yerler orada yazıyordu. Süzme ve geçmişten seçme
-- yapılabilsin diye yer ayrı alana (masraf_noktasi) taşınıyor, açıklama
-- ek not için boş kalıyor.
--
-- Tedarikçiye yapılan ödemeler (Tedarikçi Girdi-Çıktı defterindeki "ödenen"
-- satırları) da masraf; iki yere elle yazılmasın diye kopyalanmıyor, tek
-- görünümde birleştiriliyor. Kaynak sütunu hangi defterden geldiğini söyler:
-- tedarikçi satırları kendi ekranından düzenlenir.

alter table public.gunluk_gider
  add column if not exists masraf_noktasi text;

-- Eldeki açıklamalar masraf noktasıdır: taşınır, açıklama boşaltılır
update public.gunluk_gider
   set masraf_noktasi = upper(btrim(aciklama)),
       aciklama = null
 where masraf_noktasi is null
   and coalesce(btrim(aciklama), '') <> '';

create index if not exists gunluk_gider_nokta_idx on public.gunluk_gider (masraf_noktasi);

create or replace view public.masraf_defteri
with (security_invoker = true) as
  select g.id,
         'gider'::text as kaynak,
         g.tarih,
         g.tutar,
         g.masraf_noktasi,
         g.aciklama,
         g.created_at
    from public.gunluk_gider g
  union all
  select d.id,
         'tedarikci'::text,
         d.tarih,
         d.tutar,
         coalesce(nullif(btrim(d.firma), ''), 'TEDARİKÇİ'),
         d.aciklama,
         d.created_at
    from public.gunluk_defter d
   where d.yon = 'eksi';

revoke all on public.masraf_defteri from public, anon;
grant select on public.masraf_defteri to authenticated;

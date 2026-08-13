-- 20260807110100_bakiye_ogrenci_tipi.sql
--
-- student_balances view'ine öğrenci tipi eklenir. Rozetin gösterildiği
-- ekranlar (öğrenci listesi, detay, toplu giriş, ekstre aktarımı) tipi
-- buradan okuyor.

drop view if exists public.student_balances;

create view public.student_balances
with (security_invoker = true)
as
  select
    s.id as student_id, s.okul_id, s.ogrenci_no, s.ad_soyad, s.sinif, s.kimlik_no,
    s.veli_adi, s.veli_telefon, s.veli2_adi, s.veli2_telefon, s.kardes_grup_id,
    s.abone_tipi, s.ogrenci_tipi, s.aktif, s.iskonto_orani, s.iskonto_tutar, s.devir,
    coalesce(h.alinan, 0::numeric)   as alinan_para,
    coalesce(h.harcanan, 0::numeric) as harcanan,
    s.devir + coalesce(h.alinan, 0::numeric) - coalesce(h.harcanan, 0::numeric) as kalan,
    coalesce(h.ogun_sayisi, 0::bigint) as ogun_sayisi,
    public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar) as gunluk_ucret
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  left join lateral (
    select
      sum(t.tutar) filter (where t.tip = 'tahsilat'::public.islem_tipi) as alinan,
      sum(t.tutar) filter (where t.tip = 'harcama'::public.islem_tipi)  as harcanan,
      count(*)     filter (where t.ogun_abone_tipi is not null)         as ogun_sayisi
    from public.transactions t
    where t.student_id = s.id
  ) h on true;

revoke all on public.student_balances from public, anon;
grant select on public.student_balances to authenticated;

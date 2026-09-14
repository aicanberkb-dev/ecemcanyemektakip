-- Öğrencinin günlük ücreti bugünkü tarifeden (ucret_gecmisi) okunur.
--
-- Önce app_settings.taban_gunluk_ucret'ten okunuyordu. O alan yalnız tarife
-- kaydedildiği gün "o gün geçerli" fiyata eşitleniyordu: 7 Eylül'de 14 Eylül'den
-- geçerli 280 TL girilince oraya 250 yazıldı ve 14 Eylül gelince değişmedi.
-- Öğrenci sayfası, yemekhanedeki "düşülecek" tutar, borçlu raporu ve toplu
-- giriş 250 gösterdi. Tarifesi hiç olmayan okulda eski değer kullanılır.

create or replace view public.student_balances as
 SELECT s.id AS student_id,
    s.okul_id,
    s.ogrenci_no,
    s.ad_soyad,
    s.sinif,
    s.kimlik_no,
    s.veli_adi,
    s.veli_telefon,
    s.veli2_adi,
    s.veli2_telefon,
    s.kardes_grup_id,
    s.abone_tipi,
    s.ogrenci_tipi,
    s.aktif,
    s.iskonto_orani,
    s.iskonto_tutar,
    s.devir,
    COALESCE(h.alinan, 0::numeric) AS alinan_para,
    COALESCE(h.harcanan, 0::numeric) AS harcanan,
    s.devir + COALESCE(h.alinan, 0::numeric) - COALESCE(h.harcanan, 0::numeric) AS kalan,
    COALESCE(h.ogun_sayisi, 0::bigint) AS ogun_sayisi,
    efektif_gunluk_ucret(COALESCE(u.taban_gunluk_ucret, a.taban_gunluk_ucret), s.iskonto_orani, s.iskonto_tutar) AS gunluk_ucret,
    s.veli_tc,
    s.veli2_tc
   FROM students s
     JOIN app_settings a ON a.okul_id = s.okul_id
     LEFT JOIN LATERAL ucretler(s.okul_id, CURRENT_DATE) u(taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti) ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(t.tutar) FILTER (WHERE t.tip = 'tahsilat'::islem_tipi), 0::numeric) - COALESCE(sum(t.tutar) FILTER (WHERE t.tip = 'iade'::islem_tipi), 0::numeric) AS alinan,
            sum(t.tutar) FILTER (WHERE t.tip = 'harcama'::islem_tipi) AS harcanan,
            count(*) FILTER (WHERE t.ogun_abone_tipi IS NOT NULL) AS ogun_sayisi
           FROM transactions t
          WHERE t.student_id = s.id) h ON true;

create or replace function public.ogrenci_gunluk_ucret(p_student_id uuid)
returns numeric
language sql
stable
set search_path to 'public'
as $function$
  select public.efektif_gunluk_ucret(
           coalesce((select u.taban_gunluk_ucret from public.ucretler(s.okul_id, current_date) u),
                    a.taban_gunluk_ucret),
           s.iskonto_orani, s.iskonto_tutar)
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  where s.id = p_student_id;
$function$;

-- app_settings kopyasını bugünkü tarifeye eşitle (Ayarlar'daki örnek hesap oradan okuyor)
update public.app_settings a
   set taban_gunluk_ucret = u.taban_gunluk_ucret
  from public.okullar o
  cross join lateral public.ucretler(o.id, current_date) u
 where a.okul_id = o.id
   and u.taban_gunluk_ucret is not null
   and a.taban_gunluk_ucret is distinct from u.taban_gunluk_ucret;

-- Öğrenci ana verisine iki alan:
--   deneme   — deneme süresindeki öğrenci; raporlarda rozetle görünür.
--              Varsayılan hayır: kullanıcı kendisi işaretler.
--   ozel_not — serbest metin not.

alter table public.students
  add column if not exists deneme boolean not null default false,
  add column if not exists ozel_not text;

-- Görünüm: mevcut sütunlar aynı sırada, yeni iki alan sonda
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
    s.veli2_tc,
    s.deneme,
    s.ozel_not
   FROM students s
     JOIN app_settings a ON a.okul_id = s.okul_id
     LEFT JOIN LATERAL ucretler(s.okul_id, CURRENT_DATE) u(taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti) ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(t.tutar) FILTER (WHERE t.tip = 'tahsilat'::islem_tipi), 0::numeric) - COALESCE(sum(t.tutar) FILTER (WHERE t.tip = 'iade'::islem_tipi), 0::numeric) AS alinan,
            sum(t.tutar) FILTER (WHERE t.tip = 'harcama'::islem_tipi) AS harcanan,
            count(*) FILTER (WHERE t.ogun_abone_tipi IS NOT NULL) AS ogun_sayisi
           FROM transactions t
          WHERE t.student_id = s.id) h ON true;

-- Yeni kayıtta iki alan da girilebilsin. İmza değiştiği için eski fonksiyon
-- kaldırılır (aynı adla iki sürüm kalırsa çağrı belirsizleşir).
drop function if exists public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  abone_tipi, boolean, text, text, ogrenci_tipi, text, text);

create function public.ogrenci_ekle(
  p_okul_id uuid, p_ad_soyad text, p_sinif text DEFAULT NULL::text,
  p_kimlik_no text DEFAULT NULL::text, p_veli_adi text DEFAULT NULL::text,
  p_veli_telefon text DEFAULT NULL::text, p_iskonto_orani numeric DEFAULT 0,
  p_iskonto_tutar numeric DEFAULT 0, p_devir numeric DEFAULT 0,
  p_abone_tipi abone_tipi DEFAULT 'gunluk'::abone_tipi, p_aktif boolean DEFAULT true,
  p_veli2_adi text DEFAULT NULL::text, p_veli2_telefon text DEFAULT NULL::text,
  p_ogrenci_tipi ogrenci_tipi DEFAULT 'standart'::ogrenci_tipi,
  p_veli_tc text DEFAULT NULL::text, p_veli2_tc text DEFAULT NULL::text,
  p_deneme boolean DEFAULT false, p_ozel_not text DEFAULT NULL::text)
 RETURNS students
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_kayit public.students; v_kisit text; v_deneme int := 0;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;
  loop
    begin
      insert into public.students
        (okul_id, ogrenci_no, ad_soyad, sinif, kimlik_no, veli_adi, veli_telefon,
         iskonto_orani, iskonto_tutar, devir, abone_tipi, aktif,
         veli2_adi, veli2_telefon, ogrenci_tipi, veli_tc, veli2_tc, deneme, ozel_not)
      values
        (p_okul_id, public.sonraki_ogrenci_no(p_okul_id), p_ad_soyad, p_sinif,
         nullif(btrim(coalesce(p_kimlik_no, '')), ''), p_veli_adi, p_veli_telefon,
         p_iskonto_orani, p_iskonto_tutar, p_devir, p_abone_tipi, p_aktif,
         nullif(btrim(coalesce(p_veli2_adi, '')), ''),
         nullif(btrim(coalesce(p_veli2_telefon, '')), ''),
         p_ogrenci_tipi,
         nullif(btrim(coalesce(p_veli_tc, '')), ''),
         nullif(btrim(coalesce(p_veli2_tc, '')), ''),
         coalesce(p_deneme, false),
         nullif(btrim(coalesce(p_ozel_not, '')), ''))
      returning * into v_kayit;
      return v_kayit;
    exception when unique_violation then
      get stacked diagnostics v_kisit = constraint_name;
      if v_kisit <> 'students_okul_ogrenci_no_uniq' then raise; end if;
      v_deneme := v_deneme + 1;
      if v_deneme > 10 then
        raise exception 'Ogrenci numarasi uretilemedi, tekrar deneyin.';
      end if;
    end;
  end loop;
end $function$;

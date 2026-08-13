-- 20260812100100_ogunler_tarihe_gore_fiyatlansin.sql
--
-- Öğün kayıtları artık ait oldukları GÜNÜN tarifesinden fiyatlanır.
-- Önceden hep app_settings'teki güncel fiyat kullanılıyordu; geçmiş bir güne
-- toplu giriş yapıldığında bugünün fiyatı uygulanıyordu.

create or replace function public.yemek_kaydet(p_student_id uuid, p_tarih date default current_date)
returns public.transactions
language plpgsql
set search_path = public
as $$
declare
  v_ogrenci public.students%rowtype;
  v_taban   numeric;
  v_tutar   numeric;
  v_kayit   public.transactions;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  select * into v_ogrenci from public.students where id = p_student_id;
  if not found then
    raise exception 'Ogrenci bulunamadi.' using errcode = 'P0002';
  end if;

  if not v_ogrenci.aktif then
    raise exception '% pasif durumda, yemek kaydi girilemez.', v_ogrenci.ad_soyad
      using errcode = 'P0001';
  end if;

  -- Aynı güne ikinci öğün girilemez: kural veritabanında, ekranda değil.
  if exists (
    select 1 from public.transactions
    where student_id = p_student_id and tarih = p_tarih and ogun_abone_tipi is not null
  ) then
    raise exception '% icin % tarihinde zaten yemek kaydi var.',
      v_ogrenci.ad_soyad, to_char(p_tarih, 'DD.MM.YYYY') using errcode = '23505';
  end if;

  select u.taban_gunluk_ucret into v_taban
  from public.ucretler(v_ogrenci.okul_id, p_tarih) u;

  if v_ogrenci.abone_tipi = 'aylik' then
    v_tutar := 0;
  else
    v_tutar := public.efektif_gunluk_ucret(v_taban, v_ogrenci.iskonto_orani, v_ogrenci.iskonto_tutar);
  end if;

  insert into public.transactions
    (student_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id, ogun_abone_tipi)
  values
    (p_student_id, p_tarih, 'harcama', v_tutar,
     case when v_ogrenci.abone_tipi = 'aylik' then 'Aylikci devam kaydi' else 'Yemek' end,
     auth.uid(), v_ogrenci.abone_tipi)
  returning * into v_kayit;

  return v_kayit;
end $$;

create or replace function public.toplu_yemek_kaydet(p_ogrenciler uuid[], p_tarih date default current_date)
returns table(eklenen integer, atlanan integer)
language plpgsql
set search_path = public
as $$
declare
  v_eklenen int;
  v_istenen int := coalesce(array_length(p_ogrenciler, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  insert into public.transactions
    (student_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id, ogun_abone_tipi)
  select
    s.id, p_tarih, 'harcama',
    case when s.abone_tipi = 'aylik' then 0
         else public.efektif_gunluk_ucret(u.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
    end,
    case when s.abone_tipi = 'aylik' then 'Aylikci devam kaydi (toplu)' else 'Yemek (toplu)' end,
    auth.uid(), s.abone_tipi
  from public.students s
  cross join lateral public.ucretler(s.okul_id, p_tarih) u
  where s.id = any(p_ogrenciler) and s.aktif
  on conflict (student_id, tarih) where ogun_abone_tipi is not null do nothing;

  get diagnostics v_eklenen = row_count;

  eklenen := v_eklenen;
  atlanan := greatest(0, v_istenen - v_eklenen);
  return next;
end $$;

create or replace function public.serbest_ogun_kaydet(
  p_okul_id uuid, p_tip public.serbest_ogun_tipi, p_adet integer default 1,
  p_tarih date default current_date, p_aciklama text default null
)
returns table(eklenen integer, gun_toplami integer, birim_tutar numeric)
language plpgsql
set search_path = public
as $$
declare
  v_ucret record;
  v_tutar numeric;
  v_adet  int := coalesce(p_adet, 1);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  if v_adet < 1 or v_adet > 500 then
    raise exception 'Adet 1 ile 500 arasinda olmali.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.app_settings where okul_id = p_okul_id) then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  select * into v_ucret from public.ucretler(p_okul_id, p_tarih);

  -- Ücretli öğün fiyatı girilmemişse taban günlük ücret uygulanır.
  if p_tip = 'ucretli' then
    v_tutar := case
                 when coalesce(v_ucret.ucretli_ogun_ucreti, 0) > 0 then v_ucret.ucretli_ogun_ucreti
                 else coalesce(v_ucret.taban_gunluk_ucret, 0)
               end;
  else
    v_tutar := coalesce(v_ucret.misafir_ogun_ucreti, 0);
  end if;

  insert into public.serbest_ogunler (okul_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id)
  select p_okul_id, p_tarih, p_tip, v_tutar, p_aciklama, auth.uid()
  from generate_series(1, v_adet);

  eklenen     := v_adet;
  birim_tutar := v_tutar;
  select count(*) into gun_toplami
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih;

  return next;
end $$;

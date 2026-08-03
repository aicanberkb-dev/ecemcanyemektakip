-- 20260803100000_otomatik_no_geri_alma_toplu.sql
--
-- 1) Otomatik öğrenci numarası (okul bazlı, boşluk doldurmalı)
-- 2) Yemek / serbest öğün geri alma
-- 3) Toplu yemek kaydı
-- 4) Ücretli-misafir öğünlerde adet ile toplu giriş ve geri alma

-- ---------------------------------------------------------------------------
-- sonraki_ogrenci_no — okul içindeki en küçük boş numara.
-- 001..067 varsa -> 068. 013 silinmişse -> 013 (boşluk doldurulur).
-- Böylece son numara öğrenci sayısına eşit kalır.
-- ---------------------------------------------------------------------------
create or replace function public.sonraki_ogrenci_no(p_okul_id uuid)
returns text
language sql stable security invoker
set search_path = public
as $$
  with kullanilan as (
    select ogrenci_no::int as no
    from public.students
    where okul_id = p_okul_id
      and ogrenci_no ~ '^[0-9]+$'
  ),
  ilk_bos as (
    select min(g.n) as n
    from generate_series(1, (select coalesce(max(no), 0) + 1 from kullanilan)) g(n)
    where not exists (select 1 from kullanilan k where k.no = g.n)
  )
  select lpad((select n from ilk_bos)::text, 3, '0');
$$;

-- ---------------------------------------------------------------------------
-- ogrenci_ekle — numarayı sunucu atar.
-- İki kullanıcı aynı anda kayıt açarsa numara çakışır; bu durumda yeniden
-- denenir. Kimlik no çakışmasında tekrar denemek anlamsız olduğu için
-- yalnızca öğrenci no kısıtında döngüye girilir.
-- ---------------------------------------------------------------------------
create or replace function public.ogrenci_ekle(
  p_okul_id       uuid,
  p_ad_soyad      text,
  p_sinif         text    default null,
  p_kimlik_no     text    default null,
  p_veli_adi      text    default null,
  p_veli_telefon  text    default null,
  p_iskonto_orani numeric default 0,
  p_iskonto_tutar numeric default 0,
  p_devir         numeric default 0,
  p_abone_tipi    public.abone_tipi default 'gunluk',
  p_aktif         boolean default true
) returns public.students
language plpgsql security invoker
set search_path = public
as $$
declare
  v_kayit  public.students;
  v_kisit  text;
  v_deneme int := 0;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  loop
    begin
      insert into public.students
        (okul_id, ogrenci_no, ad_soyad, sinif, kimlik_no, veli_adi, veli_telefon,
         iskonto_orani, iskonto_tutar, devir, abone_tipi, aktif)
      values
        (p_okul_id, public.sonraki_ogrenci_no(p_okul_id), p_ad_soyad, p_sinif,
         nullif(btrim(coalesce(p_kimlik_no, '')), ''), p_veli_adi, p_veli_telefon,
         p_iskonto_orani, p_iskonto_tutar, p_devir, p_abone_tipi, p_aktif)
      returning * into v_kayit;

      return v_kayit;

    exception when unique_violation then
      get stacked diagnostics v_kisit = constraint_name;
      if v_kisit <> 'students_okul_ogrenci_no_uniq' then
        raise;
      end if;
      v_deneme := v_deneme + 1;
      if v_deneme >= 5 then
        raise exception 'Ogrenci numarasi atanamadi, tekrar deneyin.' using errcode = '40001';
      end if;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- yemek_geri_al — öğrencinin o günkü yemek kaydını siler.
-- Silme audit_log'a trigger ile düşer; iz kaybolmaz.
-- ---------------------------------------------------------------------------
create or replace function public.yemek_geri_al(
  p_student_id uuid,
  p_tarih      date default current_date
) returns int
language plpgsql security invoker
set search_path = public
as $$
declare
  v_silinen int;
  v_ad      text;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  select ad_soyad into v_ad from public.students where id = p_student_id;
  if not found then
    raise exception 'Ogrenci bulunamadi.' using errcode = 'P0002';
  end if;

  delete from public.transactions
  where student_id = p_student_id
    and tarih = p_tarih
    and ogun_abone_tipi is not null;

  get diagnostics v_silinen = row_count;

  if v_silinen = 0 then
    raise exception '% icin % tarihinde yemek kaydi yok.',
      v_ad, to_char(p_tarih, 'DD.MM.YYYY') using errcode = 'P0002';
  end if;

  return v_silinen;
end $$;

-- ---------------------------------------------------------------------------
-- serbest_ogun_kaydet — p_adet kadar kayıt atar (varsayılan 1).
-- "Yemekten sonra 3 kişi ücretli yedi" gibi toplu girişler için.
-- ---------------------------------------------------------------------------
drop function if exists public.serbest_ogun_kaydet(uuid, public.serbest_ogun_tipi, date, text);
create function public.serbest_ogun_kaydet(
  p_okul_id  uuid,
  p_tip      public.serbest_ogun_tipi,
  p_adet     int  default 1,
  p_tarih    date default current_date,
  p_aciklama text default null
) returns table (eklenen int, gun_toplami int, birim_tutar numeric)
language plpgsql security invoker
set search_path = public
as $$
declare
  v_ayar  public.app_settings%rowtype;
  v_tutar numeric;
  v_adet  int := coalesce(p_adet, 1);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  if v_adet < 1 or v_adet > 500 then
    raise exception 'Adet 1 ile 500 arasinda olmali.' using errcode = 'P0001';
  end if;

  select * into v_ayar from public.app_settings where okul_id = p_okul_id;
  if not found then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  if p_tip = 'ucretli' then
    v_tutar := case
                 when coalesce(v_ayar.ucretli_ogun_ucreti, 0) > 0 then v_ayar.ucretli_ogun_ucreti
                 else coalesce(v_ayar.taban_gunluk_ucret, 0)
               end;
  else
    v_tutar := coalesce(v_ayar.misafir_ogun_ucreti, 0);
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

-- ---------------------------------------------------------------------------
-- serbest_ogun_geri_al — o günün son p_adet kaydını siler.
-- 3 misafir varken 1 geri alınırsa 2 kalır. İstenenden az kayıt varsa
-- var olan kadarını siler, hata vermez.
-- ---------------------------------------------------------------------------
drop function if exists public.serbest_ogun_geri_al(uuid, public.serbest_ogun_tipi, date);
create function public.serbest_ogun_geri_al(
  p_okul_id uuid,
  p_tip     public.serbest_ogun_tipi,
  p_adet    int  default 1,
  p_tarih   date default current_date
) returns table (silinen int, gun_toplami int)
language plpgsql security invoker
set search_path = public
as $$
declare
  v_adet int := coalesce(p_adet, 1);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  if v_adet < 1 or v_adet > 500 then
    raise exception 'Adet 1 ile 500 arasinda olmali.' using errcode = 'P0001';
  end if;

  delete from public.serbest_ogunler
  where id in (
    select id from public.serbest_ogunler
    where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih
    order by created_at desc
    limit v_adet
  );

  get diagnostics silinen = row_count;

  if silinen = 0 then
    raise exception '% tarihinde geri alinacak % ogun kaydi yok.',
      to_char(p_tarih, 'DD.MM.YYYY'),
      case when p_tip = 'ucretli' then 'ucretli' else 'misafir' end
      using errcode = 'P0002';
  end if;

  select count(*) into gun_toplami
  from public.serbest_ogunler
  where okul_id = p_okul_id and tip = p_tip and tarih = p_tarih;

  return next;
end $$;

-- ---------------------------------------------------------------------------
-- toplu_yemek_kaydet — kesinti sonrası elle tutulan listeyi sisteme aktarır.
-- O gün zaten kaydı olan öğrenci sessizce atlanır (hata vermez), böylece
-- yanlışlıkla iki kez çalıştırılsa da çift kayıt oluşmaz.
-- ---------------------------------------------------------------------------
create or replace function public.toplu_yemek_kaydet(
  p_ogrenciler uuid[],
  p_tarih      date default current_date
) returns table (eklenen int, atlanan int)
language plpgsql security invoker
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
         else public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
    end,
    case when s.abone_tipi = 'aylik' then 'Aylikci devam kaydi (toplu)' else 'Yemek (toplu)' end,
    auth.uid(), s.abone_tipi
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  where s.id = any(p_ogrenciler) and s.aktif
  on conflict (student_id, tarih) where ogun_abone_tipi is not null do nothing;

  get diagnostics v_eklenen = row_count;

  eklenen := v_eklenen;
  atlanan := greatest(0, v_istenen - v_eklenen);
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function
  public.sonraki_ogrenci_no(uuid),
  public.ogrenci_ekle(uuid, text, text, text, text, text, numeric, numeric, numeric, public.abone_tipi, boolean),
  public.yemek_geri_al(uuid, date),
  public.serbest_ogun_kaydet(uuid, public.serbest_ogun_tipi, int, date, text),
  public.serbest_ogun_geri_al(uuid, public.serbest_ogun_tipi, int, date),
  public.toplu_yemek_kaydet(uuid[], date)
  from public, anon;

grant execute on function
  public.sonraki_ogrenci_no(uuid),
  public.ogrenci_ekle(uuid, text, text, text, text, text, numeric, numeric, numeric, public.abone_tipi, boolean),
  public.yemek_geri_al(uuid, date),
  public.serbest_ogun_kaydet(uuid, public.serbest_ogun_tipi, int, date, text),
  public.serbest_ogun_geri_al(uuid, public.serbest_ogun_tipi, int, date),
  public.toplu_yemek_kaydet(uuid[], date)
  to authenticated;

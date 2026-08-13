-- 20260806100000_ikinci_veli.sql
--
-- Öğrenciye ikinci veli alanı.
--
-- Gerekçe: banka ekstresinde parayı yatıran kişi her zaman aynı olmuyor —
-- bir ay anne, bir ay baba yatırıyor. Ekstredeki gönderen adını öğrenciye
-- bağlayabilmek için tek bir veli alanı yetmiyor. Eylülde ekstre satırlarını
-- otomatik eşleştirebilmenin ön koşulu bu.

alter table public.students add column if not exists veli2_adi     text;
alter table public.students add column if not exists veli2_telefon text;

-- Ekstre eşleştirmesi ada göre arayacak; iki veli alanı da aranabilir olmalı.
create index if not exists students_veli_adi_idx
  on public.students (lower(veli_adi));
create index if not exists students_veli2_adi_idx
  on public.students (lower(veli2_adi));

-- ogrenci_ekle: ikinci veli parametreleri eklendi.
-- Eski imza (11 parametre) düşürülüyor; çağıranlar yeni imzayı kullanacak.
drop function if exists public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric, public.abone_tipi, boolean);

create or replace function public.ogrenci_ekle(
  p_okul_id        uuid,
  p_ad_soyad       text,
  p_sinif          text    default null,
  p_kimlik_no      text    default null,
  p_veli_adi       text    default null,
  p_veli_telefon   text    default null,
  p_iskonto_orani  numeric default 0,
  p_iskonto_tutar  numeric default 0,
  p_devir          numeric default 0,
  p_abone_tipi     public.abone_tipi default 'gunluk',
  p_aktif          boolean default true,
  p_veli2_adi      text    default null,
  p_veli2_telefon  text    default null
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
         iskonto_orani, iskonto_tutar, devir, abone_tipi, aktif,
         veli2_adi, veli2_telefon)
      values
        (p_okul_id, public.sonraki_ogrenci_no(p_okul_id), p_ad_soyad, p_sinif,
         nullif(btrim(coalesce(p_kimlik_no, '')), ''), p_veli_adi, p_veli_telefon,
         p_iskonto_orani, p_iskonto_tutar, p_devir, p_abone_tipi, p_aktif,
         nullif(btrim(coalesce(p_veli2_adi, '')), ''),
         nullif(btrim(coalesce(p_veli2_telefon, '')), ''))
      returning * into v_kayit;

      return v_kayit;

    exception when unique_violation then
      get stacked diagnostics v_kisit = constraint_name;
      if v_kisit <> 'students_okul_ogrenci_no_uniq' then
        raise;
      end if;
      -- Aynı anda iki kayıt aynı numarayı kaptıysa yeniden dene.
      v_deneme := v_deneme + 1;
      if v_deneme > 10 then
        raise exception 'Ogrenci numarasi uretilemedi, tekrar deneyin.';
      end if;
    end;
  end loop;
end $$;

revoke execute on function public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  public.abone_tipi, boolean, text, text) from public, anon;
grant execute on function public.ogrenci_ekle(
  uuid, text, text, text, text, text, numeric, numeric, numeric,
  public.abone_tipi, boolean, text, text) to authenticated;

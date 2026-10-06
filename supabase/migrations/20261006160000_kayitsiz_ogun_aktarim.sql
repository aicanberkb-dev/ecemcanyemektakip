-- 20261006160000_kayitsiz_ogun_aktarim.sql
--
-- Kayitsiz gelislerin ogrenci kaydina aktarilmasi.
--
-- Cocuk once kayitsiz geliyor, sonra kaydi aciliyor. O gunlerin yemek
-- kayitlari ogrencinin hesabina gecmeli; yoksa gecmisi eksik duruyor ve
-- gunlukcuyse ucreti hic islenmemis oluyor.
--
-- Aktarilan satir silinmiyor: hangi kayitsiz gelisin kime aktarildigi
-- raporda gorunsun, ikinci kez aktarilmasin.

alter table public.kayitsiz_ogunler
  add column if not exists aktarilan_student_id uuid references public.students(id) on delete set null,
  add column if not exists aktarildi_at timestamptz;

comment on column public.kayitsiz_ogunler.aktarilan_student_id is
  'Bu gelis hangi ogrencinin kaydina aktarildi; bos ise aktarilmadi.';

create index if not exists kayitsiz_ogunler_aktarim_idx
  on public.kayitsiz_ogunler (aktarilan_student_id);

-- Ogun kayitlarini olusturur ve satirlari aktarilmis isaretler.
-- Ogrencinin o gun zaten yemek kaydi varsa o gun atlanir ama satir yine
-- aktarilmis sayilir: gun zaten islenmis durumda.
create or replace function public.kayitsiz_ogun_aktar(p_student_id uuid, p_ids uuid[])
returns table(eklenen integer, atlanan integer, aktarilan integer)
language plpgsql
set search_path = public
as $$
declare
  v_ogrenci public.students%rowtype;
  v_eklenen int := 0;
  v_aktarilan int := 0;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  select * into v_ogrenci from public.students where id = p_student_id;
  if not found then
    raise exception 'Ogrenci bulunamadi.' using errcode = 'P0002';
  end if;
  if not v_ogrenci.aktif then
    raise exception '% pasif durumda, kayit aktarilamaz.', v_ogrenci.ad_soyad
      using errcode = 'P0001';
  end if;

  with hedef as (
    select k.id, k.tarih
    from public.kayitsiz_ogunler k
    where k.id = any(p_ids)
      and k.okul_id = v_ogrenci.okul_id
      and k.aktarilan_student_id is null
  ),
  ogun as (
    insert into public.transactions
      (student_id, tarih, tip, tutar, aciklama, islemi_yapan_user_id, ogun_abone_tipi)
    select
      v_ogrenci.id, h.tarih, 'harcama',
      case when v_ogrenci.abone_tipi = 'aylik' then 0
           else public.efektif_gunluk_ucret(u.taban_gunluk_ucret,
                                            v_ogrenci.iskonto_orani, v_ogrenci.iskonto_tutar)
      end,
      'Kayitsiz gelisin aktarimi',
      auth.uid(), v_ogrenci.abone_tipi
    from hedef h
    cross join lateral public.ucretler(v_ogrenci.okul_id, h.tarih) u
    on conflict (student_id, tarih) where ogun_abone_tipi is not null do nothing
    returning 1
  ),
  isaret as (
    update public.kayitsiz_ogunler k
    set aktarilan_student_id = v_ogrenci.id,
        aktarildi_at = now()
    from hedef h
    where k.id = h.id
    returning 1
  )
  select (select count(*) from ogun), (select count(*) from isaret)
  into v_eklenen, v_aktarilan;

  eklenen   := v_eklenen;
  aktarilan := v_aktarilan;
  atlanan   := greatest(0, v_aktarilan - v_eklenen);
  return next;
end $$;

comment on function public.kayitsiz_ogun_aktar(uuid, uuid[]) is
  'Kayitsiz gelis satirlarini ogrencinin yemek kaydina aktarir.';

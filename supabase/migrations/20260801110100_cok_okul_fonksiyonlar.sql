-- 20260801110100_cok_okul_fonksiyonlar.sql
-- Fonksiyon ve view'ler okul bazlı hale getirilir.

drop view if exists public.student_balances;
create view public.student_balances
with (security_invoker = true) as
select
  s.id            as student_id,
  s.okul_id,
  s.ogrenci_no,
  s.ad_soyad,
  s.sinif,
  s.kimlik_no,
  s.veli_adi,
  s.veli_telefon,
  s.abone_tipi,
  s.aktif,
  s.iskonto_orani,
  s.iskonto_tutar,
  s.devir,
  coalesce(h.alinan, 0)                                       as alinan_para,
  coalesce(h.harcanan, 0)                                     as harcanan,
  s.devir + coalesce(h.alinan, 0) - coalesce(h.harcanan, 0)   as kalan,
  coalesce(h.ogun_sayisi, 0)                                  as ogun_sayisi,
  public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
                                                              as gunluk_ucret
from public.students s
join public.app_settings a on a.okul_id = s.okul_id
left join lateral (
  select
    sum(t.tutar) filter (where t.tip = 'tahsilat')            as alinan,
    sum(t.tutar) filter (where t.tip = 'harcama')             as harcanan,
    count(*)     filter (where t.ogun_abone_tipi is not null) as ogun_sayisi
  from public.transactions t
  where t.student_id = s.id
) h on true;

grant select on public.student_balances to authenticated;

-- Öğrencinin ücreti kendi okulunun tabanından hesaplanır
create or replace function public.ogrenci_gunluk_ucret(p_student_id uuid)
returns numeric
language sql stable security invoker
set search_path = public
as $$
  select public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  where s.id = p_student_id;
$$;

create or replace function public.yemek_kaydet(
  p_student_id uuid,
  p_tarih      date default current_date
) returns public.transactions
language plpgsql security invoker
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

  if exists (
    select 1 from public.transactions
    where student_id = p_student_id
      and tarih = p_tarih
      and ogun_abone_tipi is not null
  ) then
    raise exception '% icin % tarihinde zaten yemek kaydi var.',
      v_ogrenci.ad_soyad, to_char(p_tarih, 'DD.MM.YYYY')
      using errcode = '23505';
  end if;

  select taban_gunluk_ucret into v_taban
  from public.app_settings where okul_id = v_ogrenci.okul_id;

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

drop function if exists public.serbest_ogun_kaydet(public.serbest_ogun_tipi, date, text);
create function public.serbest_ogun_kaydet(
  p_okul_id  uuid,
  p_tip      public.serbest_ogun_tipi,
  p_tarih    date default current_date,
  p_aciklama text default null
) returns public.serbest_ogunler
language plpgsql security invoker
set search_path = public
as $$
declare
  v_ayar  public.app_settings%rowtype;
  v_tutar numeric;
  v_kayit public.serbest_ogunler;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
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
  values (p_okul_id, p_tarih, p_tip, v_tutar, p_aciklama, auth.uid())
  returning * into v_kayit;

  return v_kayit;
end $$;

drop function if exists public.pos_ara(text, date, int);
create function public.pos_ara(
  p_okul_id uuid,
  p_terim   text,
  p_tarih   date default current_date,
  p_limit   int  default 15
) returns table (
  student_id   uuid,
  ogrenci_no   text,
  ad_soyad     text,
  sinif        text,
  kimlik_no    text,
  abone_tipi   public.abone_tipi,
  kalan        numeric,
  gunluk_ucret numeric,
  bugun_yedi   boolean,
  tam_eslesme  boolean
)
language sql stable security invoker
set search_path = public
as $$
  with terim as (select btrim(coalesce(p_terim, '')) as t)
  select
    b.student_id, b.ogrenci_no, b.ad_soyad, b.sinif, b.kimlik_no,
    b.abone_tipi, b.kalan, b.gunluk_ucret,
    exists (
      select 1 from public.transactions tr
      where tr.student_id = b.student_id
        and tr.tarih = p_tarih
        and tr.ogun_abone_tipi is not null
    ) as bugun_yedi,
    (b.ogrenci_no = (select t from terim) or b.kimlik_no = (select t from terim)) as tam_eslesme
  from public.student_balances b, terim
  where b.okul_id = p_okul_id
    and terim.t <> ''
    and b.aktif
    and (
      b.ogrenci_no ilike '%' || terim.t || '%'
      or b.ad_soyad ilike '%' || terim.t || '%'
      or coalesce(b.kimlik_no, '') ilike '%' || terim.t || '%'
    )
  order by
    (b.ogrenci_no = (select t from terim) or b.kimlik_no = (select t from terim)) desc,
    b.ad_soyad
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

revoke execute on function
  public.serbest_ogun_kaydet(uuid, public.serbest_ogun_tipi, date, text),
  public.pos_ara(uuid, text, date, int)
  from public, anon;
grant execute on function
  public.serbest_ogun_kaydet(uuid, public.serbest_ogun_tipi, date, text),
  public.pos_ara(uuid, text, date, int)
  to authenticated;

-- Audit trigger okul bilgisini de yazar.
-- transactions'ta okul_id yoktur; öğrenci üzerinden bulunur.
create or replace function public.audit_yaz()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_satir    jsonb;
  v_kayit_id uuid;
  v_okul_id  uuid;
begin
  v_satir    := to_jsonb(coalesce(new, old));
  v_kayit_id := nullif(v_satir ->> 'id', '')::uuid;
  v_okul_id  := nullif(v_satir ->> 'okul_id', '')::uuid;

  if v_okul_id is null and tg_table_name = 'transactions' then
    select s.okul_id into v_okul_id
    from public.students s
    where s.id = nullif(v_satir ->> 'student_id', '')::uuid;
  end if;

  if v_okul_id is null and tg_table_name = 'okullar' then
    v_okul_id := v_kayit_id;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (user_id, islem_tipi, tablo_adi, kayit_id, okul_id, eski_deger, yeni_deger)
    values (auth.uid(), 'DELETE', tg_table_name, v_kayit_id, v_okul_id, to_jsonb(old), null);
    return old;
  else
    insert into public.audit_log (user_id, islem_tipi, tablo_adi, kayit_id, okul_id, eski_deger, yeni_deger)
    values (auth.uid(), 'UPDATE', tg_table_name, v_kayit_id, v_okul_id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end $$;

revoke execute on function public.audit_yaz() from public, anon, authenticated;

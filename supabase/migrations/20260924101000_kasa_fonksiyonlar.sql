-- 20260924101000_kasa_fonksiyonlar.sql
--
-- Kasa hareketi kaydi/geri alimi, gun sonu sayacinin nakit-kart kirilimi ve
-- okul bazli gunluk kasa raporu.
--
-- Gun sonunda ekranda gorunen "kasaya giren" yalnizca ucretli ogunleri
-- sayiyordu: ogretmen ucreti disarida kaliyor, kartla odenen ogun de nakit
-- gibi gosteriliyordu. Artik ikisi de dogru yerde toplaniyor.
--
-- Odeme yontemi bos olan eski kayitlar nakit sayilir; o donemde kart
-- secenegi yoktu, gecmis rakamlar aynen korunur.

create or replace function public.kasa_hareketi_kaydet(
  p_okul_id uuid,
  p_yon text,
  p_tutar numeric,
  p_tarih date default current_date,
  p_aciklama text default null
)
returns table(id uuid, gun_giris numeric, gun_cikis numeric)
language plpgsql set search_path to 'public' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi, islem kaydedilemez.' using errcode = '28000';
  end if;

  if p_yon not in ('giris', 'cikis') then
    raise exception 'Yon giris ya da cikis olmali.' using errcode = 'P0001';
  end if;

  if p_tutar is null or p_tutar <= 0 then
    raise exception 'Tutar sifirdan buyuk olmali.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.app_settings where okul_id = p_okul_id) then
    raise exception 'Okul bulunamadi.' using errcode = 'P0002';
  end if;

  insert into public.kasa_hareketleri
    (okul_id, tarih, yon, tutar, aciklama, islemi_yapan_user_id)
  values (p_okul_id, p_tarih, p_yon, p_tutar, nullif(btrim(p_aciklama), ''), auth.uid())
  returning kasa_hareketleri.id into v_id;

  id := v_id;
  select
    coalesce(sum(tutar) filter (where yon = 'giris'), 0),
    coalesce(sum(tutar) filter (where yon = 'cikis'), 0)
    into gun_giris, gun_cikis
  from public.kasa_hareketleri
  where okul_id = p_okul_id and tarih = p_tarih;

  return next;
end $$;

-- Her islemin ters islemi: yanlis girilen kasa hareketi silinebilir
create or replace function public.kasa_hareketi_sil(p_id uuid)
returns void
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  delete from public.kasa_hareketleri where id = p_id;
  if not found then
    raise exception 'Kasa hareketi bulunamadi.' using errcode = 'P0002';
  end if;
end $$;

-- Gun sonu sayaci: tutarlar da nakit/kart ayrilir, kasa hareketleri eklenir
drop function if exists public.gun_sonu(uuid, date);
create function public.gun_sonu(p_okul_id uuid, p_tarih date default current_date)
returns table(
  gunlukcu integer, aylikci integer, ucretli integer, misafir integer,
  toplam integer, gunlukcu_tutar numeric, ucretli_tutar numeric, misafir_tutar numeric,
  ogretmen integer, ogretmen_tutar numeric,
  ucretli_nakit integer, ucretli_kart integer,
  ogretmen_nakit integer, ogretmen_kart integer,
  ogun_nakit_tutar numeric, ogun_kart_tutar numeric,
  kasa_giris numeric, kasa_cikis numeric,
  kasa_nakit numeric
)
language sql stable set search_path to 'public' as $$
  with ogrenci as (
    select
      count(*) filter (where t.ogun_abone_tipi = 'gunluk')::int as gunlukcu,
      count(*) filter (where t.ogun_abone_tipi = 'aylik')::int  as aylikci,
      coalesce(sum(t.tutar) filter (where t.ogun_abone_tipi = 'gunluk'), 0) as gunlukcu_tutar
    from public.transactions t
    join public.students s on s.id = t.student_id
    where t.tarih = p_tarih and t.ogun_abone_tipi is not null and s.okul_id = p_okul_id
  ),
  serbest as (
    select
      count(*) filter (where tip = 'ucretli')::int as ucretli,
      count(*) filter (where tip = 'misafir')::int as misafir,
      count(*) filter (where tip = 'ogretmen')::int as ogretmen,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0) as ucretli_tutar,
      coalesce(sum(tutar) filter (where tip = 'misafir'), 0) as misafir_tutar,
      coalesce(sum(tutar) filter (where tip = 'ogretmen'), 0) as ogretmen_tutar,
      count(*) filter (where tip = 'ucretli' and odeme_yontemi = 'nakit')::int as ucretli_nakit,
      count(*) filter (where tip = 'ucretli' and odeme_yontemi = 'kredi_karti')::int as ucretli_kart,
      count(*) filter (where tip = 'ogretmen' and odeme_yontemi = 'nakit')::int as ogretmen_nakit,
      count(*) filter (where tip = 'ogretmen' and odeme_yontemi = 'kredi_karti')::int as ogretmen_kart,
      -- Ucretli + ogretmen, odeme yontemine gore tutar
      coalesce(sum(tutar) filter (
        where tip in ('ucretli', 'ogretmen') and odeme_yontemi is distinct from 'kredi_karti'
      ), 0) as ogun_nakit_tutar,
      coalesce(sum(tutar) filter (
        where tip in ('ucretli', 'ogretmen') and odeme_yontemi = 'kredi_karti'
      ), 0) as ogun_kart_tutar
    from public.serbest_ogunler
    where tarih = p_tarih and okul_id = p_okul_id
  ),
  kasa as (
    select
      coalesce(sum(tutar) filter (where yon = 'giris'), 0) as giris,
      coalesce(sum(tutar) filter (where yon = 'cikis'), 0) as cikis
    from public.kasa_hareketleri
    where tarih = p_tarih and okul_id = p_okul_id
  )
  select
    ogrenci.gunlukcu, ogrenci.aylikci, serbest.ucretli, serbest.misafir,
    ogrenci.gunlukcu + ogrenci.aylikci + serbest.ucretli + serbest.misafir + serbest.ogretmen,
    ogrenci.gunlukcu_tutar, serbest.ucretli_tutar, serbest.misafir_tutar,
    serbest.ogretmen, serbest.ogretmen_tutar,
    serbest.ucretli_nakit, serbest.ucretli_kart,
    serbest.ogretmen_nakit, serbest.ogretmen_kart,
    serbest.ogun_nakit_tutar, serbest.ogun_kart_tutar,
    kasa.giris, kasa.cikis,
    -- Kasada fiilen olmasi gereken nakit: nakit ogunler + elle giris - cikis
    serbest.ogun_nakit_tutar + kasa.giris - kasa.cikis
  from ogrenci, serbest, kasa;
$$;

-- Okul bazli gunluk kasa raporu.
--
-- Havale ve belirsiz tahsilat ayri sutunlarda: ikisi de kasaya girmez ama
-- havale zaten hesaba geldigi icin takip gerektirmez. Kredi karti ertesi
-- gun hesaba gectigi icin ayri durur. Teslim alinacak olan nakittir.
create or replace function public.kasa_raporu(p_okul_id uuid, p_bas date, p_bit date)
returns table(
  tarih date,
  ogun_nakit numeric,
  ogun_kart numeric,
  tahsilat_nakit numeric,
  tahsilat_kart numeric,
  tahsilat_havale numeric,
  tahsilat_belirsiz numeric,
  kasa_giris numeric,
  kasa_cikis numeric,
  nakit_toplam numeric,
  kart_toplam numeric,
  genel_toplam numeric,
  teslim_alindi boolean,
  teslim_tutar numeric,
  teslim_zamani timestamptz
)
language sql stable set search_path to 'public' as $$
  with ogun as (
    select
      s.tarih,
      coalesce(sum(s.tutar) filter (where s.odeme_yontemi is distinct from 'kredi_karti'), 0) as nakit,
      coalesce(sum(s.tutar) filter (where s.odeme_yontemi = 'kredi_karti'), 0) as kart
    from public.serbest_ogunler s
    where s.okul_id = p_okul_id and s.tip in ('ucretli', 'ogretmen')
      and s.tarih between p_bas and p_bit
    group by s.tarih
  ),
  tahsilat as (
    select
      t.tarih,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'nakit'), 0)       as nakit,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'kredi_karti'), 0) as kart,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'havale'), 0)      as havale,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi is null), 0)         as belirsiz
    from public.transactions t
    join public.students st on st.id = t.student_id
    where st.okul_id = p_okul_id and t.tip = 'tahsilat'
      and t.tarih between p_bas and p_bit
    group by t.tarih
  ),
  kasa as (
    select
      k.tarih,
      coalesce(sum(k.tutar) filter (where k.yon = 'giris'), 0) as giris,
      coalesce(sum(k.tutar) filter (where k.yon = 'cikis'), 0) as cikis
    from public.kasa_hareketleri k
    where k.okul_id = p_okul_id and k.tarih between p_bas and p_bit
    group by k.tarih
  ),
  teslimler as (
    select id, tarih, tutar, created_at
    from public.kasa_teslim
    where okul_id = p_okul_id and tarih between p_bas and p_bit
  ),
  gunler as (
    select tarih from ogun
    union select tarih from tahsilat
    union select tarih from kasa
    union select tarih from teslimler
  )
  select
    g.tarih,
    coalesce(o.nakit, 0),
    coalesce(o.kart, 0),
    coalesce(t.nakit, 0),
    coalesce(t.kart, 0),
    coalesce(t.havale, 0),
    coalesce(t.belirsiz, 0),
    coalesce(k.giris, 0),
    coalesce(k.cikis, 0),
    -- Kasada biriken nakit: yontemi belirsiz tahsilat da nakit sayilir
    coalesce(o.nakit, 0) + coalesce(t.nakit, 0) + coalesce(t.belirsiz, 0)
      + coalesce(k.giris, 0) - coalesce(k.cikis, 0),
    -- Ertesi gun hesaba gececek kart tutari
    coalesce(o.kart, 0) + coalesce(t.kart, 0),
    coalesce(o.nakit, 0) + coalesce(o.kart, 0)
      + coalesce(t.nakit, 0) + coalesce(t.kart, 0)
      + coalesce(t.havale, 0) + coalesce(t.belirsiz, 0),
    ts.id is not null,
    coalesce(ts.tutar, 0),
    ts.created_at
  from gunler g
  left join ogun     o  on o.tarih = g.tarih
  left join tahsilat t  on t.tarih = g.tarih
  left join kasa     k  on k.tarih = g.tarih
  left join teslimler ts on ts.tarih = g.tarih
  order by g.tarih desc;
$$;

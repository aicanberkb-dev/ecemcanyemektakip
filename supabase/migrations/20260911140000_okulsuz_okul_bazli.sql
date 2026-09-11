-- Kapalı gün okul bazında da tutulabilsin.
--
-- Menü ekranındaki "Okul yok" ve "Geri al" artık o menüyü yiyen hizmet
-- yerlerine yazıyor (hizmet_noktasi_id dolu); önce tüm yerler için tek genel
-- kayıt yazıyordu, AHMET MİTHAT menüsünde geri alınan gün GÖKSU'da da
-- açılıyordu. Okulun ders günü, devam, tahakkuk ve hak ediş hesapları bu yüzden
-- genel kayıtla birlikte okulun kendi hizmet yerine konmuş kayıtları da görmeli.

create or replace function public.okul_kapali(p_okul_id uuid, p_tarih date)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.okulsuz_gunler o
    where o.tarih = p_tarih
      and (o.hizmet_noktasi_id is null
           or o.hizmet_noktasi_id in (
             select n.id from public.hizmet_noktalari n where n.okul_id = p_okul_id))
  );
$$;

create or replace function public.sezon_ders_gunu(p_sezon_id uuid)
returns integer
language sql
stable
set search_path to 'public'
as $function$
  select count(*)::int
  from public.sezonlar z
  cross join generate_series(z.baslangic, z.bitis, interval '1 day') d
  where z.id = p_sezon_id
    and z.baslangic is not null and z.bitis is not null
    and extract(isodow from d) < 6
    and not public.okul_kapali(z.okul_id, d::date);
$function$;

create or replace function public.sezon_ders_gunu_kendi()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.baslangic is null or new.bitis is null then
    new.ders_gunu_sayisi := 0;
    return new;
  end if;

  -- BEFORE tetiğinde satır henüz yazılmadığı için hesap NEW üzerinden yapılır;
  -- sezon_ders_gunu() tablodan okuyacağı için eski tarihi kullanırdı.
  select count(*)::int into new.ders_gunu_sayisi
  from generate_series(new.baslangic, new.bitis, interval '1 day') d
  where extract(isodow from d) < 6
    and not public.okul_kapali(new.okul_id, d::date);

  return new;
end;
$function$;

create or replace function public.aylik_tahakkuk(p_okul_id uuid, p_bas date, p_bit date)
returns table(tarih date, tutar numeric, ogrenci integer)
language sql
stable
set search_path to 'public'
as $function$
  with sezon as (
    select z.id, z.baslangic, z.bitis, z.ders_gunu_sayisi
    from public.sezonlar z
    where z.okul_id = p_okul_id and z.aktif
      and z.baslangic is not null and z.bitis is not null
      and coalesce(z.ders_gunu_sayisi, 0) > 0
  ),
  gunler as (
    select s.id as sezon_id, s.ders_gunu_sayisi, d::date as tarih
    from sezon s
    cross join generate_series(
      greatest(p_bas, s.baslangic), least(p_bit, s.bitis), interval '1 day') d
    where extract(isodow from d) < 6
      and not public.okul_kapali(p_okul_id, d::date)
  ),
  abone as (
    select a.student_id, a.sezon_id, a.baslangic, a.bitis,
           public.ogrenci_yillik_ucret(a.student_id, a.sezon_id) as yillik
    from public.abonelik_donemleri a
    join public.students st on st.id = a.student_id
    where st.okul_id = p_okul_id and a.tip = 'aylik'
  )
  select
    g.tarih,
    round(coalesce(sum(a.yillik / g.ders_gunu_sayisi), 0), 2),
    count(a.student_id)::int
  from gunler g
  left join abone a
    on a.sezon_id = g.sezon_id
   and a.baslangic <= g.tarih
   and (a.bitis is null or a.bitis >= g.tarih)
  group by g.tarih
  order by g.tarih;
$function$;

create or replace function public.devam_cizelgesi(p_okul_id uuid, p_yil integer, p_ay integer)
returns table(student_id uuid, ogrenci_no text, ad_soyad text, sinif text, abone_tipi abone_tipi, ogrenci_tipi ogrenci_tipi, geldigi_gunler integer[], odeme_gunleri integer[], odeme_detay jsonb, geldi_sayisi integer, gelmedi_sayisi integer)
language sql
stable
set search_path to 'public'
as $function$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as ay_bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as ay_bit
  ),
  ders_gunu as (
    select count(*)::int as gun_sayisi
    from sinir, generate_series(sinir.ay_bas, sinir.ay_bit, interval '1 day') g
    where extract(isodow from g) < 6
      and not public.okul_kapali(p_okul_id, g::date)
  ),
  gelis as (
    select
      t.student_id,
      array_agg(extract(day from t.tarih)::int order by t.tarih)    as gunler,
      count(*)::int                                                 as adet,
      count(*) filter (where extract(isodow from t.tarih) < 6)::int as hafta_ici_adet
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.ogun_abone_tipi is not null
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id
  ),
  odeme_gun as (
    select t.student_id, t.tarih, sum(t.tutar) as gun_tahsilat
    from public.transactions t
    join public.students st on st.id = t.student_id, sinir
    where t.tip = 'tahsilat'
      and t.tarih between sinir.ay_bas and sinir.ay_bit
      and st.okul_id = p_okul_id
    group by t.student_id, t.tarih
  ),
  bakiye as (
    select
      o.student_id, o.tarih, o.gun_tahsilat,
      s.devir
        + coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'tahsilat'
                       and x.tarih < o.tarih), 0)
        - coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'harcama'
                       and x.tarih < o.tarih), 0) as oncesi,
      s.devir
        + coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'tahsilat'
                       and x.tarih <= o.tarih), 0)
        - coalesce((select sum(x.tutar) from public.transactions x
                     where x.student_id = o.student_id and x.tip = 'harcama'
                       and x.tarih <= o.tarih), 0) as sonrasi
    from odeme_gun o
    join public.students s on s.id = o.student_id
  ),
  odeme as (
    select
      b.student_id,
      array_agg(extract(day from b.tarih)::int order by b.tarih) as gunler,
      jsonb_object_agg(
        extract(day from b.tarih)::int,
        jsonb_build_object('tutar', b.gun_tahsilat, 'oncesi', b.oncesi, 'sonrasi', b.sonrasi)
      ) as detay
    from bakiye b
    group by b.student_id
  )
  select
    s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.abone_tipi, s.ogrenci_tipi,
    coalesce(g.gunler, '{}'::int[]),
    coalesce(o.gunler, '{}'::int[]),
    coalesce(o.detay, '{}'::jsonb),
    coalesce(g.adet, 0),
    greatest(0, ders_gunu.gun_sayisi - coalesce(g.hafta_ici_adet, 0))
  from public.students s
  cross join ders_gunu
  left join gelis g on g.student_id = s.id
  left join odeme o on o.student_id = s.id
  where s.aktif and s.okul_id = p_okul_id
  order by s.ad_soyad;
$function$;

create or replace function public.ogrenci_hakedis(p_student_id uuid, p_tarih date default current_date)
returns table(sezon_id uuid, sezon_adi text, yillik_ucret numeric, ders_gunu integer, gunluk_tahakkuk numeric, gecen_gun integer, kalan_gun integer, hakedis numeric, tahsilat numeric, iade_edilen numeric, fark numeric, donem_bitti boolean, donem_bitisi date)
language sql
stable
set search_path to 'public'
as $function$
  with ogrenci as (
    select s.id, s.okul_id from public.students s where s.id = p_student_id
  ),
  donem as (
    select a.sezon_id, a.baslangic, a.bitis
    from public.abonelik_donemleri a, ogrenci o
    where a.student_id = o.id and a.tip = 'aylik'
    order by a.baslangic desc limit 1
  ),
  sezon as (
    select z.id, z.ad, z.okul_id, z.baslangic, z.bitis, z.ders_gunu_sayisi,
           (select max(o2.bitis) from public.sezonlar o2
             where o2.okul_id = z.okul_id and o2.id <> z.id
               and o2.bitis is not null and o2.bitis < z.baslangic) as onceki_bitis
    from public.sezonlar z, donem d where z.id = d.sezon_id
  ),
  -- Aboneliğin kapsadığı, bugüne kadar geçen ders günleri
  gun as (
    select
      count(*) filter (where g <= p_tarih)::int as gecen,
      count(*)::int as toplam
    from donem d, generate_series(d.baslangic, coalesce(d.bitis, (select bitis from sezon)),
                                  interval '1 day') g
    where extract(isodow from g) < 6
      and not public.okul_kapali((select okul_id from ogrenci), g::date)
  ),
  para as (
    select
      coalesce(sum(t.tutar) filter (where t.tip = 'tahsilat'), 0) as tahsilat,
      coalesce(sum(t.tutar) filter (where t.tip = 'iade'), 0)     as iade
    from public.transactions t, sezon s
    where t.student_id = p_student_id
      and (s.onceki_bitis is null or t.tarih > s.onceki_bitis)
      and (s.bitis is null or t.tarih <= s.bitis)
  ),
  ucret as (
    select public.ogrenci_yillik_ucret(p_student_id, s.id) as yillik from sezon s
  )
  select
    s.id, s.ad, u.yillik, s.ders_gunu_sayisi,
    round(u.yillik / nullif(s.ders_gunu_sayisi, 0), 2),
    g.gecen,
    greatest(0, g.toplam - g.gecen),
    round(u.yillik / nullif(s.ders_gunu_sayisi, 0) * g.gecen, 2),
    p.tahsilat, p.iade,
    round(p.tahsilat - p.iade - u.yillik / nullif(s.ders_gunu_sayisi, 0) * g.gecen, 2),
    d.bitis is not null and d.bitis < (select bitis from sezon),
    d.bitis
  from sezon s, gun g, para p, ucret u, donem d;
$function$;

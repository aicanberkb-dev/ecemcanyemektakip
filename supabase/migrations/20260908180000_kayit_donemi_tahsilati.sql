-- Kayıt döneminde alınan para taksit takibinde görünmüyordu.
--
-- Sezonun baslangic/bitis tarihleri ders dönemini tanımlıyor; ciro bunlara
-- göre gün gün işleniyor. Ama tahsilat penceresi de aynı tarihlere bağlanmıştı:
-- okul açılmadan önce, kayıt sırasında alınan ilk taksit sezonun dışında kalıp
-- "ödenen" toplamına girmiyordu. Öğrenci parayı yatırmış olmasına rağmen
-- borçlu görünüyordu.
--
-- Doğru sınır ders döneminin başı değil, bir önceki sezonun sonu: o tarihten
-- sonra alınan her para bu sezona aittir. Önceki sezon yoksa alt sınır da
-- yoktur — kayıt parası hangi tarihte alınırsa alınsın sezona sayılır.

create or replace function public.taksit_durumu(p_sezon_id uuid, p_tarih date default current_date)
 returns table(student_id uuid, ogrenci_no text, ad_soyad text, sinif text, ogrenci_tipi ogrenci_tipi, yillik_toplam numeric, vadesi_gelen numeric, odenen numeric, eksik numeric, odeme_alinmali boolean, son_vade date, ozel_plan boolean)
 language sql
 stable
 set search_path to 'public'
as $function$
  with sezon as (
    select z.id, z.okul_id, z.baslangic, z.bitis,
           (select max(o.bitis) from public.sezonlar o
             where o.okul_id = z.okul_id and o.id <> z.id
               and o.bitis is not null and o.bitis < z.baslangic) as onceki_bitis
    from public.sezonlar z where z.id = p_sezon_id
  ),
  ogrenciler as (
    select s.id, s.ogrenci_no, s.ad_soyad, s.sinif, s.ogrenci_tipi,
           public.plan_tipi(s.ogrenci_tipi) as plan_tipi
    from public.students s, sezon
    where s.abone_tipi = 'aylik' and s.aktif and s.okul_id = sezon.okul_id
  ),
  plan as (
    select id, tutar, vade_tarihi, ogrenci_tipi
    from public.taksit_plani where sezon_id = p_sezon_id
  ),
  etkin as (
    select
      o.id as student_id,
      coalesce(ot.tutar, p.tutar)             as tutar,
      coalesce(ot.vade_tarihi, p.vade_tarihi) as vade_tarihi,
      (ot.id is not null)                     as ozel
    from ogrenciler o
    join plan p on p.ogrenci_tipi = o.plan_tipi
    left join public.ogrenci_taksit ot
      on ot.taksit_plani_id = p.id and ot.student_id = o.id
    union all
    select o.id, ot.tutar, ot.vade_tarihi, true
    from ogrenciler o
    join public.ogrenci_taksit ot
      on ot.student_id = o.id and ot.taksit_plani_id is null and ot.sezon_id = p_sezon_id
  ),
  toplam as (
    select
      student_id,
      coalesce(sum(tutar), 0)                                       as yillik,
      coalesce(sum(tutar) filter (where vade_tarihi <= p_tarih), 0) as vadesi_gelen,
      max(vade_tarihi) filter (where vade_tarihi <= p_tarih)        as son_vade,
      bool_or(ozel)                                                 as ozel
    from etkin
    group by student_id
  ),
  odeme as (
    select t.student_id, coalesce(sum(t.tutar), 0) as odenen
    from public.transactions t
    join public.students s on s.id = t.student_id
    cross join sezon
    where t.tip = 'tahsilat'
      and s.okul_id = sezon.okul_id
      -- Alt sınır önceki sezonun sonu; yoksa sınır yok (kayıt dönemi dahil).
      and (sezon.onceki_bitis is null or t.tarih > sezon.onceki_bitis)
      and (sezon.bitis is null or t.tarih <= sezon.bitis)
    group by t.student_id
  )
  select
    o.id, o.ogrenci_no, o.ad_soyad, o.sinif, o.ogrenci_tipi,
    coalesce(tp.yillik, 0),
    coalesce(tp.vadesi_gelen, 0),
    coalesce(od.odenen, 0),
    greatest(0, coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)),
    (coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)) > 0,
    tp.son_vade,
    coalesce(tp.ozel, false)
  from ogrenciler o
  left join toplam tp on tp.student_id = o.id
  left join odeme  od on od.student_id = o.id
  order by (coalesce(tp.vadesi_gelen, 0) - coalesce(od.odenen, 0)) desc, o.ad_soyad;
$function$;

-- Hakedişte de aynı pencere kullanılıyordu; kayıt parası tahsilat sayılmıyor,
-- öğrenci daha ilk günden alacaklı görünüyordu.
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
      and not exists (
        select 1 from public.okulsuz_gunler o
        where o.tarih = g::date and o.hizmet_noktasi_id is null
      )
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

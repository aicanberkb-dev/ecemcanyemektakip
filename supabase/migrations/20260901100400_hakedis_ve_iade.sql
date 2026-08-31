-- 20260901100400_hakedis_ve_iade.sql
--
-- Hakediş hesabı ve iade işlemi.
--
-- Veli "çocuğum gelmiyor, param geri" dediğinde rakam pazarlık konusu
-- olmasın: geçen ders günü × günlük tahakkuk kadarını hak ettik, üstü iade.
-- Aylıkçının bakiyesi bu soruya cevap veremiyor — öğün ücreti düşülmediği
-- için "kalan" hep yatırılan paraya eşit çıkıyor.

-- İade: veliye geri ödenen para. Ayrı bir tip olarak duruyor ki "sezon
-- boyunca ne kadar iade verdik" sorusu cevaplanabilsin; negatif tahsilat
-- yazsaydık ya da harcama saysaydık bu bilgi kaybolurdu.
alter type public.islem_tipi add value if not exists 'iade';

-- İadenin de bir ödeme yöntemi var: nakit mi çıktı, havale mi edildi.
alter table public.transactions drop constraint if exists transactions_odeme_yontemi_ck;
alter table public.transactions add constraint transactions_odeme_yontemi_ck check (
  (tip = 'tahsilat' and odeme_yontemi is not null)
  or (tip = 'iade')                                   -- iadede isteğe bağlı
  or (tip not in ('tahsilat', 'iade') and odeme_yontemi is null)
);

-- İade artık öğrencinin ödediğinden düşülüyor
create or replace view public.student_balances as
  select s.id as student_id, s.okul_id, s.ogrenci_no, s.ad_soyad, s.sinif, s.kimlik_no,
         s.veli_adi, s.veli_telefon, s.veli2_adi, s.veli2_telefon, s.kardes_grup_id,
         s.abone_tipi, s.ogrenci_tipi, s.aktif, s.iskonto_orani, s.iskonto_tutar, s.devir,
         coalesce(h.alinan, 0) as alinan_para,
         coalesce(h.harcanan, 0) as harcanan,
         s.devir + coalesce(h.alinan, 0) - coalesce(h.harcanan, 0) as kalan,
         coalesce(h.ogun_sayisi, 0) as ogun_sayisi,
         public.efektif_gunluk_ucret(a.taban_gunluk_ucret, s.iskonto_orani, s.iskonto_tutar)
           as gunluk_ucret
  from public.students s
  join public.app_settings a on a.okul_id = s.okul_id
  left join lateral (
    select
      -- 10.000 alıp 9.000 iade ettiysek 1.000 aldık
      coalesce(sum(t.tutar) filter (where t.tip = 'tahsilat'), 0)
        - coalesce(sum(t.tutar) filter (where t.tip = 'iade'), 0) as alinan,
      sum(t.tutar) filter (where t.tip = 'harcama') as harcanan,
      count(*) filter (where t.ogun_abone_tipi is not null) as ogun_sayisi
    from public.transactions t where t.student_id = s.id
  ) h on true;

-- ---------------------------------------------------------------------------
-- Aylıkçının hakediş hesabı
-- ---------------------------------------------------------------------------
create or replace function public.ogrenci_hakedis(
  p_student_id uuid, p_tarih date default current_date
)
returns table (
  sezon_id        uuid,
  sezon_adi       text,
  yillik_ucret    numeric,
  ders_gunu       integer,
  gunluk_tahakkuk numeric,
  gecen_gun       integer,
  kalan_gun       integer,
  hakedis         numeric,
  tahsilat        numeric,
  iade_edilen     numeric,
  fark            numeric,
  donem_bitti     boolean,
  donem_bitisi    date
)
language sql stable
set search_path = public
as $$
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
    select z.id, z.ad, z.baslangic, z.bitis, z.ders_gunu_sayisi
    from public.sezonlar z, donem d where z.id = d.sezon_id
  ),
  -- Aboneliğin kapsadığı ders günleri; kaçı bugüne kadar geçti
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
      and t.tarih between s.baslangic and s.bitis
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
$$;

revoke execute on function public.ogrenci_hakedis(uuid, date) from public, anon;
grant execute on function public.ogrenci_hakedis(uuid, date) to authenticated;

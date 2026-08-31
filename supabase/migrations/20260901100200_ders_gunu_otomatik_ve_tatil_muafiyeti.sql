-- 20260901100200_ders_gunu_otomatik_ve_tatil_muafiyeti.sql
--
-- 1) Ders günü sayısı artık elle değil, takvimden hesaplanıyor.
--
-- Sezon başında sabitlemek bir tuzak barındırıyordu: yarım günde ya da bir
-- bayramda yemek çıktığı ortaya çıkıp o gün "okul var" yapılırsa gün sayısı
-- eskisinde kalıyor, tahakkuk bir fazla güne yayılıyor ve sezon toplamı
-- yıllık ücretten sapıyordu (178 yerine 179 güne bölünce %0,6 fazla).
--
-- Artık tek kural var: "okul yok" dediğin her gün ders gününden düşer,
-- günlük tahakkuk yeniden bölünür, sezon toplamı hep yıllık ücrete eşit
-- kalır. Yalnızca okul geneli kapanışlar (hizmet_noktasi_id boş) sayar; tek
-- bir hizmet yerine özel gezi okulun ders gününü etkilemez.
--
-- 2) Devam çizelgesinde tatil günleri devamsızlık sayılmıyor.

create or replace function public.sezon_ders_gunu(p_sezon_id uuid)
returns integer
language sql stable
set search_path = public
as $$
  select count(*)::int
  from public.sezonlar z
  cross join generate_series(z.baslangic, z.bitis, interval '1 day') d
  where z.id = p_sezon_id
    and z.baslangic is not null and z.bitis is not null
    and extract(isodow from d) < 6
    and not exists (
      select 1 from public.okulsuz_gunler o
      where o.tarih = d::date and o.hizmet_noktasi_id is null
    );
$$;

revoke execute on function public.sezon_ders_gunu(uuid) from public, anon;
grant execute on function public.sezon_ders_gunu(uuid) to authenticated;

create or replace function public.sezon_ders_gunu_tazele()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t date := coalesce(new.tarih, old.tarih);
begin
  update public.sezonlar z
  set ders_gunu_sayisi = public.sezon_ders_gunu(z.id), updated_at = now()
  where z.baslangic <= t and z.bitis >= t;
  return null;
end;
$$;

drop trigger if exists okulsuz_gunler_ders_gunu on public.okulsuz_gunler;
create trigger okulsuz_gunler_ders_gunu
after insert or update or delete on public.okulsuz_gunler
for each row execute function public.sezon_ders_gunu_tazele();

update public.sezonlar set ders_gunu_sayisi = public.sezon_ders_gunu(id)
where baslangic is not null and bitis is not null;

-- Tahakkuk artık planlı/plansız ayrımı yapmıyor: ders günü ne ise o.
create or replace function public.aylik_tahakkuk(p_okul_id uuid, p_bas date, p_bit date)
returns table (tarih date, tutar numeric, ogrenci integer)
language sql stable
set search_path = public
as $$
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
      and not exists (
        select 1 from public.okulsuz_gunler o
        where o.tarih = d::date and o.hizmet_noktasi_id is null
      )
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
$$;

revoke execute on function public.aylik_tahakkuk(uuid, date, date) from public, anon;
grant execute on function public.aylik_tahakkuk(uuid, date, date) to authenticated;

alter table public.okulsuz_gunler drop column if exists planli;

-- ---------------------------------------------------------------------------
-- Devam çizelgesi: tatil günü devamsızlık değil
--
-- "Gelmedi" sayısı ayın bütün hafta içi günlerinden hesaplanıyordu; sömestr
-- tatilinde 10, ara tatilde 5 gün öğrencinin sırtına devamsızlık olarak
-- yazılıyordu.
-- ---------------------------------------------------------------------------
create or replace function public.devam_cizelgesi(p_okul_id uuid, p_yil integer, p_ay integer)
returns table (
  student_id uuid, ogrenci_no text, ad_soyad text, sinif text,
  abone_tipi abone_tipi, ogrenci_tipi ogrenci_tipi,
  geldigi_gunler integer[], odeme_gunleri integer[], odeme_detay jsonb,
  geldi_sayisi integer, gelmedi_sayisi integer
)
language sql stable
set search_path = public
as $$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as ay_bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as ay_bit
  ),
  ders_gunu as (
    select count(*)::int as gun_sayisi
    from sinir, generate_series(sinir.ay_bas, sinir.ay_bit, interval '1 day') g
    where extract(isodow from g) < 6
      and not exists (
        select 1 from public.okulsuz_gunler o
        where o.tarih = g::date and o.hizmet_noktasi_id is null
      )
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
$$;

revoke execute on function public.devam_cizelgesi(uuid, integer, integer) from public, anon;
grant execute on function public.devam_cizelgesi(uuid, integer, integer) to authenticated;

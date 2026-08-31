-- 20260901100100_aylikci_tahakkuk.sql
--
-- Aylıkçının cirosu artık katılımdan değil abonelikten geliyor.
--
-- Eski kurgu şuydu: ciro = aylıkçı_sayısı × taban_günlük_ücret. İki hata
-- birden vardı:
--   1) Gelmeyen aylıkçı sıfır ciro üretiyordu. Oysa veli yıllık ücreti
--      ödüyor; "çocuk hastaydı, taksiti eksik yatırayım" diye bir şey yok.
--   2) Çarpan taban ücretti, öğrencinin kendi yıllık ücreti değildi. Kardeş
--      indirimli öğrenciyle tam ücretli öğrenci aynı ciroyu üretiyordu.
--
-- Yeni kurgu: aylıkçı, aboneliği açık olduğu her ders gününde
-- (kendi yıllık ücreti / sezonun ders günü sayısı) kadar ciro üretir.

-- ---------------------------------------------------------------------------
-- Planlı tatil ile sonradan eklenen kapalı gün ayrımı
--
-- Planlı tatil (sömestr, resmi bayram) ders günü sayısından zaten düşüldü;
-- o günlerde tahakkuk işlemez. Sonradan eklenen gezi/kar tatili ise böleni
-- değiştirmez — veli yıllık ödedi, o günü de kazandık — tahakkuk işler.
-- ---------------------------------------------------------------------------
alter table public.okulsuz_gunler
  add column if not exists planli boolean not null default false;

update public.okulsuz_gunler set planli = true
where hizmet_noktasi_id is null and tarih between '2026-09-14' and '2027-06-25';

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Abonelik dönemleri
--
-- students.abone_tipi yalnızca bugünkü durumu tutuyor; "15 Ocak'ta kim
-- aylıkçıydı" sorusuna cevap veremiyordu. Ciro artık tahakkukla hesaplandığı
-- için bu soru doğrudan paraya dokunuyor.
-- ---------------------------------------------------------------------------
create table if not exists public.abonelik_donemleri (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  sezon_id   uuid not null references public.sezonlar(id) on delete cascade,
  tip        abone_tipi not null,
  baslangic  date not null,
  bitis      date,
  sebep      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abonelik_tarih_sirasi check (bitis is null or bitis >= baslangic),
  -- Çakışan dönem ciroyu iki kez saydırır; veritabanı engellesin
  constraint abonelik_cakisma_yok exclude using gist (
    student_id with =,
    daterange(baslangic, coalesce(bitis, 'infinity'::date), '[]') with &&
  )
);

alter table public.abonelik_donemleri enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'abonelik_donemleri' and policyname = 'abonelik_donemleri_hepsi'
  ) then
    create policy abonelik_donemleri_hepsi on public.abonelik_donemleri
      to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists abonelik_donemleri_sezon_idx
  on public.abonelik_donemleri (sezon_id, tip, baslangic);

-- Mevcut aylıkçılar sezon boyu açık dönemle başlar; kimse elle giriş yapmaz
insert into public.abonelik_donemleri (student_id, sezon_id, tip, baslangic, bitis, sebep)
select s.id, z.id, 'aylik', z.baslangic, z.bitis, 'Sezon başı varsayılan'
from public.students s
join public.sezonlar z on z.okul_id = s.okul_id and z.aktif
where s.abone_tipi = 'aylik' and s.aktif
  and z.baslangic is not null and z.bitis is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Öğrencinin o sezondaki yıllık ücreti
--
-- Özel planı varsa o, yoksa tipinin taksit planı. taksit_durumu içindeki
-- mantığın aynısı; ciro da aynı rakamı kullansın diye ayrı fonksiyona alındı
-- — iki yerde iki farklı ücret çıkması en kötü ihtimal.
-- ---------------------------------------------------------------------------
create or replace function public.ogrenci_yillik_ucret(p_student_id uuid, p_sezon_id uuid)
returns numeric
language sql stable
set search_path = public
as $$
  with ogrenci as (
    select s.id, public.plan_tipi(s.ogrenci_tipi) as plan_tipi
    from public.students s where s.id = p_student_id
  ),
  plan as (
    select id, tutar, ogrenci_tipi from public.taksit_plani where sezon_id = p_sezon_id
  ),
  etkin as (
    select coalesce(ot.tutar, p.tutar) as tutar
    from ogrenci o
    join plan p on p.ogrenci_tipi = o.plan_tipi
    left join public.ogrenci_taksit ot
      on ot.taksit_plani_id = p.id and ot.student_id = o.id
    union all
    select ot.tutar
    from ogrenci o
    join public.ogrenci_taksit ot
      on ot.student_id = o.id and ot.taksit_plani_id is null and ot.sezon_id = p_sezon_id
  )
  select coalesce(sum(tutar), 0) from etkin;
$$;

revoke execute on function public.ogrenci_yillik_ucret(uuid, uuid) from public, anon;
grant execute on function public.ogrenci_yillik_ucret(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aylıkçıların günlük tahakkuku
-- ---------------------------------------------------------------------------
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
        where o.tarih = d::date and o.planli and o.hizmet_noktasi_id is null
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

-- ---------------------------------------------------------------------------
-- Günlük özet: aylıkçı katkısı artık tahakkuktan
--
-- Aylıkçının öğün kaydı duruyor (maliyet, fire, devam çizelgesi için) ama
-- ciroya girmiyor — yoksa hem tahakkuk hem öğün sayılır, çift sayım olur.
-- ---------------------------------------------------------------------------
create or replace function public.okul_gunluk_ozet(p_okul_id uuid, p_bas date, p_bit date)
returns table (tarih date, kisi integer, misafir integer, ciro numeric)
language sql stable
set search_path = public
as $$
  with ogrenci as (
    select t.tarih,
      count(*) filter (where t.ogun_abone_tipi = 'gunluk')::int as gunlukcu,
      count(*) filter (where t.ogun_abone_tipi = 'aylik')::int  as aylikci,
      coalesce(sum(t.tutar) filter (where t.ogun_abone_tipi = 'gunluk'), 0) as gunlukcu_tutar
    from public.transactions t
    join public.students s on s.id = t.student_id
    where s.okul_id = p_okul_id
      and t.tarih between p_bas and p_bit
      and t.ogun_abone_tipi is not null
    group by t.tarih
  ),
  serbest as (
    select tarih,
      count(*) filter (where tip = 'ucretli')::int as ucretli,
      count(*) filter (where tip = 'misafir')::int as misafir,
      coalesce(sum(tutar) filter (where tip = 'ucretli'), 0) as ucretli_tutar
    from public.serbest_ogunler
    where okul_id = p_okul_id and tarih between p_bas and p_bit
    group by tarih
  ),
  tahakkuk as (
    select tarih, tutar from public.aylik_tahakkuk(p_okul_id, p_bas, p_bit)
  ),
  -- Tahakkuk günleri de listeye girer: kimse yemese bile o gün ciro var
  gunler as (
    select tarih from ogrenci
    union select tarih from serbest
    union select tarih from tahakkuk
  )
  select
    g.tarih,
    coalesce(o.gunlukcu, 0) + coalesce(o.aylikci, 0) + coalesce(s.ucretli, 0),
    coalesce(s.misafir, 0),
    round(
      coalesce(o.gunlukcu_tutar, 0)
      + coalesce(s.ucretli_tutar, 0)
      + coalesce(th.tutar, 0), 2)
  from gunler g
  left join ogrenci  o  on o.tarih  = g.tarih
  left join serbest  s  on s.tarih  = g.tarih
  left join tahakkuk th on th.tarih = g.tarih
  order by g.tarih;
$$;

revoke execute on function public.okul_gunluk_ozet(uuid, date, date) from public, anon;
grant execute on function public.okul_gunluk_ozet(uuid, date, date) to authenticated;

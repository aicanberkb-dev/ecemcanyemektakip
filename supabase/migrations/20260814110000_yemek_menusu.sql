-- 20260814110000_yemek_menusu.sql
--
-- Aylık yemek listesi.
--
-- Menü günlük ve dört satırdan oluşuyor: çorba, ana yemek, yardımcı yemek ve
-- dördüncü kalem (tatlı/meyve/ayran gibi). Amaç yalnızca listeyi tutmak değil:
-- gün sonu raporunda o günün menüsü görünecek, böylece "hangi yemekte kaç kişi
-- geliyor" verisi birikecek ve gelecek menüler ona bakılarak kurulabilecek.

create table if not exists public.menu_gunleri (
  id         uuid primary key default gen_random_uuid(),
  okul_id    uuid not null references public.okullar(id) on delete cascade,
  tarih      date not null,
  corba      text,
  ana_yemek  text,
  yardimci   text,
  ek         text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (okul_id, tarih)
);

create index if not exists menu_gunleri_okul_tarih_idx
  on public.menu_gunleri (okul_id, tarih);

drop trigger if exists set_updated_at on public.menu_gunleri;
create trigger set_updated_at before update on public.menu_gunleri
  for each row execute function public.set_updated_at();

alter table public.menu_gunleri enable row level security;

drop policy if exists menu_gunleri_secme on public.menu_gunleri;
create policy menu_gunleri_secme on public.menu_gunleri
  for select to authenticated using (true);

drop policy if exists menu_gunleri_yazma on public.menu_gunleri;
create policy menu_gunleri_yazma on public.menu_gunleri
  for all to authenticated using (true) with check (true);

revoke all on public.menu_gunleri from public, anon;
grant select, insert, update, delete on public.menu_gunleri to authenticated;

-- ---------------------------------------------------------------------------
-- Yemek havuzu: geçmiş menülerde geçen adlar
-- ---------------------------------------------------------------------------
-- Yeni menü kurulurken sürükle-bırak için kullanılacak liste. Ayrı bir tablo
-- tutmak yerine geçmiş menülerden türetiliyor: kullanıcı yeni bir yemek adı
-- yazdığı anda havuza da girmiş oluyor, ikinci bir yerde bakım gerekmiyor.
create or replace function public.yemek_havuzu(p_okul_id uuid)
returns table (kategori text, ad text, kullanim integer, son_tarih date)
language sql stable
set search_path = public
as $$
  with tum as (
    select 'corba'::text as kategori, corba     as ad, tarih from public.menu_gunleri where okul_id = p_okul_id and corba     is not null and btrim(corba)     <> ''
    union all
    select 'ana_yemek',               ana_yemek,       tarih from public.menu_gunleri where okul_id = p_okul_id and ana_yemek is not null and btrim(ana_yemek) <> ''
    union all
    select 'yardimci',                yardimci,        tarih from public.menu_gunleri where okul_id = p_okul_id and yardimci  is not null and btrim(yardimci)  <> ''
    union all
    select 'ek',                      ek,              tarih from public.menu_gunleri where okul_id = p_okul_id and ek        is not null and btrim(ek)        <> ''
  )
  select kategori, ad, count(*)::int as kullanim, max(tarih) as son_tarih
  from tum
  group by kategori, ad
  order by kategori, count(*) desc, ad;
$$;

revoke execute on function public.yemek_havuzu(uuid) from public, anon;
grant execute on function public.yemek_havuzu(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Yemek başına katılım
-- ---------------------------------------------------------------------------
-- "Bu ana yemekte ortalama kaç kişi geliyor" sorusunun cevabı. Menüdeki ana
-- yemek ile o günkü öğün sayısı eşleştirilir.
create or replace function public.yemek_katilimi(p_okul_id uuid)
returns table (ana_yemek text, gun_sayisi integer, toplam_ogun integer, ortalama numeric)
language sql stable
set search_path = public
as $$
  with gunluk as (
    select
      m.tarih,
      m.ana_yemek,
      (select count(*) from public.transactions t
        join public.students s on s.id = t.student_id
       where s.okul_id = p_okul_id and t.tarih = m.tarih
         and t.ogun_abone_tipi is not null)::int as ogun
    from public.menu_gunleri m
    where m.okul_id = p_okul_id
      and m.ana_yemek is not null and btrim(m.ana_yemek) <> ''
  )
  select
    ana_yemek,
    count(*)::int                      as gun_sayisi,
    sum(ogun)::int                     as toplam_ogun,
    round(avg(ogun)::numeric, 1)       as ortalama
  from gunluk
  where ogun > 0
  group by ana_yemek
  order by avg(ogun) desc, ana_yemek;
$$;

revoke execute on function public.yemek_katilimi(uuid) from public, anon;
grant execute on function public.yemek_katilimi(uuid) to authenticated;

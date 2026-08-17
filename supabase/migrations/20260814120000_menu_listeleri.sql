-- 20260814120000_menu_listeleri.sql
--
-- Menü listeleri.
--
-- Tek bir okul menüsü yetmiyor: okul menülerinin yanında taşımalı, özel eğitim
-- ve kaymakamlık listeleri var. Taşımalı kendi yemek havuzundan beslenir,
-- diğerleri ortak havuzu kullanır. Listeler birbirinden kopyalanabilir ama
-- kendi içlerinde bağımsız düzenlenir.

create table if not exists public.menu_listeleri (
  id           uuid primary key default gen_random_uuid(),
  ad           text not null unique,
  -- Havuz grubu: aynı gruptaki listeler birbirinin yemek havuzunu görür.
  havuz_grubu  text not null default 'genel',
  -- Okul menüsüyse hangi okul; bağımsız listelerde boş.
  okul_id      uuid references public.okullar(id) on delete cascade,
  sira         int  not null default 0,
  aktif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.menu_listeleri;
create trigger set_updated_at before update on public.menu_listeleri
  for each row execute function public.set_updated_at();

alter table public.menu_listeleri enable row level security;
drop policy if exists menu_listeleri_secme on public.menu_listeleri;
create policy menu_listeleri_secme on public.menu_listeleri
  for select to authenticated using (true);
drop policy if exists menu_listeleri_yazma on public.menu_listeleri;
create policy menu_listeleri_yazma on public.menu_listeleri
  for all to authenticated using (true) with check (true);

revoke all on public.menu_listeleri from public, anon;
grant select, insert, update, delete on public.menu_listeleri to authenticated;

-- Okul menüleri
insert into public.menu_listeleri (ad, havuz_grubu, okul_id, sira)
select o.ad, 'genel', o.id, case when o.ad = 'GÖKSU' then 1 else 2 end
from public.okullar o
on conflict (ad) do nothing;

-- Bağımsız listeler
insert into public.menu_listeleri (ad, havuz_grubu, okul_id, sira) values
  ('TAŞIMALI',     'tasimali', null, 3),
  ('ÖZEL EĞİTİM',  'genel',    null, 4),
  ('KAYMAKAMLIK',  'genel',    null, 5)
on conflict (ad) do nothing;

-- ---------------------------------------------------------------------------
-- menu_gunleri artık listeye bağlı
-- ---------------------------------------------------------------------------
alter table public.menu_gunleri add column if not exists liste_id uuid
  references public.menu_listeleri(id) on delete cascade;

-- Mevcut kayıtlar okulun kendi listesine taşınır
update public.menu_gunleri m
   set liste_id = l.id
  from public.menu_listeleri l
 where m.liste_id is null and l.okul_id = m.okul_id;

alter table public.menu_gunleri alter column liste_id set not null;

-- Benzersizlik artık liste + tarih üzerinde
alter table public.menu_gunleri drop constraint if exists menu_gunleri_okul_id_tarih_key;
drop index if exists public.menu_gunleri_okul_id_tarih_key;
create unique index if not exists menu_gunleri_liste_tarih_uniq
  on public.menu_gunleri (liste_id, tarih);

create index if not exists menu_gunleri_liste_idx on public.menu_gunleri (liste_id, tarih);

-- ---------------------------------------------------------------------------
-- Havuz artık grup bazlı
-- ---------------------------------------------------------------------------
drop function if exists public.yemek_havuzu(uuid);
create function public.yemek_havuzu(p_liste_id uuid)
returns table (kategori text, ad text, kullanim integer, son_tarih date)
language sql stable
set search_path = public
as $$
  with grup as (
    select havuz_grubu from public.menu_listeleri where id = p_liste_id
  ),
  kardes as (
    -- Aynı havuz grubundaki tüm listeler ortak havuzu besler
    select l.id from public.menu_listeleri l, grup g where l.havuz_grubu = g.havuz_grubu
  ),
  tum as (
    select 'corba'::text as kategori, corba as ad, tarih from public.menu_gunleri
      where liste_id in (select id from kardes) and corba is not null and btrim(corba) <> ''
    union all
    select 'ana_yemek', ana_yemek, tarih from public.menu_gunleri
      where liste_id in (select id from kardes) and ana_yemek is not null and btrim(ana_yemek) <> ''
    union all
    select 'yardimci', yardimci, tarih from public.menu_gunleri
      where liste_id in (select id from kardes) and yardimci is not null and btrim(yardimci) <> ''
    union all
    select 'ek', ek, tarih from public.menu_gunleri
      where liste_id in (select id from kardes) and ek is not null and btrim(ek) <> ''
  )
  select kategori, ad, count(*)::int, max(tarih)
  from tum group by kategori, ad
  order by kategori, count(*) desc, ad;
$$;

revoke execute on function public.yemek_havuzu(uuid) from public, anon;
grant execute on function public.yemek_havuzu(uuid) to authenticated;

-- Katılım hesabı okulun kendi listesine bakar
drop function if exists public.yemek_katilimi(uuid);
create function public.yemek_katilimi(p_okul_id uuid)
returns table (ana_yemek text, gun_sayisi integer, toplam_ogun integer, ortalama numeric)
language sql stable
set search_path = public
as $$
  with gunluk as (
    select
      m.tarih, m.ana_yemek,
      (select count(*) from public.transactions t
        join public.students s on s.id = t.student_id
       where s.okul_id = p_okul_id and t.tarih = m.tarih
         and t.ogun_abone_tipi is not null)::int as ogun
    from public.menu_gunleri m
    join public.menu_listeleri l on l.id = m.liste_id
    where l.okul_id = p_okul_id
      and m.ana_yemek is not null and btrim(m.ana_yemek) <> ''
  )
  select ana_yemek, count(*)::int, sum(ogun)::int, round(avg(ogun)::numeric, 1)
  from gunluk where ogun > 0
  group by ana_yemek
  order by avg(ogun) desc, ana_yemek;
$$;

revoke execute on function public.yemek_katilimi(uuid) from public, anon;
grant execute on function public.yemek_katilimi(uuid) to authenticated;

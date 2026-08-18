-- 20260818100000_yemek_bazli_cikan_porsiyon.sql
--
-- Çıkan porsiyon artık yemek bazında; mutfak ayrımı kaldırıldı.
--
-- Yemekhane tek, her yere aynı yerden gidiyor — mutfak kavramı gereksizdi.
--
-- Asıl mesele şu: bir günün menüsündeki kalemler aynı sayıda çıkmıyor. 80
-- kişilik bir yere ıspanak 50, tatlı 100 kişilik gönderiliyor; çocukların
-- ıspanağı sevmediği biliniyor, tatlıyı ise iki alan oluyor. Tek bir "çıkan"
-- sayısı bunu ifade edemez, o yüzden porsiyon her yemek için ayrı tutuluyor.
-- Maliyet = her kalemin porsiyonu × o yemeğin reçete maliyeti.

alter table public.hizmet_noktalari drop column if exists mutfak_id;
drop table if exists public.mutfaklar;

-- Tek sayılık çıkan porsiyon yerini yemek bazlı tabloya bıraktı
alter table public.gunluk_hizmet drop column if exists cikan_porsiyon;

create table if not exists public.gunluk_cikan (
  id                uuid primary key default gen_random_uuid(),
  hizmet_noktasi_id uuid not null references public.hizmet_noktalari(id) on delete cascade,
  tarih             date not null,
  yemek_adi         text not null,
  porsiyon          int  not null check (porsiyon >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (hizmet_noktasi_id, tarih, yemek_adi)
);

create index if not exists gunluk_cikan_nokta_tarih_idx
  on public.gunluk_cikan (hizmet_noktasi_id, tarih);

drop trigger if exists set_updated_at on public.gunluk_cikan;
create trigger set_updated_at before update on public.gunluk_cikan
  for each row execute function public.set_updated_at();

alter table public.gunluk_cikan enable row level security;
drop policy if exists gunluk_cikan_secme on public.gunluk_cikan;
create policy gunluk_cikan_secme on public.gunluk_cikan for select to authenticated using (true);
drop policy if exists gunluk_cikan_yazma on public.gunluk_cikan;
create policy gunluk_cikan_yazma on public.gunluk_cikan for all to authenticated using (true) with check (true);
revoke all on public.gunluk_cikan from public, anon;
grant select, insert, update, delete on public.gunluk_cikan to authenticated;

-- ---------------------------------------------------------------------------
-- Bir günün menü kalemleri ve kalem başına kişi maliyeti
-- ---------------------------------------------------------------------------
drop function if exists public.ay_menu_maliyeti(uuid, date, date);
create or replace function public.ay_menu_kalemleri(p_liste_id uuid, p_bas date, p_bit date)
returns table (
  tarih             date,
  corba             text, corba_maliyet     numeric,
  ana_yemek         text, ana_yemek_maliyet numeric,
  yardimci          text, yardimci_maliyet  numeric,
  ek                text, ek_maliyet        numeric
)
language sql stable
set search_path = public
as $$
  select
    m.tarih,
    nullif(btrim(coalesce(m.corba, '')), ''),     public.yemek_maliyeti(m.corba),
    nullif(btrim(coalesce(m.ana_yemek, '')), ''), public.yemek_maliyeti(m.ana_yemek),
    nullif(btrim(coalesce(m.yardimci, '')), ''),  public.yemek_maliyeti(m.yardimci),
    nullif(btrim(coalesce(m.ek, '')), ''),        public.yemek_maliyeti(m.ek)
  from public.menu_gunleri m
  where m.liste_id = p_liste_id and m.tarih between p_bas and p_bit
  order by m.tarih;
$$;

revoke execute on function public.ay_menu_kalemleri(uuid, date, date) from public, anon;
grant execute on function public.ay_menu_kalemleri(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Bir günün çıkan porsiyonu ve maliyeti
--
-- Bir kaleme porsiyon girilmemişse yerin varsayılanı geçerli. Hiçbir kaleme
-- girilmemiş ve varsayılan da yoksa hesap eksiktir; `girilmis` bunu söyler.
-- ---------------------------------------------------------------------------
create or replace function public.gun_cikan(
  p_nokta_id uuid, p_liste_id uuid, p_tarih date, p_varsayilan int
)
returns table (porsiyon integer, maliyet numeric, girilmis boolean)
language sql stable
set search_path = public
as $$
  with kalemler as (
    select nullif(btrim(coalesce(m.corba, '')), '') as yemek from public.menu_gunleri m
      where m.liste_id = p_liste_id and m.tarih = p_tarih
    union all
    select nullif(btrim(coalesce(m.ana_yemek, '')), '') from public.menu_gunleri m
      where m.liste_id = p_liste_id and m.tarih = p_tarih
    union all
    select nullif(btrim(coalesce(m.yardimci, '')), '') from public.menu_gunleri m
      where m.liste_id = p_liste_id and m.tarih = p_tarih
    union all
    select nullif(btrim(coalesce(m.ek, '')), '') from public.menu_gunleri m
      where m.liste_id = p_liste_id and m.tarih = p_tarih
  ),
  dolu as (
    select k.yemek,
           coalesce(c.porsiyon, p_varsayilan) as porsiyon,
           (c.porsiyon is not null) as elle
    from kalemler k
    left join public.gunluk_cikan c
      on c.hizmet_noktasi_id = p_nokta_id and c.tarih = p_tarih and c.yemek_adi = k.yemek
    where k.yemek is not null
  )
  select
    coalesce(sum(porsiyon), 0)::int,
    coalesce(sum(porsiyon * public.yemek_maliyeti(yemek)), 0),
    coalesce(bool_or(elle), false)
  from dolu;
$$;

revoke execute on function public.gun_cikan(uuid, uuid, date, int) from public, anon;
grant execute on function public.gun_cikan(uuid, uuid, date, int) to authenticated;

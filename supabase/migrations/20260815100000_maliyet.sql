-- 20260815100000_maliyet.sql
--
-- Maliyet ve kâr/zarar altyapısı.
--
-- Zincir şu: yemek → reçete (malzeme + kişi başı miktar) → malzeme birim fiyatı
-- = kişi başı maliyet. Hizmet noktasının kendi satış fiyatı ve o gün kaç kişi
-- yediği ile birleşince kâr/zarar çıkar.
--
-- Miktarlar malzemenin KENDİ biriminde saklanır (kg, lt, adet). Ekran gram/ml
-- gösterip böler; hesap böylece tek çarpma kalır: miktar × birim_fiyat.

create table if not exists public.malzemeler (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null unique,
  birim       text not null default 'kg' check (birim in ('kg', 'lt', 'adet')),
  birim_fiyat numeric(12,2) not null default 0 check (birim_fiyat >= 0),
  aciklama    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.yemek_receteleri (
  id         uuid primary key default gen_random_uuid(),
  yemek_adi  text not null,
  malzeme_id uuid not null references public.malzemeler(id) on delete cascade,
  -- Kişi başı miktar, malzemenin biriminde (0.08 kg = 80 g)
  miktar     numeric(12,4) not null check (miktar >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (yemek_adi, malzeme_id)
);

create index if not exists yemek_receteleri_yemek_idx on public.yemek_receteleri (yemek_adi);

create table if not exists public.hizmet_noktalari (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null unique,
  liste_id   uuid references public.menu_listeleri(id) on delete set null,
  aktif      boolean not null default true,
  sira       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Her noktanın satış fiyatı farklı ve zaman içinde değişiyor
create table if not exists public.hizmet_fiyatlari (
  id                uuid primary key default gen_random_uuid(),
  hizmet_noktasi_id uuid not null references public.hizmet_noktalari(id) on delete cascade,
  gecerli_baslangic date not null,
  kisi_basi_fiyat   numeric(12,2) not null check (kisi_basi_fiyat >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (hizmet_noktasi_id, gecerli_baslangic)
);

-- O gün o noktada kaç kişi yedi
create table if not exists public.gunluk_hizmet (
  id                uuid primary key default gen_random_uuid(),
  hizmet_noktasi_id uuid not null references public.hizmet_noktalari(id) on delete cascade,
  tarih             date not null,
  kisi_sayisi       int not null default 0 check (kisi_sayisi >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (hizmet_noktasi_id, tarih)
);

do $$
declare t text;
begin
  foreach t in array array['malzemeler','yemek_receteleri','hizmet_noktalari','hizmet_fiyatlari','gunluk_hizmet']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_secme on public.%I', t, t);
    execute format('create policy %I_secme on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_yazma on public.%I', t, t);
    execute format('create policy %I_yazma on public.%I for all to authenticated using (true) with check (true)', t, t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Hizmet noktaları — ilk aşama. Kullanıcı ekleyip çıkarabilir.
-- ---------------------------------------------------------------------------
insert into public.hizmet_noktalari (ad, sira) values
  ('GÖKSU', 1),
  ('AHMET MİTHAT POYRAZ AYETULLAH', 2),
  ('BEYKOZ ÖZEL EĞİTİM', 3),
  ('SIDIKA DOĞRUÖZ', 4),
  ('KAYMAKAMLIK', 5)
on conflict (ad) do nothing;

-- Menü listeleriyle eşleştir: hangi nokta hangi listeyi yiyor
update public.hizmet_noktalari h set liste_id = l.id
from public.menu_listeleri l
where h.liste_id is null
  and ((h.ad = 'GÖKSU' and l.ad = 'GÖKSU')
    or (h.ad = 'AHMET MİTHAT POYRAZ AYETULLAH' and l.ad = 'AHMET MİTHAT')
    or (h.ad = 'BEYKOZ ÖZEL EĞİTİM' and l.ad = 'ÖZEL EĞİTİM')
    or (h.ad = 'KAYMAKAMLIK' and l.ad = 'KAYMAKAMLIK'));

-- ---------------------------------------------------------------------------
-- Kişi başı yemek maliyeti
-- ---------------------------------------------------------------------------
create or replace function public.yemek_maliyeti(p_yemek_adi text)
returns numeric
language sql stable
set search_path = public
as $$
  select coalesce(sum(r.miktar * m.birim_fiyat), 0)
  from public.yemek_receteleri r
  join public.malzemeler m on m.id = r.malzeme_id
  where r.yemek_adi = p_yemek_adi;
$$;

-- Bir günün menüsünün kişi başı toplam maliyeti
create or replace function public.gun_maliyeti(p_liste_id uuid, p_tarih date)
returns numeric
language sql stable
set search_path = public
as $$
  select coalesce(
    public.yemek_maliyeti(m.corba) + public.yemek_maliyeti(m.ana_yemek)
    + public.yemek_maliyeti(m.yardimci) + public.yemek_maliyeti(m.ek), 0)
  from public.menu_gunleri m
  where m.liste_id = p_liste_id and m.tarih = p_tarih;
$$;

-- ---------------------------------------------------------------------------
-- Kâr / zarar
-- ---------------------------------------------------------------------------
create or replace function public.kar_zarar(p_bas date, p_bit date)
returns table (
  hizmet_noktasi text,
  gun_sayisi     integer,
  toplam_kisi    integer,
  ciro           numeric,
  maliyet        numeric,
  kar            numeric,
  kisi_basi_kar  numeric
)
language sql stable
set search_path = public
as $$
  with gunluk as (
    select
      h.ad as nokta,
      g.tarih,
      g.kisi_sayisi,
      -- O tarihte geçerli satış fiyatı
      coalesce((
        select f.kisi_basi_fiyat from public.hizmet_fiyatlari f
        where f.hizmet_noktasi_id = h.id and f.gecerli_baslangic <= g.tarih
        order by f.gecerli_baslangic desc limit 1
      ), 0) as fiyat,
      coalesce(public.gun_maliyeti(h.liste_id, g.tarih), 0) as birim_maliyet
    from public.gunluk_hizmet g
    join public.hizmet_noktalari h on h.id = g.hizmet_noktasi_id
    where g.tarih between p_bas and p_bit
  )
  select
    nokta,
    count(*)::int,
    sum(kisi_sayisi)::int,
    round(sum(kisi_sayisi * fiyat), 2),
    round(sum(kisi_sayisi * birim_maliyet), 2),
    round(sum(kisi_sayisi * (fiyat - birim_maliyet)), 2),
    case when sum(kisi_sayisi) > 0
         then round(sum(kisi_sayisi * (fiyat - birim_maliyet)) / sum(kisi_sayisi), 2)
         else 0 end
  from gunluk
  group by nokta
  order by nokta;
$$;

revoke execute on function public.yemek_maliyeti(text) from public, anon;
revoke execute on function public.gun_maliyeti(uuid, date) from public, anon;
revoke execute on function public.kar_zarar(date, date) from public, anon;
grant execute on function public.yemek_maliyeti(text) to authenticated;
grant execute on function public.gun_maliyeti(uuid, date) to authenticated;
grant execute on function public.kar_zarar(date, date) to authenticated;

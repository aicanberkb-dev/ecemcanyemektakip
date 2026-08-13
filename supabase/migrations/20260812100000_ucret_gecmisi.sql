-- 20260812100000_ucret_gecmisi.sql
--
-- Tarihli ücret tarifesi.
--
-- Ücretler yıl içinde değişiyor. Tek bir güncel fiyat tutulunca geçmişe dönük
-- her hesap yanlış oluyordu: toplu giriş geçmiş bir güne kayıt açtığında ya da
-- abone tipi değişince öğünler bugünün fiyatından hesaplanıyordu.
--
-- Artık fiyatlar başlangıç tarihiyle saklanır; bir öğün HANGİ GÜNE aitse o gün
-- geçerli olan tarifeden fiyatlanır. app_settings'teki alanlar güncel tarife
-- olarak kalır (ekranlarda "şu an geçerli" değeri göstermek için).

create table if not exists public.ucret_gecmisi (
  id                  uuid primary key default gen_random_uuid(),
  okul_id             uuid not null references public.okullar(id) on delete cascade,
  gecerli_baslangic   date not null,
  taban_gunluk_ucret  numeric(12,2) not null check (taban_gunluk_ucret >= 0),
  ucretli_ogun_ucreti numeric(12,2) not null check (ucretli_ogun_ucreti >= 0),
  misafir_ogun_ucreti numeric(12,2) not null check (misafir_ogun_ucreti >= 0),
  aciklama            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (okul_id, gecerli_baslangic)
);

create index if not exists ucret_gecmisi_okul_tarih_idx
  on public.ucret_gecmisi (okul_id, gecerli_baslangic desc);

drop trigger if exists set_updated_at on public.ucret_gecmisi;
create trigger set_updated_at before update on public.ucret_gecmisi
  for each row execute function public.set_updated_at();

alter table public.ucret_gecmisi enable row level security;

drop policy if exists ucret_gecmisi_secme on public.ucret_gecmisi;
create policy ucret_gecmisi_secme on public.ucret_gecmisi
  for select to authenticated using (true);

drop policy if exists ucret_gecmisi_yazma on public.ucret_gecmisi;
create policy ucret_gecmisi_yazma on public.ucret_gecmisi
  for all to authenticated using (true) with check (true);

revoke all on public.ucret_gecmisi from public, anon;
grant select, insert, update, delete on public.ucret_gecmisi to authenticated;

-- Mevcut tarifeler çok eski bir başlangıçla taşınır: davranış değişmesin,
-- geçmiş kayıtlar bugünkü fiyattan hesaplanmaya devam etsin.
insert into public.ucret_gecmisi
  (okul_id, gecerli_baslangic, taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti, aciklama)
select a.okul_id, date '2000-01-01', a.taban_gunluk_ucret, a.ucretli_ogun_ucreti,
       a.misafir_ogun_ucreti, 'Baslangic tarifesi'
from public.app_settings a
on conflict (okul_id, gecerli_baslangic) do nothing;

-- ---------------------------------------------------------------------------
-- Bir tarihte geçerli tarife
-- ---------------------------------------------------------------------------
create or replace function public.ucretler(p_okul_id uuid, p_tarih date default current_date)
returns table (
  taban_gunluk_ucret  numeric,
  ucretli_ogun_ucreti numeric,
  misafir_ogun_ucreti numeric
)
language sql stable
set search_path = public
as $$
  -- O güne kadarki en son tarife; hiç yoksa app_settings'teki güncel değerler
  select g.taban_gunluk_ucret, g.ucretli_ogun_ucreti, g.misafir_ogun_ucreti
  from public.ucret_gecmisi g
  where g.okul_id = p_okul_id and g.gecerli_baslangic <= p_tarih
  order by g.gecerli_baslangic desc
  limit 1
$$;

comment on function public.ucretler(uuid, date) is
  'Verilen tarihte gecerli ucret tarifesi. Ogunler ait olduklari gunun tarifesinden fiyatlanir.';

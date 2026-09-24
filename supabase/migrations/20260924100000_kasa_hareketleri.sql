-- 20260924100000_kasa_hareketleri.sql
--
-- Kasaya elle para giris/cikisi ve gunluk nakit teslimi.
--
-- Yemekhane kasasina ogun disi para girip cikiyor (bozuk para takviyesi,
-- kasadan yapilan ufak odeme). Bunlar yemek yiyen sayisini etkilememeli,
-- bu yuzden serbest_ogunler'e yazilamaz; ayri bir tablo gerekiyor.
--
-- kasa_teslim: gun sonunda okuldaki nakit teslim alinince isaretlenir.
-- Okulda olunmayan gunlerde orada ne kadar nakit birikmis oldugu boylece
-- gorulur. Kredi karti teslim alinmaz, ertesi gun hesaba gecer.

create table if not exists public.kasa_hareketleri (
  id uuid primary key default gen_random_uuid(),
  okul_id uuid not null references public.okullar(id) on delete cascade,
  tarih date not null default current_date,
  yon text not null check (yon in ('giris', 'cikis')),
  tutar numeric(10,2) not null check (tutar > 0),
  aciklama text,
  islemi_yapan_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists kasa_hareketleri_okul_tarih_idx
  on public.kasa_hareketleri (okul_id, tarih);

comment on table public.kasa_hareketleri is
  'Ogun disi kasa giris/cikislari; yemek yiyen sayisina girmez.';

alter table public.kasa_hareketleri enable row level security;

drop policy if exists kasa_hareketleri_select on public.kasa_hareketleri;
create policy kasa_hareketleri_select on public.kasa_hareketleri
  for select using (okul_erisimi(okul_id));

drop policy if exists kasa_hareketleri_insert on public.kasa_hareketleri;
create policy kasa_hareketleri_insert on public.kasa_hareketleri
  for insert with check (islemi_yapan_user_id = auth.uid() and okul_erisimi(okul_id));

drop policy if exists kasa_hareketleri_update on public.kasa_hareketleri;
create policy kasa_hareketleri_update on public.kasa_hareketleri
  for update using (okul_erisimi(okul_id))
  with check (islemi_yapan_user_id = auth.uid() and okul_erisimi(okul_id));

drop policy if exists kasa_hareketleri_delete on public.kasa_hareketleri;
create policy kasa_hareketleri_delete on public.kasa_hareketleri
  for delete using (okul_erisimi(okul_id));

-- Gunun nakiti teslim alindi mi? Gun basina tek kayit.
create table if not exists public.kasa_teslim (
  id uuid primary key default gen_random_uuid(),
  okul_id uuid not null references public.okullar(id) on delete cascade,
  tarih date not null,
  tutar numeric(10,2) not null,
  aciklama text,
  teslim_alan_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (okul_id, tarih)
);

comment on table public.kasa_teslim is
  'Gun sonunda okuldan teslim alinan nakit; kredi karti teslim alinmaz.';

alter table public.kasa_teslim enable row level security;

drop policy if exists kasa_teslim_select on public.kasa_teslim;
create policy kasa_teslim_select on public.kasa_teslim
  for select using (okul_erisimi(okul_id));

drop policy if exists kasa_teslim_insert on public.kasa_teslim;
create policy kasa_teslim_insert on public.kasa_teslim
  for insert with check (teslim_alan_user_id = auth.uid() and okul_erisimi(okul_id));

drop policy if exists kasa_teslim_update on public.kasa_teslim;
create policy kasa_teslim_update on public.kasa_teslim
  for update using (okul_erisimi(okul_id))
  with check (teslim_alan_user_id = auth.uid() and okul_erisimi(okul_id));

drop policy if exists kasa_teslim_delete on public.kasa_teslim;
create policy kasa_teslim_delete on public.kasa_teslim
  for delete using (okul_erisimi(okul_id));

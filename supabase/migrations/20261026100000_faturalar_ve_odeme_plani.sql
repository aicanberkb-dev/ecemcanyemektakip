-- Elektrik / su / dogalgaz faturalari, odeme plani ve gunluk masraf bagi.
--
-- Abonelik bilgisi (sozlesme no, vade gunu) yer ve gider turu basina bir
-- kez giriliyor; tutar her ay degistigi icin donem donem yaziliyor.
--
-- Odendi isaretlenen her kalem gunluk masrafa da dusuyor; olusan masraf
-- satirinin id'si kalemde tutuluyor ki geri alinca ayni satir silinsin,
-- masraf defterinde yetim kayit kalmasin.

create table if not exists public.fatura_abonelikleri (
  id uuid primary key default gen_random_uuid(),
  yer text not null,
  gider_turu text not null check (gider_turu in ('elektrik', 'su', 'dogalgaz')),
  sozlesme_no text,
  vade_gunu smallint check (vade_gunu is null or vade_gunu between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (yer, gider_turu)
);

create table if not exists public.fatura_odemeleri (
  id uuid primary key default gen_random_uuid(),
  yer text not null,
  gider_turu text not null check (gider_turu in ('elektrik', 'su', 'dogalgaz')),
  -- Donem ayin birinci gunu olarak tutuluyor: ay/yil ikilisi yerine tek
  -- tarih, araliklarla karsilastirmak kolay olsun.
  donem date not null,
  tutar numeric(12, 2) not null default 0,
  odeme_tarihi date,
  odendi boolean not null default false,
  gider_id uuid references public.gunluk_gider (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (yer, gider_turu, donem)
);

-- Haftalik odeme takviminde elle eklenen kalemler
create table if not exists public.odeme_plani (
  id uuid primary key default gen_random_uuid(),
  vade_tarihi date not null,
  kime text not null,
  tutar numeric(12, 2) not null default 0,
  aciklama text,
  odendi boolean not null default false,
  odeme_tarihi date,
  gider_id uuid references public.gunluk_gider (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists odeme_plani_vade on public.odeme_plani (vade_tarihi);
create index if not exists fatura_odemeleri_donem on public.fatura_odemeleri (donem);

-- Maas odemesi de gunluk masrafa dussun
alter table public.maas_odemeleri
  add column if not exists gider_id uuid references public.gunluk_gider (id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['fatura_abonelikleri', 'fatura_odemeleri', 'odeme_plani'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_erisim on public.%I', t, t);
    execute format(
      'create policy %I_erisim on public.%I for all using (genel_erisim())
       with check (genel_erisim())', t, t);
  end loop;
end $$;

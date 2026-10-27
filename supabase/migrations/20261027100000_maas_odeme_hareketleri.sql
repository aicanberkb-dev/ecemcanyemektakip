-- Maaslarda kismi odeme.
--
-- Bir ayin maasi birkac parca halinde odenebiliyor: her parcanin kendi
-- tarihi, tutari ve gunluk masraf satiri var. Parcalar burada duruyor.
--
-- maas_odemeleri satiri kaldirilmadi; artik hareketlerin ozeti:
-- tutar = hareketlerin toplami, odeme_tarihi = son hareketin tarihi.
-- Boylece odeme takvimi, toplamlar ve ucret yayma mantigi degismeden
-- calismaya devam ediyor.

create table if not exists public.maas_odeme_hareketleri (
  id uuid primary key default gen_random_uuid(),
  personel_id uuid not null references public.personeller (id) on delete cascade,
  donem_yil integer not null,
  donem_ay integer not null check (donem_ay between 1 and 12),
  tarih date not null,
  tutar numeric(12, 2) not null check (tutar >= 0),
  aciklama text,
  gider_id uuid references public.gunluk_gider (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maas_hareket_donem
  on public.maas_odeme_hareketleri (personel_id, donem_yil, donem_ay);

drop trigger if exists maas_odeme_hareketleri_updated_at on public.maas_odeme_hareketleri;
create trigger maas_odeme_hareketleri_updated_at
  before update on public.maas_odeme_hareketleri
  for each row execute function public.set_updated_at();

alter table public.maas_odeme_hareketleri enable row level security;

drop policy if exists maas_odeme_hareketleri_erisim on public.maas_odeme_hareketleri;
create policy maas_odeme_hareketleri_erisim on public.maas_odeme_hareketleri
  for all using (genel_erisim()) with check (genel_erisim());

-- Var olan odemeler tek parca hareket olarak tasiniyor; masraf satirinin
-- sahipligi de harekete geciyor ki geri alinca dogru satir silinsin.
insert into public.maas_odeme_hareketleri
  (personel_id, donem_yil, donem_ay, tarih, tutar, gider_id)
select
  o.personel_id, o.donem_yil, o.donem_ay,
  coalesce(o.odeme_tarihi, make_date(o.donem_yil, o.donem_ay, 1)),
  o.tutar, o.gider_id
from public.maas_odemeleri o
where not exists (
  select 1 from public.maas_odeme_hareketleri h
  where h.personel_id = o.personel_id
    and h.donem_yil = o.donem_yil
    and h.donem_ay = o.donem_ay
);

update public.maas_odemeleri set gider_id = null where gider_id is not null;

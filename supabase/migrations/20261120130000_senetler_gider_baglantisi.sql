-- Ödenen senet günlük masraf defterine de yazılıyor; bağlantı burada.
-- Kiralar ve faturalardaki kurgunun aynısı: işaret kalkınca o satır da
-- siliniyor, iki kez işaretlenince ikinci satır birikmiyor.
alter table public.senetler
  add column if not exists gider_id uuid
    references public.gunluk_gider(id) on delete set null;

create index if not exists senetler_gider_id_idx on public.senetler (gider_id);

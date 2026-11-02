-- Ödenen kira taksitini günlük masraf defterindeki satırına bağlar.
--
-- Faturalarda olduğu gibi: "ödendi" işareti kalkınca o masraf satırı da
-- gitsin, iki kez işaretlenince defterde iki satır birikmesin.
alter table public.kiralar
  add column if not exists gider_id uuid
    references public.gunluk_gider(id) on delete set null;

create index if not exists kiralar_gider_id_idx on public.kiralar (gider_id);

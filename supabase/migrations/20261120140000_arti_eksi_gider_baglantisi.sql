-- Artı/Eksi defterindeki eksi satırları gerçek ödeme; günlük masrafa da
-- yazılıyorlar. Artı satırları hesaba giren para, masraf değil.
alter table public.arti_eksi
  add column if not exists gider_id uuid
    references public.gunluk_gider(id) on delete set null;

create index if not exists arti_eksi_gider_id_idx on public.arti_eksi (gider_id);

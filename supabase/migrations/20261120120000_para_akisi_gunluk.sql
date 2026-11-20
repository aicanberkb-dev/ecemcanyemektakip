-- Para akışı ekranı: gün gün giren, çıkan ve birikime konan.
--
-- Beş ayrı tabloyu gün bazında birleştiriyor; ekran bunun üzerinden
-- süzüyor ve toplamlarını alıyor. Kart tarafında hesaba yatan varsa o
-- sayılıyor: eline geçen para o, komisyon düşülmüş hâli.
create or replace function public.para_akisi_gunluk(bas date)
returns table (
  tarih date,
  nakit numeric,
  kart numeric,
  ek_gelir numeric,
  ogrenci numeric,
  kurum numeric,
  gider numeric,
  birikim_arti numeric,
  birikim_eksi numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with gunler as (
    select tarih from gunluk_ciro where tarih >= bas
    union select tarih from ciro_ek_gelir where tarih >= bas
    union select tarih from gunluk_gider where tarih >= bas
    union select tarih from arti_eksi where tarih >= bas
    union select tarih from ciro_ogrenci_havaleleri(bas)
    union select tarih from ciro_kurum_tahsilatlari(bas)
  )
  select
    g.tarih,
    coalesce((select sum(c.nakit) from gunluk_ciro c where c.tarih = g.tarih), 0),
    coalesce((select sum(case when c.kart_yatan is null then c.kart else c.kart_yatan end)
              from gunluk_ciro c where c.tarih = g.tarih), 0),
    coalesce((select sum(e.tutar) from ciro_ek_gelir e where e.tarih = g.tarih), 0),
    coalesce((select o.tutar from ciro_ogrenci_havaleleri(bas) o where o.tarih = g.tarih), 0),
    coalesce((select k.tutar from ciro_kurum_tahsilatlari(bas) k where k.tarih = g.tarih), 0),
    coalesce((select sum(d.tutar) from gunluk_gider d where d.tarih = g.tarih), 0),
    coalesce((select sum(a.tutar) from arti_eksi a where a.tarih = g.tarih and a.yon = 'arti'), 0),
    coalesce((select sum(a.tutar) from arti_eksi a where a.tarih = g.tarih and a.yon = 'eksi'), 0)
  from gunler g
  order by g.tarih desc
$$;

-- Hizmet yerinin çeşit sayısı, yediği menü listesinin satır sayısıdır (3 ya da 4).
-- 3 çeşit veren yerin menüsünde 4. kalem olmaz: kopyalama ve kayıt ne gönderirse
-- göndersin veritabanı yazmaz. Önce 4 çeşitlik listelerden kopyalanan menüler
-- 4. kalemi de getiriyor, afişte ve maliyette görünüyordu.

alter table public.menu_listeleri
  drop constraint if exists menu_listeleri_satir_sayisi_kontrol;
alter table public.menu_listeleri
  add constraint menu_listeleri_satir_sayisi_kontrol check (satir_sayisi in (3, 4));

create or replace function public.menu_cesit_siniri()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce((select l.satir_sayisi from public.menu_listeleri l where l.id = new.liste_id), 4) < 4 then
    new.ek := null;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_cesit_siniri on public.menu_gunleri;
create trigger menu_cesit_siniri
  before insert or update on public.menu_gunleri
  for each row execute function public.menu_cesit_siniri();

-- Liste 3 çeşide çekilince bugünden sonraki günlerin 4. kalemi temizlenir.
-- Geçmiş günler olduğu gibi kalır: o gün 4 çeşit çıktı, maliyeti de öyle.
create or replace function public.menu_listesi_cesit_degisti()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.satir_sayisi < 4 and coalesce(old.satir_sayisi, 4) >= 4 then
    update public.menu_gunleri
       set ek = null
     where liste_id = new.id and tarih >= current_date and ek is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_listesi_cesit_degisti on public.menu_listeleri;
create trigger menu_listesi_cesit_degisti
  after update of satir_sayisi on public.menu_listeleri
  for each row execute function public.menu_listesi_cesit_degisti();

-- Hâlihazırda 3 çeşit olan listelerde (TAŞIMALI) 4 çeşitlik listelerden
-- kopyalanırken gelmiş 4. kalemler: bugünden sonrası temizlenir.
update public.menu_gunleri m
   set ek = null
  from public.menu_listeleri l
 where l.id = m.liste_id
   and l.satir_sayisi < 4
   and m.tarih >= current_date
   and m.ek is not null;

-- Sezonun tarihleri değişince ders günü sayısı yeniden hesaplanmıyordu.
--
-- Tatil eklenip kaldırıldığında tazeleyen bir tetik vardı ama sezonun kendi
-- baslangic/bitis tarihleri değiştiğinde hiçbir şey çalışmıyordu. Ayarlardan
-- sezon başlangıcı bir hafta öne alınınca bölen eski değerde kalıyor ve
-- aylıkçı cirosu sessizce yanlış hesaplanıyor — hata hiçbir ekranda
-- görünmediği için ancak yıl sonunda fark edilirdi.
create or replace function public.sezon_ders_gunu_kendi()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.baslangic is null or new.bitis is null then
    new.ders_gunu_sayisi := 0;
    return new;
  end if;

  -- BEFORE tetiğinde satır henüz yazılmadığı için hesap NEW üzerinden yapılır;
  -- sezon_ders_gunu() tablodan okuyacağı için eski tarihi kullanırdı.
  select count(*)::int into new.ders_gunu_sayisi
  from generate_series(new.baslangic, new.bitis, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (
      select 1 from public.okulsuz_gunler o
      where o.tarih = d::date and o.hizmet_noktasi_id is null
    );

  return new;
end;
$function$;

drop trigger if exists sezon_ders_gunu on public.sezonlar;

create trigger sezon_ders_gunu
before insert or update of baslangic, bitis on public.sezonlar
for each row execute function public.sezon_ders_gunu_kendi();

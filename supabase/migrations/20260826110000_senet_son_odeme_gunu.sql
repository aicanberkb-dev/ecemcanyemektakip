-- 20260826110000_senet_son_odeme_gunu.sql
--
-- Senedin son ödeme günü: senet tarihinden 2 iş günü sonrası.
--
-- Hafta sonu iş günü sayılmaz, o yüzden düz "+2 gün" yanlış sonuç veriyor:
--   Pazartesi senet → Çarşamba
--   Cuma senet     → Salı (cumartesi-pazar atlanır)
--   Perşembe senet → Pazartesi
--
-- Senedin kendisi hafta sonuna denk gelirse pazartesi kesilmiş gibi işlem
-- görür; son ödeme günü çarşamba olur.
--
-- Sütun türetilmiş (generated): elle girilmez, vade değişince kendiliğinden
-- güncellenir. Kural tek yerde durduğu için ekranla veritabanı ayrışamaz.

create or replace function public.son_odeme_gunu(p_vade date)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  d date := p_vade;
  i int;
begin
  if p_vade is null then return null; end if;

  -- Hafta sonu senedi pazartesiye taşınır
  if extract(isodow from d) >= 6 then
    d := d + (8 - extract(isodow from d))::int;
  end if;

  -- İki iş günü ekle
  for i in 1..2 loop
    d := d + 1;
    while extract(isodow from d) >= 6 loop
      d := d + 1;
    end loop;
  end loop;

  return d;
end;
$$;

revoke execute on function public.son_odeme_gunu(date) from public, anon;
grant execute on function public.son_odeme_gunu(date) to authenticated;

alter table public.senetler
  add column if not exists son_odeme date
  generated always as (public.son_odeme_gunu(vade_tarihi)) stored;

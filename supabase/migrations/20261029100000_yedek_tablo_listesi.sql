-- Yedegin tablo listesi veritabanindan okunuyor.
--
-- Liste elle tutuldugunda yeni eklenen tablolar yedege girmiyordu; kiralar,
-- gunluk ciro, kasa, dekontlar gibi 19 tablo disarida kalmisti. Artik
-- route public semadaki butun tablolari bu fonksiyondan aliyor, yeni tablo
-- eklendiginde kendiliginden yedege giriyor.

create or replace function public.tablo_listesi()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by 1;
$$;

revoke execute on function public.tablo_listesi() from public;
grant execute on function public.tablo_listesi() to authenticated;

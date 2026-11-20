-- Günlük ciro ekranı öğrenci ve kurum tahsilatlarını da gösteriyor.
-- İkisi de başka tablolarda duruyor; gün bazında toplamları buradan okunuyor.

-- Öğrenci parası: yalnız havale, yalnız GÖKSU.
-- Nakit ve kredi kartıyla ödeyenler zaten kasaya ve posa giriyor; buraya
-- alınsalar aynı para iki kez sayılırdı.
create or replace function public.ciro_ogrenci_havaleleri(bas date)
returns table (tarih date, tutar numeric, adet bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.tarih, sum(t.tutar)::numeric, count(*)::bigint
  from transactions t
  join students s on s.id = t.student_id
  join okullar o on o.id = s.okul_id
  where t.tip = 'tahsilat'
    and t.odeme_yontemi = 'havale'
    and o.ad = 'GÖKSU'
    and t.tarih >= bas
  group by t.tarih
$$;

-- Kurum ödemeleri: Alacaklar sayfasında girilen fatura tahsilatları.
-- Bir yere bağlı değil, o günün toplamı.
create or replace function public.ciro_kurum_tahsilatlari(bas date)
returns table (tarih date, tutar numeric, adet bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select ft.tarih, sum(ft.tutar)::numeric, count(*)::bigint
  from fatura_tahsilatlari ft
  where ft.tarih >= bas
  group by ft.tarih
$$;

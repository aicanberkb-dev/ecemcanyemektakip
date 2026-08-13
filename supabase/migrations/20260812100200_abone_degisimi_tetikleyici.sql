-- 20260812100200_abone_degisimi_tetikleyici.sql
--
-- Abone tipi ya da iskonto değişince geçmiş öğünler yeniden fiyatlanır.
--
-- Bu iş önce uygulama kodunda, öğrenci düzenleme ekranında yapılıyordu.
-- Tek bir kod yoluna bağlı olduğu için başka bir yoldan (SQL, içe aktarım,
-- ileride yazılacak bir ekran) yapılan değişiklikte bakiye sessizce yanlış
-- kalıyordu — canlıda bir öğrencide tam olarak bu yaşandı. Kural artık
-- veritabanında: nereden değişirse değişsin çalışır.

create or replace function public.ogun_tutarlarini_yenile(p_student_id uuid)
returns table (guncellenen integer, yeni_kalan numeric)
language plpgsql
set search_path = public
as $$
declare
  v_sayi int;
begin
  -- Her öğün kendi gününün tarifesinden fiyatlanır. Hedef değerler önce
  -- CTE'de hesaplanıyor: UPDATE hedefine lateral join yapılamıyor.
  with hedef as (
    select
      t.id,
      s.abone_tipi,
      case when s.abone_tipi = 'aylik' then 0
           else public.efektif_gunluk_ucret(u.taban_gunluk_ucret,
                                            s.iskonto_orani, s.iskonto_tutar)
      end as yeni_tutar
    from public.transactions t
    join public.students s on s.id = t.student_id
    cross join lateral public.ucretler(s.okul_id, t.tarih) u
    where t.student_id = p_student_id
      and t.ogun_abone_tipi is not null
  )
  update public.transactions t
     set tutar           = h.yeni_tutar,
         ogun_abone_tipi = h.abone_tipi,
         aciklama        = case when h.abone_tipi = 'aylik'
                                then 'Aylikci devam kaydi (tip degisimi)'
                                else 'Yemek (tip degisimi)' end
    from hedef h
   where t.id = h.id
     and (t.ogun_abone_tipi <> h.abone_tipi or t.tutar <> h.yeni_tutar);

  get diagnostics v_sayi = row_count;

  guncellenen := v_sayi;
  select b.kalan into yeni_kalan from public.student_balances b where b.student_id = p_student_id;
  return next;
end $$;

revoke execute on function public.ogun_tutarlarini_yenile(uuid) from public, anon;
grant execute on function public.ogun_tutarlarini_yenile(uuid) to authenticated;

create or replace function public.ogrenci_ogun_yenileme_tetikleyici()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.abone_tipi is distinct from old.abone_tipi
     or new.iskonto_orani is distinct from old.iskonto_orani
     or new.iskonto_tutar is distinct from old.iskonto_tutar then
    perform public.ogun_tutarlarini_yenile(new.id);
  end if;
  return new;
end $$;

-- SECURITY DEFINER fonksiyon REST üzerinden çağrılamamalı
revoke execute on function public.ogrenci_ogun_yenileme_tetikleyici()
  from public, anon, authenticated;

drop trigger if exists ogun_tutarlarini_yenile_trg on public.students;
create trigger ogun_tutarlarini_yenile_trg
  after update of abone_tipi, iskonto_orani, iskonto_tutar on public.students
  for each row execute function public.ogrenci_ogun_yenileme_tetikleyici();

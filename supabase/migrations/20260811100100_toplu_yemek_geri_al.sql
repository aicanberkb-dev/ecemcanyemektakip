-- 20260811100100_toplu_yemek_geri_al.sql
--
-- Toplu yemek girişinde hata yapılırsa aynı ekrandan geri alınabilsin.
--
-- Kaydı olmayan öğrenci hata sayılmaz, atlanır: kullanıcı karışık bir seçimi
-- tek hamlede temizleyebilmeli, tek bir yanlış satır işlemi durdurmamalı.

create or replace function public.toplu_yemek_geri_al(
  p_ogrenciler uuid[],
  p_tarih      date default current_date
) returns table (silinen integer, atlanan integer)
language plpgsql
set search_path = public
as $$
declare
  v_silinen int;
  v_istenen int := coalesce(array_length(p_ogrenciler, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadi.' using errcode = '28000';
  end if;

  delete from public.transactions t
  using public.students s
  where t.student_id = s.id
    and s.id = any(p_ogrenciler)
    and t.tarih = p_tarih
    and t.ogun_abone_tipi is not null;

  get diagnostics v_silinen = row_count;

  silinen := v_silinen;
  atlanan := greatest(0, v_istenen - v_silinen);
  return next;
end $$;

revoke execute on function public.toplu_yemek_geri_al(uuid[], date) from public, anon;
grant execute on function public.toplu_yemek_geri_al(uuid[], date) to authenticated;

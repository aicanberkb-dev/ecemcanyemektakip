-- 20260901100300_profil_okul_ve_yetki_fonksiyonlari.sql
--
-- Rol/okul yetkisinin temel taşları. Kuralların (RLS) kendisi henüz
-- uygulanmadı — bu dosya yalnızca alanı ve yardımcı fonksiyonları açıyor.
--
-- Admin: okul_id boş, bütün okullara erişir.
-- Personel: okul_id dolu, yalnızca kendi okuluna erişir.

alter table public.profiles
  add column if not exists okul_id uuid references public.okullar(id) on delete set null;

comment on column public.profiles.okul_id is
  'Personelin bağlı olduğu okul. Adminlerde boş: tüm okullara erişir.';

-- SECURITY DEFINER şart: yoksa profiles üzerindeki kural kendi kendini
-- çağırıp sonsuz döngüye girer.
create or replace function public.admin_mi()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin');
$$;

create or replace function public.yetkili_okul()
returns uuid language sql stable security definer set search_path = public as $$
  select p.okul_id from public.profiles p where p.id = auth.uid();
$$;

/** Bu okula erişim var mı? Admin her okula, personel yalnızca kendi okuluna. */
create or replace function public.okul_erisimi(p_okul_id uuid)
returns boolean language sql stable set search_path = public as $$
  select public.admin_mi() or (p_okul_id is not null and p_okul_id = public.yetkili_okul());
$$;

revoke execute on function public.admin_mi() from public, anon;
revoke execute on function public.yetkili_okul() from public, anon;
revoke execute on function public.okul_erisimi(uuid) from public, anon;
grant execute on function public.admin_mi() to authenticated;
grant execute on function public.yetkili_okul() to authenticated;
grant execute on function public.okul_erisimi(uuid) to authenticated;

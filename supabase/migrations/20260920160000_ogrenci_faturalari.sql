-- 20260920160000_ogrenci_faturalari.sql
--
-- "Bu öğrenciye bu dönem için fatura kesildi" kaydı.
--
-- Tek bir onay kutusu (students.fatura_kesildi gibi) yetmezdi: fatura her
-- dönem yeniden kesiliyor, kutu bir sonraki dönemde elle sıfırlanmak zorunda
-- kalırdı. Kayıt dönemle birlikte tutulunca aynı dönemin ikinci kez
-- kesilmesi engellenir, geçmiş dönemler de görünür kalır.

create table if not exists public.ogrenci_faturalari (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  donem_bas      date not null,
  donem_bit      date not null,
  -- Kesildiği anda o dönemde tahsil edilmiş tutar; sonradan gelen tahsilat
  -- faturayı değiştirmesin diye kopyalanır
  tutar          numeric(14,2) not null default 0,
  kesildi_tarih  date not null default current_date,
  aciklama       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, donem_bas, donem_bit)
);

create index if not exists ogrenci_faturalari_ogrenci_idx
  on public.ogrenci_faturalari (student_id);

drop trigger if exists set_updated_at on public.ogrenci_faturalari;
create trigger set_updated_at before update on public.ogrenci_faturalari
  for each row execute function public.set_updated_at();

alter table public.ogrenci_faturalari enable row level security;
drop policy if exists ogrenci_faturalari_secme on public.ogrenci_faturalari;
create policy ogrenci_faturalari_secme on public.ogrenci_faturalari for select to authenticated
  using (public.ogrenci_erisimi(student_id));
drop policy if exists ogrenci_faturalari_yazma on public.ogrenci_faturalari;
create policy ogrenci_faturalari_yazma on public.ogrenci_faturalari for all to authenticated
  using (public.ogrenci_erisimi(student_id)) with check (public.ogrenci_erisimi(student_id));
revoke all on public.ogrenci_faturalari from public, anon;
grant select, insert, update, delete on public.ogrenci_faturalari to authenticated;

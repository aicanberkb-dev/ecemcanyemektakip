-- 20260827120000_fatura_sablon_gizleme.sql
--
-- Şablondan o ay için çıkarılan cariler.
--
-- Şablon her ay tüm carileri açıyor; yazın okullar kapalı olduğu için o
-- satırlar boş boş yer kaplıyor. Cariyi tamamen pasife almak çözüm değil:
-- eylülde geri gelmesi gerekiyor. Bu tablo "bu cari bu ay listede olmasın"
-- der, yalnızca o dönemi etkiler ve tek tıkla geri alınır.

create table if not exists public.fatura_gizli (
  cari_id    uuid not null references public.cariler(id) on delete cascade,
  donem_yil  int  not null check (donem_yil between 2000 and 2100),
  donem_ay   int  not null check (donem_ay between 1 and 12),
  olusturma  timestamptz not null default now(),
  primary key (cari_id, donem_yil, donem_ay)
);

alter table public.fatura_gizli enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'fatura_gizli' and policyname = 'fatura_gizli_hepsi'
  ) then
    create policy fatura_gizli_hepsi on public.fatura_gizli
      to authenticated using (true) with check (true);
  end if;
end $$;

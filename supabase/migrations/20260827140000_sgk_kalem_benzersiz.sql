-- 20260827140000_sgk_kalem_benzersiz.sql
--
-- SGK kalemleri her ay şablonla açılıyor (SGK ELMALI, SGK GÖKSU, SGK AKBABA,
-- SGK KONAK); aynı ay aynı kalem iki kez yazılmasın diye benzersiz indeks.
--
-- Yer bazlı giderler (hizmet_noktasi_id dolu) maliyet ekranından girilir ve
-- ayrı bir akıştır; kısmi indeks yalnızca şablon satırlarını kapsadığı için
-- ikisi çakışmaz.
create unique index if not exists donemsel_giderler_tur_donem_benzersiz
  on public.donemsel_giderler (tur, donem_yil, donem_ay)
  where hizmet_noktasi_id is null;

-- SGK kaleminin o ay listede görünmemesi.
-- Kalemler sabit bir şablon; bir yerin o ay SGK'sı yoksa satır boş boş yer
-- kaplamasın. Yalnızca o dönemi etkiler, sonraki ay yine listede.
create table if not exists public.sgk_gizli (
  tur        text not null,
  donem_yil  int  not null check (donem_yil between 2000 and 2100),
  donem_ay   int  not null check (donem_ay between 1 and 12),
  olusturma  timestamptz not null default now(),
  primary key (tur, donem_yil, donem_ay)
);

alter table public.sgk_gizli enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'sgk_gizli' and policyname = 'sgk_gizli_hepsi'
  ) then
    create policy sgk_gizli_hepsi on public.sgk_gizli
      to authenticated using (true) with check (true);
  end if;
end $$;

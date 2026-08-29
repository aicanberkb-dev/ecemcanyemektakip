-- 20260827130000_personel_ay_gizleme.sql
--
-- Bir personelin o ay maaş listesinde görünmemesi.
--
-- Yazın personel çıkarılıyor, eylülde geri alınıyor. Personeli tamamen pasife
-- almak bunu karşılamıyor: geri döndüğünde elle aktifleştirmek ve hangi aylar
-- çalışmadığını hatırlamak gerekiyor. Bu tablo yalnızca o dönemi etkiler;
-- personel kaydı, ücret geçmişi ve geçmiş ödemeleri olduğu gibi kalır.
--
-- Genel gider hesabı da bunu dikkate alır: çalışmadığı ay o personelin maaşı
-- yerin aylık giderine girmez, dolayısıyla günlük gider payı da şişmez.

create table if not exists public.personel_gizli (
  personel_id uuid not null references public.personeller(id) on delete cascade,
  donem_yil   int  not null check (donem_yil between 2000 and 2100),
  donem_ay    int  not null check (donem_ay between 1 and 12),
  olusturma   timestamptz not null default now(),
  primary key (personel_id, donem_yil, donem_ay)
);

alter table public.personel_gizli enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'personel_gizli' and policyname = 'personel_gizli_hepsi'
  ) then
    create policy personel_gizli_hepsi on public.personel_gizli
      to authenticated using (true) with check (true);
  end if;
end $$;

-- Gizli personelin maaşı o ayın genel giderine girmesin
create or replace function public.aylik_gider_ozeti(p_nokta_id uuid, p_yil int, p_ay int)
returns table (
  maas          numeric,
  sgk           numeric,
  kira          numeric,
  mazot         numeric,
  diger         numeric,
  toplam        numeric,
  hizmet_gunu   integer,
  gunluk_gider  numeric
)
language sql stable
set search_path = public
as $$
  with sinir as (
    select make_date(p_yil, p_ay, 1) as bas,
           (make_date(p_yil, p_ay, 1) + interval '1 month - 1 day')::date as bit
  ),
  personel_maas as (
    select coalesce(sum(
      coalesce(
        (select o.tutar from public.maas_odemeleri o
          where o.personel_id = p.id and o.donem_yil = p_yil and o.donem_ay = p_ay),
        (select u.tutar from public.personel_ucretleri u
          where u.personel_id = p.id and u.gecerli_baslangic <= (select bit from sinir)
          order by u.gecerli_baslangic desc limit 1),
        0)
    ), 0) as tutar
    from public.personeller p
    where p.aktif and p.hizmet_noktasi_id = p_nokta_id
      and not exists (
        select 1 from public.personel_gizli g
        where g.personel_id = p.id and g.donem_yil = p_yil and g.donem_ay = p_ay
      )
  ),
  elle as (
    select
      coalesce(sum(tutar) filter (where kategori = 'maas'), 0)  as maas,
      coalesce(sum(tutar) filter (where kategori = 'sgk'), 0)   as sgk,
      coalesce(sum(tutar) filter (where kategori = 'kira'), 0)  as kira,
      coalesce(sum(tutar) filter (where kategori = 'mazot'), 0) as mazot,
      coalesce(sum(tutar) filter (where kategori = 'diger'), 0) as diger
    from public.donemsel_giderler
    where donem_yil = p_yil and donem_ay = p_ay
      and hizmet_noktasi_id = p_nokta_id
  ),
  gun as (
    select count(*)::int as adet
    from public.nokta_hizmet_gunleri(
      p_nokta_id, (select bas from sinir), (select bit from sinir))
  )
  select
    pm.tutar + e.maas, e.sgk, e.kira, e.mazot, e.diger,
    pm.tutar + e.maas + e.sgk + e.kira + e.mazot + e.diger,
    g.adet,
    case when g.adet > 0
      then round((pm.tutar + e.maas + e.sgk + e.kira + e.mazot + e.diger) / g.adet, 2)
      else 0 end
  from personel_maas pm, elle e, gun g;
$$;

revoke execute on function public.aylik_gider_ozeti(uuid, int, int) from public, anon;
grant execute on function public.aylik_gider_ozeti(uuid, int, int) to authenticated;

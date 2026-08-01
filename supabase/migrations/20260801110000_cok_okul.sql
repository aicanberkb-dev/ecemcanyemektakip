-- 20260801110000_cok_okul.sql — Çok okullu yapı
--
-- Tek kurulumda birden fazla okul yönetilir. Okulların öğrencileri, ücretleri,
-- işlemleri ve raporları tamamen ayrıdır. Ayrım SQL katmanında uygulanır;
-- arayüzün doğru filtrelemesine güvenilmez.

create table if not exists public.okullar (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null unique,
  sira        int  not null default 0,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.okullar;
create trigger set_updated_at before update on public.okullar
  for each row execute function public.set_updated_at();

insert into public.okullar (ad, sira)
values ('GÖKSU', 1), ('AHMET MİTHAT', 2)
on conflict (ad) do nothing;

alter table public.students        add column if not exists okul_id uuid references public.okullar(id);
alter table public.app_settings    add column if not exists okul_id uuid references public.okullar(id);
alter table public.serbest_ogunler add column if not exists okul_id uuid references public.okullar(id);
alter table public.taksit_plani    add column if not exists okul_id uuid references public.okullar(id);
alter table public.audit_log       add column if not exists okul_id uuid references public.okullar(id);

-- Migration öncesi veri ilk okula taşınır
update public.students        set okul_id = (select id from public.okullar order by sira limit 1) where okul_id is null;
update public.app_settings    set okul_id = (select id from public.okullar order by sira limit 1) where okul_id is null;
update public.serbest_ogunler set okul_id = (select id from public.okullar order by sira limit 1) where okul_id is null;
update public.taksit_plani    set okul_id = (select id from public.okullar order by sira limit 1) where okul_id is null;

-- Tek satır kısıtı kaldırılmadan ikinci okulun ayar satırı açılamaz
drop index if exists public.app_settings_tek_satir;

insert into public.app_settings (okul_id, taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti)
select o.id, 0, 0, 0
from public.okullar o
where not exists (select 1 from public.app_settings a where a.okul_id = o.id);

alter table public.students        alter column okul_id set not null;
alter table public.app_settings    alter column okul_id set not null;
alter table public.serbest_ogunler alter column okul_id set not null;
alter table public.taksit_plani    alter column okul_id set not null;

-- Benzersizlik okul bazına iner: aynı öğrenci numarası iki okulda bulunabilir
alter table public.students drop constraint if exists students_ogrenci_no_key;
create unique index if not exists students_okul_ogrenci_no_uniq
  on public.students (okul_id, ogrenci_no);

drop index if exists public.students_kimlik_no_uniq;
create unique index if not exists students_okul_kimlik_no_uniq
  on public.students (okul_id, kimlik_no) where kimlik_no is not null and kimlik_no <> '';

create unique index if not exists app_settings_okul_uniq on public.app_settings (okul_id);

alter table public.taksit_plani drop constraint if exists taksit_plani_yil_ad_key;
create unique index if not exists taksit_plani_okul_yil_ad_uniq
  on public.taksit_plani (okul_id, yil, ad);

create index if not exists students_okul_idx        on public.students (okul_id, aktif);
create index if not exists serbest_ogunler_okul_idx on public.serbest_ogunler (okul_id, tarih desc);
create index if not exists taksit_plani_okul_idx    on public.taksit_plani (okul_id, yil);
create index if not exists audit_log_okul_idx       on public.audit_log (okul_id, tarih desc);

alter table public.okullar enable row level security;

revoke all on public.okullar from anon;
grant select, insert, update on public.okullar to authenticated;

drop policy if exists okullar_select on public.okullar;
create policy okullar_select on public.okullar
  for select to authenticated using (true);

drop policy if exists okullar_insert on public.okullar;
create policy okullar_insert on public.okullar
  for insert to authenticated with check (true);

drop policy if exists okullar_update on public.okullar;
create policy okullar_update on public.okullar
  for update to authenticated using (true) with check (true);

drop trigger if exists audit_yaz on public.okullar;
create trigger audit_yaz after update or delete on public.okullar
  for each row execute function public.audit_yaz();

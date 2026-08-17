-- 20260817110000_cikan_porsiyon_ve_mutfaklar.sql
--
-- Maliyet artık yiyen kişiden değil, mutfaktan çıkan porsiyondan hesaplanıyor.
--
-- Sipariş üzerine iş yapmıyoruz: okula kaç kişinin geleceği belirsiz, yemek
-- tahminî bir sayıyla gönderiliyor. 100 kişilik gönderip 50 kişi yediğinde
-- para 100 kişilik harcanmış oluyor. Maliyetin doğru tabanı çıkan porsiyon;
-- yiyen kişi ciroyu belirler. Aradaki fark fire ve asıl izlenmesi gereken şey o.
--
-- Her hizmet noktasının kendi menüsü olduğu ve küvetler yere göre ayrıldığı
-- için maliyet dağıtımına gerek yok: çıkan porsiyon doğrudan yer bazında
-- tutulur. Mutfak yalnızca gruplama — "bu mutfaktan bugün kaç kişilik çıktı".

create table if not exists public.mutfaklar (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null unique,
  okul_id    uuid references public.okullar(id) on delete set null,
  sira       int not null default 0,
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.mutfaklar;
create trigger set_updated_at before update on public.mutfaklar
  for each row execute function public.set_updated_at();

alter table public.mutfaklar enable row level security;
drop policy if exists mutfaklar_secme on public.mutfaklar;
create policy mutfaklar_secme on public.mutfaklar for select to authenticated using (true);
drop policy if exists mutfaklar_yazma on public.mutfaklar;
create policy mutfaklar_yazma on public.mutfaklar for all to authenticated using (true) with check (true);
revoke all on public.mutfaklar from public, anon;
grant select, insert, update, delete on public.mutfaklar to authenticated;

insert into public.mutfaklar (ad, okul_id, sira)
select o.ad || ' MUTFAĞI', o.id, case when o.ad = 'GÖKSU' then 1 else 2 end
from public.okullar o
on conflict (ad) do nothing;

-- ---------------------------------------------------------------------------
-- Hizmet noktaları: hangi mutfaktan besleniyor, normalde kaç kişilik çıkıyor
-- ---------------------------------------------------------------------------
alter table public.hizmet_noktalari
  add column if not exists mutfak_id uuid references public.mutfaklar(id) on delete set null;

alter table public.hizmet_noktalari
  add column if not exists varsayilan_cikan_porsiyon int not null default 0
  check (varsayilan_cikan_porsiyon >= 0);

-- Varsayılan atama: kendi okulunun mutfağı, dış hizmetler ana mutfak.
-- Kullanıcı Hizmet Yerleri ekranından düzeltir.
update public.hizmet_noktalari h set mutfak_id = m.id
from public.mutfaklar m
where h.mutfak_id is null and h.okul_id is not null and m.okul_id = h.okul_id;

update public.hizmet_noktalari h set mutfak_id = (
  select m.id from public.mutfaklar m order by m.sira limit 1
)
where h.mutfak_id is null;

-- ---------------------------------------------------------------------------
-- Günlük kayıt: çıkan porsiyon eklendi, yiyen sayısı artık boş olabilir
--
-- Bir gün için yalnızca çıkan girilmiş olabilir (okullarda yiyen zaten gün
-- sonundan gelir). null = girilmedi, yerin varsayılanı geçerli; 0 = o gün
-- gerçekten yok.
-- ---------------------------------------------------------------------------
alter table public.gunluk_hizmet
  add column if not exists cikan_porsiyon int check (cikan_porsiyon >= 0);

alter table public.gunluk_hizmet alter column kisi_sayisi drop not null;
alter table public.gunluk_hizmet alter column kisi_sayisi drop default;

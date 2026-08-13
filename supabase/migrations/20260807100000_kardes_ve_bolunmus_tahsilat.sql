-- 20260807100000_kardes_ve_bolunmus_tahsilat.sql
--
-- 1) Kardeş bağlantısı
-- 2) Bir banka hareketinin birden çok öğrenciye bölünebilmesi
--
-- Gerekçe: veliler tek havaleyle iki çocuğun ücretini birden yatırıyor
-- ("DENİZ- NEHİR KÖK OKUL YEMEK ÜCRETİ"). Ekstre aktarımında bu tutarı
-- öğrenciler arasında elle paylaştırabilmek gerekiyor; paylaştırırken de
-- kardeşlerin kim olduğu ekranda görünmeli.

-- ---------------------------------------------------------------------------
-- Kardeşlik
-- ---------------------------------------------------------------------------
-- Kardeşler ortak bir grup kimliği paylaşır. Çift yönlü bağ tutmaya gerek
-- kalmaz ve üç ya da daha fazla kardeş de doğal olarak aynı gruba girer.
alter table public.students add column if not exists kardes_grup_id uuid;

create index if not exists students_kardes_grup_idx
  on public.students (kardes_grup_id) where kardes_grup_id is not null;

comment on column public.students.kardes_grup_id is
  'Ayni gruptaki ogrenciler kardestir. Tek basina kalan grup anlamsizdir; '
  'son kardes ayrilinca alan bosaltilir.';

-- Aynı okuldaki öğrenciler kardeş olabilir; farklı okuldan kardeş kurulamaz.
create or replace function public.kardes_bagla(
  p_student_id  uuid,
  p_kardes_id   uuid
) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_okul_a uuid;
  v_okul_b uuid;
  v_grup_a uuid;
  v_grup_b uuid;
  v_grup   uuid;
begin
  if p_student_id = p_kardes_id then
    raise exception 'Ogrenci kendisiyle kardes olamaz.';
  end if;

  select okul_id, kardes_grup_id into v_okul_a, v_grup_a
  from public.students where id = p_student_id;
  select okul_id, kardes_grup_id into v_okul_b, v_grup_b
  from public.students where id = p_kardes_id;

  if v_okul_a is null or v_okul_b is null then
    raise exception 'Ogrenci bulunamadi.';
  end if;
  if v_okul_a <> v_okul_b then
    raise exception 'Farkli okullardaki ogrenciler kardes olarak baglanamaz.';
  end if;

  -- İki taraftan biri zaten bir gruptaysa o grup korunur; ikisi de gruptaysa
  -- gruplar birleştirilir.
  v_grup := coalesce(v_grup_a, v_grup_b, gen_random_uuid());

  update public.students set kardes_grup_id = v_grup
  where id in (p_student_id, p_kardes_id)
     or (v_grup_a is not null and kardes_grup_id = v_grup_a)
     or (v_grup_b is not null and kardes_grup_id = v_grup_b);
end $$;

revoke execute on function public.kardes_bagla(uuid, uuid) from public, anon;
grant execute on function public.kardes_bagla(uuid, uuid) to authenticated;

-- Gruptan ayırma: tek kişi kalırsa onun da bağı temizlenir.
create or replace function public.kardes_ayir(p_student_id uuid)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_grup uuid;
  v_kalan int;
begin
  select kardes_grup_id into v_grup from public.students where id = p_student_id;
  if v_grup is null then return; end if;

  update public.students set kardes_grup_id = null where id = p_student_id;

  select count(*) into v_kalan from public.students where kardes_grup_id = v_grup;
  if v_kalan <= 1 then
    update public.students set kardes_grup_id = null where kardes_grup_id = v_grup;
  end if;
end $$;

revoke execute on function public.kardes_ayir(uuid) from public, anon;
grant execute on function public.kardes_ayir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bölünmüş tahsilat
-- ---------------------------------------------------------------------------
-- Tek fiş birden çok öğrenciye dağıtılabildiği için mükerrer kontrolü artık
-- öğrenciyi de içermeli. Eski kısıt 1.000 TL'yi 500+500 diye bölmeyi
-- engelliyordu: iki satırın fiş no, tarih ve tutarı aynı oluyordu.
drop index if exists public.transactions_banka_fis_uniq;

create unique index if not exists transactions_banka_fis_uniq
  on public.transactions (banka_fis_no, tarih, tutar, student_id)
  where banka_fis_no is not null;

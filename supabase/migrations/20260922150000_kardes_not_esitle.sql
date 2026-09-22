-- 20260922150000_kardes_not_esitle.sql
--
-- Kardeşlerde özel not ve fatura bilgisi ortak.
--
-- Veliyle yapılan anlaşma çocuğa değil aileye ait: "fatura kesilecek",
-- "ödeme pazartesi" gibi notlar bir kardeşe yazılıp öbürüne yazılmayınca
-- ikinci çocuğa bakan kişi bilgiden habersiz kalıyordu. Not, fatura işareti
-- ve fatura bilgisi artık kardeş grubunun tamamında aynı.

create or replace function public.kardes_notu_esitle()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.kardes_grup_id is null then
    return new;
  end if;

  -- Sonsuz döngü olmasın: yalnız değeri farklı olan kardeşler güncellenir,
  -- ikinci turda güncellenecek satır kalmaz ve zincir durur.
  update public.students k
     set ozel_not       = new.ozel_not,
         fatura_istiyor = new.fatura_istiyor,
         fatura_bilgisi = new.fatura_bilgisi
   where k.kardes_grup_id = new.kardes_grup_id
     and k.id <> new.id
     and (k.ozel_not is distinct from new.ozel_not
       or k.fatura_istiyor is distinct from new.fatura_istiyor
       or k.fatura_bilgisi is distinct from new.fatura_bilgisi);

  return new;
end $$;

drop trigger if exists kardes_notu_esitle_trg on public.students;
create trigger kardes_notu_esitle_trg
  after update of ozel_not, fatura_istiyor, fatura_bilgisi on public.students
  for each row execute function public.kardes_notu_esitle();

/**
 * Kardeş grubuna yeni katılan öğrenci: kendi notu boşsa gruptakini alır,
 * doluysa kendi notunu gruba yayar (son yazan kazanır).
 */
create or replace function public.kardes_grubuna_katilinca()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_kaynak public.students%rowtype;
begin
  if new.kardes_grup_id is null then
    return new;
  end if;

  if coalesce(btrim(new.ozel_not), '') = ''
     and not new.fatura_istiyor
     and coalesce(btrim(new.fatura_bilgisi), '') = '' then
    select * into v_kaynak
      from public.students k
     where k.kardes_grup_id = new.kardes_grup_id
       and k.id <> new.id
       and (coalesce(btrim(k.ozel_not), '') <> ''
         or k.fatura_istiyor
         or coalesce(btrim(k.fatura_bilgisi), '') <> '')
     limit 1;

    if found then
      update public.students
         set ozel_not = v_kaynak.ozel_not,
             fatura_istiyor = v_kaynak.fatura_istiyor,
             fatura_bilgisi = v_kaynak.fatura_bilgisi
       where id = new.id;
    end if;
  else
    update public.students k
       set ozel_not = new.ozel_not,
           fatura_istiyor = new.fatura_istiyor,
           fatura_bilgisi = new.fatura_bilgisi
     where k.kardes_grup_id = new.kardes_grup_id
       and k.id <> new.id
       and (k.ozel_not is distinct from new.ozel_not
         or k.fatura_istiyor is distinct from new.fatura_istiyor
         or k.fatura_bilgisi is distinct from new.fatura_bilgisi);
  end if;

  return new;
end $$;

drop trigger if exists kardes_grubuna_katilinca_trg on public.students;
create trigger kardes_grubuna_katilinca_trg
  after update of kardes_grup_id on public.students
  for each row when (new.kardes_grup_id is not null)
  execute function public.kardes_grubuna_katilinca();

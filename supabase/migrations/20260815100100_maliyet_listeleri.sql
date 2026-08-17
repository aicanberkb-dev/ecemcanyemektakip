-- 20260815100100_maliyet_listeleri.sql
--
-- Maliyet ekranlarının okuduğu listeler.
--
-- Yemek adları menülerin dört sütununa dağılmış durumda; reçetesi olup henüz
-- menüye girmemiş yemekler de var. Ekranın ikisini de görmesi gerekiyor:
-- reçetesi eksik yemek fark edilmezse o günün maliyeti sessizce düşük çıkar.

create or replace function public.yemek_maliyet_listesi()
returns table (
  yemek_adi      text,
  kullanim       integer,
  malzeme_sayisi integer,
  maliyet        numeric
)
language sql stable
set search_path = public
as $$
  with menudekiler as (
    select corba as ad from public.menu_gunleri where btrim(coalesce(corba, '')) <> ''
    union all
    select ana_yemek from public.menu_gunleri where btrim(coalesce(ana_yemek, '')) <> ''
    union all
    select yardimci from public.menu_gunleri where btrim(coalesce(yardimci, '')) <> ''
    union all
    select ek from public.menu_gunleri where btrim(coalesce(ek, '')) <> ''
  ),
  kullanim as (
    select ad, count(*)::int as adet from menudekiler group by ad
  ),
  tum as (
    select ad from kullanim
    union
    select distinct r.yemek_adi from public.yemek_receteleri r
  )
  select
    t.ad,
    coalesce(k.adet, 0),
    (select count(*)::int from public.yemek_receteleri r where r.yemek_adi = t.ad),
    public.yemek_maliyeti(t.ad)
  from tum t
  left join kullanim k on k.ad = t.ad
  order by coalesce(k.adet, 0) desc, t.ad;
$$;

revoke execute on function public.yemek_maliyet_listesi() from public, anon;
grant execute on function public.yemek_maliyet_listesi() to authenticated;

-- Kişi sayısı girilirken o günün menüsü ve maliyeti aynı satırda görünsün:
-- 300 kişilik bir gün yanlış girildiğinde tutar hemen sırıtsın diye.
create or replace function public.ay_menu_maliyeti(p_liste_id uuid, p_bas date, p_bit date)
returns table (tarih date, ozet text, maliyet numeric)
language sql stable
set search_path = public
as $$
  select
    m.tarih,
    array_to_string(
      array_remove(array[
        nullif(btrim(coalesce(m.corba, '')), ''),
        nullif(btrim(coalesce(m.ana_yemek, '')), ''),
        nullif(btrim(coalesce(m.yardimci, '')), ''),
        nullif(btrim(coalesce(m.ek, '')), '')
      ], null), ' · '),
    public.yemek_maliyeti(m.corba) + public.yemek_maliyeti(m.ana_yemek)
      + public.yemek_maliyeti(m.yardimci) + public.yemek_maliyeti(m.ek)
  from public.menu_gunleri m
  where m.liste_id = p_liste_id and m.tarih between p_bas and p_bit
  order by m.tarih;
$$;

revoke execute on function public.ay_menu_maliyeti(uuid, date, date) from public, anon;
grant execute on function public.ay_menu_maliyeti(uuid, date, date) to authenticated;

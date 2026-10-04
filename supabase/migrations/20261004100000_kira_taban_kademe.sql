-- 20261004100000_kira_taban_kademe.sql
--
-- Kira bedeli yil icinde degisebiliyor: "4. taksitten itibaren yeni kira".
--
-- Taban artik grup basina tek rakam degil, kademe: her satir "bu taksitten
-- itibaren taban su" demek. Bir taksitin tabani, sirasi o taksitten buyuk
-- olmayan son kademedir. Boylece eski kademe duruyor, yeni kademe sonrasini
-- degistiriyor -- odenmis taksitlerin dayandigi rakam bozulmuyor.
--
-- Var olan satirlar 1. taksitten baslayan kademe sayiliyor (default 1).

alter table public.kira_tabanlari
  add column if not exists sira smallint not null default 1;

alter table public.kira_tabanlari drop constraint if exists kira_tabanlari_pkey;
alter table public.kira_tabanlari add primary key (anahtar, sira);

alter table public.kira_tabanlari drop constraint if exists kira_tabanlari_sira_check;
alter table public.kira_tabanlari add constraint kira_tabanlari_sira_check
  check (sira between 1 and 8);

comment on table public.kira_tabanlari is
  'Odeme grubunun taban kira bedeli kademeleri; kalemler bundan hesaplanir.';
comment on column public.kira_tabanlari.sira is
  'Bu tabanin gecerli oldugu ilk taksit (1-8).';

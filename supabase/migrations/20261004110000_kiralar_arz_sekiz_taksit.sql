-- 20261004110000_kiralar_arz_sekiz_taksit.sql
--
-- Arz bedeli de sekiz taksit.
--
-- Once "uc aylik arz" ayri bir kalemdi: yilda uc odeme, her odeme birkac
-- taksitin arz payini kapatiyordu. Takip ederken karisiyor. Artik arz da
-- obur kalemler gibi sekiz taksit ve her taksitte ayni rakam (taban x %3);
-- ucu birden yatirilirsa uc satir tek tek odendi isaretleniyor.

alter table public.kiralar drop constraint if exists kiralar_sira_check;
alter table public.kiralar add constraint kiralar_sira_check
  check (sira between 1 and 8);

comment on column public.kiralar.sira is 'Taksit sirasi (1-8).';

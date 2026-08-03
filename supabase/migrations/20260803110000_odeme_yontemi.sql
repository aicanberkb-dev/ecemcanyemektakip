-- 20260803110000_odeme_yontemi.sql
-- Tahsilatlarda ödeme yöntemi: nakit / havale / kredi kartı

do $$ begin
  create type public.odeme_yontemi as enum ('nakit', 'havale', 'kredi_karti');
exception when duplicate_object then null; end $$;

alter table public.transactions
  add column if not exists odeme_yontemi public.odeme_yontemi;

-- Ödeme yöntemi tahsilatlarda ZORUNLU, harcamalarda boş olmalı.
-- Kural veritabanında: arayüz atlasa bile yöntemsiz tahsilat girilemez.
alter table public.transactions drop constraint if exists transactions_odeme_yontemi_ck;
alter table public.transactions add constraint transactions_odeme_yontemi_ck
  check (
    (tip = 'tahsilat' and odeme_yontemi is not null)
    or (tip <> 'tahsilat' and odeme_yontemi is null)
  );

create index if not exists transactions_odeme_yontemi_idx
  on public.transactions (odeme_yontemi) where odeme_yontemi is not null;

-- nakit_raporu: ödeme yöntemine göre kırılım.
-- "Kasaya giren nakit" yalnızca fiilen kasaya giren parayı sayar:
-- nakit tahsilat + kapıda ödenen ücretli öğünler. Havale ve kart hariç.
drop function if exists public.nakit_raporu(uuid, date, date);
create function public.nakit_raporu(
  p_okul_id uuid,
  p_bas     date,
  p_bit     date
) returns table (
  tarih           date,
  nakit_tutar     numeric,
  havale_tutar    numeric,
  kart_tutar      numeric,
  belirsiz_tutar  numeric,
  tahsilat_tutar  numeric,
  tahsilat_adet   int,
  ucretli_tutar   numeric,
  ucretli_adet    int,
  toplam          numeric,
  kasa_nakit      numeric
)
language sql stable security invoker
set search_path = public
as $$
  with gunler as (
    select g::date as tarih from generate_series(p_bas, p_bit, interval '1 day') g
  ),
  tahsilat as (
    select
      t.tarih,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'nakit'), 0)       as nakit,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'havale'), 0)      as havale,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi = 'kredi_karti'), 0) as kart,
      coalesce(sum(t.tutar) filter (where t.odeme_yontemi is null), 0)         as belirsiz,
      sum(t.tutar)  as tutar,
      count(*)::int as adet
    from public.transactions t
    join public.students s on s.id = t.student_id
    where t.tip = 'tahsilat' and t.tarih between p_bas and p_bit and s.okul_id = p_okul_id
    group by t.tarih
  ),
  ucretli as (
    select s.tarih, sum(s.tutar) as tutar, count(*)::int as adet
    from public.serbest_ogunler s
    where s.tip = 'ucretli' and s.tarih between p_bas and p_bit and s.okul_id = p_okul_id
    group by s.tarih
  )
  select
    gunler.tarih,
    coalesce(tahsilat.nakit, 0),
    coalesce(tahsilat.havale, 0),
    coalesce(tahsilat.kart, 0),
    coalesce(tahsilat.belirsiz, 0),
    coalesce(tahsilat.tutar, 0),
    coalesce(tahsilat.adet, 0),
    coalesce(ucretli.tutar, 0),
    coalesce(ucretli.adet, 0),
    coalesce(tahsilat.tutar, 0) + coalesce(ucretli.tutar, 0),
    coalesce(tahsilat.nakit, 0) + coalesce(tahsilat.belirsiz, 0) + coalesce(ucretli.tutar, 0)
  from gunler
  left join tahsilat on tahsilat.tarih = gunler.tarih
  left join ucretli  on ucretli.tarih  = gunler.tarih
  where coalesce(tahsilat.adet, 0) + coalesce(ucretli.adet, 0) > 0
  order by gunler.tarih desc;
$$;

revoke execute on function public.nakit_raporu(uuid, date, date) from public, anon;
grant execute on function public.nakit_raporu(uuid, date, date) to authenticated;

-- 0006_guvenlik_sikilastirma.sql — Supabase database linter bulgularının kapatılması

-- 1) Trigger fonksiyonları REST API üzerinden RPC olarak çağrılabilmemeli.
--    audit_yaz ve yeni_kullanici SECURITY DEFINER olduğu için bu kritik:
--    aksi halde /rest/v1/rpc/audit_yaz uç noktası dışarıya açık kalırdı.
revoke execute on function public.audit_yaz()      from public, anon, authenticated;
revoke execute on function public.yeni_kullanici() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- 2) efektif_gunluk_ucret için sabit search_path (fonksiyon hiçbir tabloya
--    dokunmuyor, bu yüzden boş search_path yeterli)
create or replace function public.efektif_gunluk_ucret(
  p_taban          numeric,
  p_iskonto_orani  numeric,
  p_iskonto_tutar  numeric
) returns numeric
language sql immutable
set search_path = ''
as $$
  select greatest(
    0,
    round(
      coalesce(p_taban, 0)
      - coalesce(p_iskonto_tutar, 0)
      - (coalesce(p_taban, 0) * coalesce(p_iskonto_orani, 0) / 100.0),
      2
    )
  );
$$;

-- 3) İş fonksiyonları yalnızca giriş yapmış kullanıcılar tarafından çağrılabilsin.
--    (Postgres varsayılanı EXECUTE'u PUBLIC'e verir; anon'dan geri alıyoruz.)
revoke execute on function
  public.efektif_gunluk_ucret(numeric, numeric, numeric),
  public.ogrenci_gunluk_ucret(uuid),
  public.yemek_kaydet(uuid, date),
  public.serbest_ogun_kaydet(public.serbest_ogun_tipi, date, text),
  public.pos_ara(text, date, int),
  public.taksit_durumu(int, date),
  public.devam_cizelgesi(int, int),
  public.gun_sonu(date),
  public.nakit_raporu(date, date),
  public.gelen_giden_raporu(date, date)
  from public, anon;

grant execute on function
  public.efektif_gunluk_ucret(numeric, numeric, numeric),
  public.ogrenci_gunluk_ucret(uuid),
  public.yemek_kaydet(uuid, date),
  public.serbest_ogun_kaydet(public.serbest_ogun_tipi, date, text),
  public.pos_ara(text, date, int),
  public.taksit_durumu(int, date),
  public.devam_cizelgesi(int, int),
  public.gun_sonu(date),
  public.nakit_raporu(date, date),
  public.gelen_giden_raporu(date, date)
  to authenticated;

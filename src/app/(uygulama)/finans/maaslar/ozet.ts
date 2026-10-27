import type { supabaseServer } from '@/lib/supabase/server'

type Istemci = Awaited<ReturnType<typeof supabaseServer>>

/**
 * Ayın özetini hareketlerden yeniden yazar.
 *
 * `maas_odemeleri` satırı artık ödemenin kendisi değil, o ayın
 * hareketlerinin toplamı: tutar = hareketlerin toplamı, ödeme tarihi = son
 * hareketin tarihi. Ödeme takvimi, toplamlar ve ücret yayma mantığı bu
 * satırı okuduğu için şekli korunuyor.
 *
 * Ayrı dosyada: hem maaş ödeme eylemleri hem finans eylemleri kullanıyor,
 * `'use server'` dosyasından paylaşılamıyor.
 */
export async function ozetiYenile(
  supabase: Istemci,
  personelId: string,
  yil: number,
  ay: number,
): Promise<string | null> {
  const { data } = await supabase
    .from('maas_odeme_hareketleri')
    .select('tarih, tutar')
    .eq('personel_id', personelId)
    .eq('donem_yil', yil)
    .eq('donem_ay', ay)

  const hareketler = (data ?? []) as { tarih: string; tutar: number | string }[]

  // Hiç hareket kalmadıysa ay ödenmemiş sayılır
  if (hareketler.length === 0) {
    const { error } = await supabase
      .from('maas_odemeleri')
      .delete()
      .eq('personel_id', personelId)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
    return error?.message ?? null
  }

  const toplam = hareketler.reduce((t, h) => t + Number(h.tutar), 0)
  const sonTarih = hareketler
    .map((h) => h.tarih)
    .sort()
    .at(-1)!

  const { error } = await supabase.from('maas_odemeleri').upsert(
    {
      personel_id: personelId,
      donem_yil: yil,
      donem_ay: ay,
      tutar: Math.round(toplam * 100) / 100,
      odeme_tarihi: sonTarih,
      gider_id: null,
    },
    { onConflict: 'personel_id,donem_yil,donem_ay' },
  )
  return error?.message ?? null
}

/** Ayın bütün ödemelerini ve bunların masraf satırlarını siler */
export async function ayinOdemeleriniSil(
  supabase: Istemci,
  personelId: string,
  yil: number,
  ay: number,
): Promise<string | null> {
  const { data } = await supabase
    .from('maas_odeme_hareketleri')
    .select('id, gider_id')
    .eq('personel_id', personelId)
    .eq('donem_yil', yil)
    .eq('donem_ay', ay)

  const hareketler = (data ?? []) as { id: string; gider_id: string | null }[]
  const giderler = hareketler.map((h) => h.gider_id).filter((g): g is string => !!g)
  if (giderler.length > 0) await supabase.from('gunluk_gider').delete().in('id', giderler)

  const { error } = await supabase
    .from('maas_odeme_hareketleri')
    .delete()
    .eq('personel_id', personelId)
    .eq('donem_yil', yil)
    .eq('donem_ay', ay)

  return error?.message ?? null
}

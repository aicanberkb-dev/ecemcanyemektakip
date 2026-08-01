import { cookies } from 'next/headers'

import { supabaseServer } from '@/lib/supabase/server'
import type { Okul } from '@/lib/types'

export const OKUL_CEREZI = 'aktif_okul'

/** Tüm okullar, sıra numarasına göre. */
export async function okullar(): Promise<Okul[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('okullar')
    .select('*')
    .eq('aktif', true)
    .order('sira')
    .order('ad')
  return (data ?? []) as Okul[]
}

/**
 * Seçili okul. Çerezdeki değer geçersizse (silinmiş okul, bozuk çerez)
 * sessizce ilk okula düşer — böylece uygulama hiçbir zaman okulsuz kalmaz.
 */
export async function aktifOkul(): Promise<Okul | null> {
  const liste = await okullar()
  if (liste.length === 0) return null

  const cerez = (await cookies()).get(OKUL_CEREZI)?.value
  return liste.find((o) => o.id === cerez) ?? liste[0]
}

/**
 * Sayfaların kullandığı kısa yol: seçili okulun id'si.
 * Okul tanımlı değilse hata verir — bu bir kurulum hatasıdır, sessizce
 * geçilirse tüm okulların verisi karışır.
 */
export async function aktifOkulId(): Promise<string> {
  const okul = await aktifOkul()
  if (!okul) throw new Error('Tanımlı okul yok. Ayarlar sayfasından okul ekleyin.')
  return okul.id
}

import { cookies } from 'next/headers'

import { GENEL, OKUL_CEREZI } from '@/lib/okul-sabitler'
import { supabaseServer } from '@/lib/supabase/server'
import type { Okul } from '@/lib/types'

export { GENEL, GENEL_YOLLAR, genelYolMu, OKUL_CEREZI } from '@/lib/okul-sabitler'

/** Üst barda okul yerine "Genel" mi seçili? */
export async function genelModu(): Promise<boolean> {
  return (await cookies()).get(OKUL_CEREZI)?.value === GENEL
}

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
 * Seçili okul. Genel modda okul yoktur, null döner. Çerezdeki değer
 * geçersizse (silinmiş okul, bozuk çerez) sessizce ilk okula düşer — böylece
 * uygulama hiçbir zaman yanlış okulun verisini göstermez.
 */
export async function aktifOkul(): Promise<Okul | null> {
  const cerez = (await cookies()).get(OKUL_CEREZI)?.value
  if (cerez === GENEL) return null

  const liste = await okullar()
  if (liste.length === 0) return null

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

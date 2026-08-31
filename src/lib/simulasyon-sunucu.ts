import { cookies } from 'next/headers'

import { gecerliTarihMi, gercekBugun, SIMULASYON_CEREZI } from '@/lib/simulasyon'

/**
 * Sunucu tarafında "bugün".
 *
 * Simülasyon çerezi varsa o tarih, yoksa gerçek bugün. Sunucu bileşenleri ve
 * server action'lar bunu kullanır; istemci tarafı `useBugun()` ile aynı
 * değeri okur (kök düzenden geçer).
 */
export async function bugunSunucu(): Promise<string> {
  const deger = (await cookies()).get(SIMULASYON_CEREZI)?.value
  return gecerliTarihMi(deger) ? deger : gercekBugun()
}

/** Simülasyon açık mı? Açıksa tarihi, değilse null. */
export async function simulasyonTarihi(): Promise<string | null> {
  const deger = (await cookies()).get(SIMULASYON_CEREZI)?.value
  return gecerliTarihMi(deger) ? deger : null
}

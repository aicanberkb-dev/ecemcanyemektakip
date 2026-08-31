'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { gecerliTarihMi, SIMULASYON_CEREZI } from '@/lib/simulasyon'

/**
 * Simülasyon tarihini açar ya da kapatır.
 *
 * Çerezde durur, yalnızca bu tarayıcıyı etkiler. Veri tanımlarına (sezon,
 * ders günü) dokunmaz; kapatmayı unutmak sezon hesabını bozmaz.
 */
export async function simulasyonAyarla(tarih: string | null) {
  const cerezler = await cookies()

  if (tarih === null) {
    cerezler.delete(SIMULASYON_CEREZI)
  } else {
    if (!gecerliTarihMi(tarih)) throw new Error('Geçerli bir tarih girin.')
    cerezler.set(SIMULASYON_CEREZI, tarih, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })
  }

  revalidatePath('/', 'layout')
}

/**
 * Okula göre ekran teması. Okul değişince menü, okul düğmesi ve geniş ekrandaki
 * yan şeritler renk değiştirir: hangi okulda çalışıldığı ilk bakışta belli
 * olsun, yanlış okula tahsilat ya da öğrenci girilmesin.
 *
 * Renkler globals.css'te `[data-tema]` altında.
 */
export type OkulTema = 'goksu' | 'ahmet-mithat'

/** Okul adından tema. Tanınmayan okul ve genel mod bugünkü görünümde kalır. */
export function okulTemasi(ad: string | null | undefined): OkulTema | null {
  const buyuk = (ad ?? '').toLocaleUpperCase('tr')
  if (buyuk.includes('GÖKSU')) return 'goksu'
  if (buyuk.includes('AHMET MİTHAT')) return 'ahmet-mithat'
  return null
}

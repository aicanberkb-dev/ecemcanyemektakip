/**
 * Alacakların sabit grupları.
 *
 * Cariler her ay aynı sırayla listelensin diye grup ve grup içi sıra
 * veritabanında duruyor; buradaki dizi yalnızca grupların ekrandaki sırasını
 * ve başlığını belirliyor.
 */
export const CARI_GRUPLARI = [
  { anahtar: 'adliye', ad: 'BEYKOZ ADLİYE' },
  { anahtar: 'tasimali', ad: 'TAŞIMALI EĞİTİM' },
  { anahtar: 'ozel_egitim', ad: 'ÖZEL EĞİTİM OKULLARI' },
  { anahtar: 'dis_hizmet', ad: 'DIŞ HİZMET' },
  { anahtar: 'diger', ad: 'DİĞER' },
] as const

export type CariGrubu = (typeof CARI_GRUPLARI)[number]['anahtar']

export function grupAdi(anahtar: string): string {
  return CARI_GRUPLARI.find((g) => g.anahtar === anahtar)?.ad ?? 'DİĞER'
}

/** Grubu olmayan ya da tanınmayan cari en sona düşsün. */
export function grupSirasi(anahtar: string): number {
  const i = CARI_GRUPLARI.findIndex((g) => g.anahtar === anahtar)
  return i === -1 ? CARI_GRUPLARI.length : i
}

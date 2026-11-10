/**
 * Okulların taksit düzeni.
 *
 * Başlangıçta bütün okullar sekiz adsız taksitti. GÖKSU 8,5 aylık
 * sözleşmeye geçince bu yetmedi: taksitlerin dönem adı var, sonuncusu
 * yarım ve listede sözleşme sınırlarını gösteren ayraçlar duruyor.
 * Öbür okullar eski düzende kaldığı için varsayılan hâlâ sekiz adsız.
 */

import { TAKSIT_SAYISI } from '@/lib/kira-hesap'

export type Taksit = {
  sira: number
  /** Ekranda görünen ad: "3. Taksit" ya da "Aralık 2026" */
  ad: string
  /** Yarım taksit: bütün kalemler yarı tutarla hesaplanır */
  yarim?: boolean
  /** Bu satırın üstünde duracak ayraç yazısı */
  ayrac?: string
}

/** Adsız sekiz taksit — AKBABA ve AHMET MİTHAT */
export const VARSAYILAN_TAKSITLER: Taksit[] = Array.from(
  { length: TAKSIT_SAYISI },
  (_, i) => ({ sira: i + 1, ad: `${i + 1}. Taksit` }),
)

/**
 * GÖKSU: 8,5 aylık sözleşme, Ekim 2026 – Haziran 2027.
 *
 * Sekiz tam (Ekim 2026 – Mayıs 2027) ve bir yarım (Haziran 2027) taksit
 * eder. Birinci satır bu sözleşmeye ait değil: geçen sezonun kirası eylülde
 * yatıyor, yeni sözleşme ekimle başlıyor — o yüzden ayraçla ayrıldı.
 */
export const GOKSU_TAKSITLERI: Taksit[] = [
  { sira: 1, ad: 'Eylül 2026', ayrac: 'Geçen sezon · 2025–2026 sözleşmesi' },
  { sira: 2, ad: 'Ekim 2026', ayrac: 'Yeni sözleşme · 8,5 ay · Ekim 2026 – Haziran 2027' },
  { sira: 3, ad: 'Kasım 2026' },
  { sira: 4, ad: 'Aralık 2026' },
  { sira: 5, ad: 'Ocak 2027' },
  { sira: 6, ad: 'Şubat 2027' },
  { sira: 7, ad: 'Mart 2027' },
  { sira: 8, ad: 'Nisan 2027' },
  { sira: 9, ad: 'Mayıs 2027' },
  { sira: 10, ad: 'Haziran 2027', yarim: true, ayrac: 'Sözleşmenin son ayı · yarım taksit' },
]

/** Hesaplamanın yarıya ineceği taksitler */
export function yarimSiralar(taksitler: Taksit[]): number[] {
  return taksitler.filter((t) => t.yarim).map((t) => t.sira)
}

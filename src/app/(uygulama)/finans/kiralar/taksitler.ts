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
 * GÖKSU: 8,5 aylık sözleşme, Kasım 2026 – Kasım 2027.
 *
 * Sekiz tam (Kasım 2026 – Haziran 2027) ve bir yarım (Kasım 2027) taksit
 * eder. Birinci taksit bu sözleşmeye ait değil — geçen sezonun kapanış
 * ödemesi — o yüzden ayraçla ayrıldı. Yaz tatilinde (Temmuz–Ekim) kira
 * yatmadığı için Haziran 2027 ile Kasım 2027 arasında boşluk var.
 */
export const GOKSU_TAKSITLERI: Taksit[] = [
  { sira: 1, ad: 'Ekim 2026', ayrac: '2025–2026 sözleşmesinin son taksiti' },
  { sira: 2, ad: 'Kasım 2026', ayrac: 'Yeni sözleşme · 8,5 ay · Kasım 2026 – Kasım 2027' },
  { sira: 3, ad: 'Aralık 2026' },
  { sira: 4, ad: 'Ocak 2027' },
  { sira: 5, ad: 'Şubat 2027' },
  { sira: 6, ad: 'Mart 2027' },
  { sira: 7, ad: 'Nisan 2027' },
  { sira: 8, ad: 'Mayıs 2027' },
  { sira: 9, ad: 'Haziran 2027' },
  { sira: 10, ad: 'Kasım 2027', yarim: true, ayrac: 'Gelecek sezon · yarım taksit' },
]

/** Hesaplamanın yarıya ineceği taksitler */
export function yarimSiralar(taksitler: Taksit[]): number[] {
  return taksitler.filter((t) => t.yarim).map((t) => t.sira)
}

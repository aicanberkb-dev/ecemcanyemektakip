/**
 * Kira bedelinden kalemlerin hesabı.
 *
 * Sıra önemli: önce arz düşülür, il ve ilçe payı **arz düşülmüş tutar**
 * üzerinden hesaplanır. Tersi sırayla yapılırsa paylar büyük çıkıyor ve
 * okula yatan kira tutmuyor.
 *
 * Sağlaması AKBABA'nın gerçek ödemeleriyle yapıldı: taban 15.000, üç taksit
 * ödenmiş ve sistemdeki toplam tam 45.000 — kira 34.920 (iki okul),
 * il 4.365, ilçe 4.365, arz 1.350. Yani bir taksitte yatan her şey tabana,
 * sekiz taksit de yıllık tutara (120.000) eşit.
 */

/** Arz oranı — her taksitin arz payı; değişmez */
export const ARZ_ORANI = 0.03
export const IL_ORANI = 0.1
export const ILCE_ORANI = 0.1

/** Kira, il payı ve ilçe payı sekiz taksit olarak yatıyor */
export const TAKSIT_SAYISI = 8
/** Arz üç ödemede yatıyor; her ödeme birkaç taksitin arz payını kapatır */
export const ARZ_ODEME_SAYISI = 3

export type KiraKirilimi = {
  taban: number
  /** Taksit başına arz payı (taban × %3) */
  arzTaksit: number
  /**
   * Arzın üç ödemesi.
   *
   * Her ödeme kapattığı taksit sayısı kadar: sekiz taksit üçe bölününce
   * 3 + 3 + 2 oluyor, yani 15.000 tabanda 1.350 · 1.350 · 900. Oran
   * değişmiyor, yalnızca son ödeme iki taksiti kapatıyor — toplandığında
   * sekiz taksitin arz payı tam çıkıyor.
   */
  arzOdemeleri: number[]
  /** Arz düşülmüş tutar — payların matrahı */
  kalan: number
  ilPayi: number
  ilcePayi: number
  /** Okula yatan kira (grubun tamamı, taksit başına) */
  kiraToplam: number
  /** Kira birden fazla birime bölünüyorsa birim başına düşen */
  kiraBirimBasina: number
  /** Sağlama: bir taksitte yatan her şeyin toplamı, tabana eşit olmalı */
  taksitToplami: number
  /** Sekiz taksitin toplamı */
  yillikToplam: number
}

/** Kuruşa yuvarlar; kayan nokta artığı tutarları bozmasın */
function kurus(n: number): number {
  return Math.round(n * 100) / 100
}

/** Taksitleri arz ödemelerine paylaştırır: 8 taksit, 3 ödeme → 3 + 3 + 2 */
function arzBolumleri(taksitSayisi = TAKSIT_SAYISI, odemeSayisi = ARZ_ODEME_SAYISI): number[] {
  const esit = Math.floor(taksitSayisi / odemeSayisi)
  const artan = taksitSayisi % odemeSayisi
  return Array.from({ length: odemeSayisi }, (_, i) => esit + (i < artan ? 1 : 0))
}

export function kiraKirilimi(taban: number, kiraBirimSayisi = 1): KiraKirilimi {
  const arzTaksit = kurus(taban * ARZ_ORANI)
  const kalan = kurus(taban - arzTaksit)
  const ilPayi = kurus(kalan * IL_ORANI)
  const ilcePayi = kurus(kalan * ILCE_ORANI)
  const kiraToplam = kurus(kalan - ilPayi - ilcePayi)

  return {
    taban,
    arzTaksit,
    arzOdemeleri: arzBolumleri().map((adet) => kurus(arzTaksit * adet)),
    kalan,
    ilPayi,
    ilcePayi,
    kiraToplam,
    kiraBirimBasina: kurus(kiraToplam / Math.max(1, kiraBirimSayisi)),
    taksitToplami: kurus(arzTaksit + ilPayi + ilcePayi + kiraToplam),
    yillikToplam: kurus(taban * TAKSIT_SAYISI),
  }
}

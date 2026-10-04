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

/**
 * Taban kira kademesi: "bu taksitten itibaren kira şu".
 *
 * Yıl ortasında zam gelebiliyor; eski kademe duruyor, yenisi sonrasını
 * değiştiriyor. Ödenmiş taksitlerin dayandığı rakam böylece bozulmuyor.
 */
export type Kademe = { sira: number; tutar: number }

export type KiraKirilimi = {
  taban: number
  /** Taksit başına arz payı (taban × %3) */
  arzTaksit: number
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
}

/** Kuruşa yuvarlar; kayan nokta artığı tutarları bozmasın */
function kurus(n: number): number {
  return Math.round(n * 100) / 100
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
    kalan,
    ilPayi,
    ilcePayi,
    kiraToplam,
    kiraBirimBasina: kurus(kiraToplam / Math.max(1, kiraBirimSayisi)),
    taksitToplami: kurus(arzTaksit + ilPayi + ilcePayi + kiraToplam),
  }
}

/**
 * Arz ödemelerinin kapsadığı taksitler: sekiz taksit üç ödemeye bölününce
 * [1,2,3] · [4,5,6] · [7,8] oluyor.
 */
export function arzKapsamlari(
  taksitSayisi = TAKSIT_SAYISI,
  odemeSayisi = ARZ_ODEME_SAYISI,
): number[][] {
  const esit = Math.floor(taksitSayisi / odemeSayisi)
  const artan = taksitSayisi % odemeSayisi

  const kapsamlar: number[][] = []
  let sira = 1
  for (let i = 0; i < odemeSayisi; i++) {
    const adet = esit + (i < artan ? 1 : 0)
    kapsamlar.push(Array.from({ length: adet }, () => sira++))
  }
  return kapsamlar
}

/**
 * Her taksitin tabanı: o taksitten sonra başlamayan son kademe geçerli.
 *
 * İlk kademeden önceki taksitler null kalır — rakam girilmemiş demektir,
 * uydurmak yerine boş bırakılıyor.
 */
export function taksitTabanlari(
  kademeler: Kademe[],
  taksitSayisi = TAKSIT_SAYISI,
): (number | null)[] {
  const sirali = [...kademeler].sort((a, b) => a.sira - b.sira)

  return Array.from({ length: taksitSayisi }, (_, i) => {
    const taksit = i + 1
    const gecerli = sirali.filter((k) => k.sira <= taksit).at(-1)
    return gecerli?.tutar ?? null
  })
}

/**
 * Arz ödemeleri: her ödeme kapsadığı taksitlerin arz paylarının toplamı.
 *
 * Tek taban varsa 15.000'de 1.350 · 1.350 · 900 çıkar; yıl ortasında kira
 * değişirse ödeme, kapsadığı taksitlerin kendi tabanlarından hesaplanır.
 * Kapsadığı taksitlerden birinin tabanı yoksa o ödeme hesaplanamaz (null).
 */
export function arzOdemeleri(tabanlar: (number | null)[]): (number | null)[] {
  return arzKapsamlari(tabanlar.length).map((kapsam) => {
    const paylar = kapsam.map((t) => tabanlar[t - 1])
    if (paylar.some((p) => p == null)) return null
    return kurus((paylar as number[]).reduce((toplam, p) => toplam + p * ARZ_ORANI, 0))
  })
}

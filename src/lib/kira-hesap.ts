/**
 * Kira bedelinden kalemlerin hesabı.
 *
 * Taban kira, arzsız tutarın %3 fazlasıdır: önce taban 1,03'e bölünüp
 * arzsız tutar bulunur, aradaki fark arz olur. İl payı ve ilçe payı arzsız
 * tutarın %10'u, kalan %80 okula yatar.
 *
 * Tabanın doğrudan %3'ünü almak başka rakam verir (15.000'de 450 yerine
 * 436,89 doğrusu) — ilk kurguda öyle yapılmıştı, sonradan düzeltildi.
 *
 * Sağlama her zaman aynı: bir taksitte yatan her şeyin toplamı tabana,
 * sekiz taksit de yıllık tutara eşit olmalı.
 */

/**
 * Arz çarpanı: taban kira, arzsız tutarın %3 fazlasıdır.
 *
 * Yani arz, tabandan %3 düşülerek değil, taban 1,03'e bölünerek bulunur.
 * Aradaki fark arz tutarıdır. 15.000 tabanda arzsız tutar 14.563,11 ve arz
 * 436,89 — tabanın %3'ü (450) değil.
 */
export const ARZ_CARPANI = 1.03
export const IL_ORANI = 0.1
export const ILCE_ORANI = 0.1
/** Arzsız tutarın okula kalan kısmı */
export const OKUL_ORANI = 0.8

/** Bütün kalemler sekiz taksit olarak yatıyor — arz bedeli de dahil */
export const TAKSIT_SAYISI = 8

/**
 * Taban kira kademesi: "bu taksitten itibaren kira şu".
 *
 * Yıl ortasında zam gelebiliyor; eski kademe duruyor, yenisi sonrasını
 * değiştiriyor. Ödenmiş taksitlerin dayandığı rakam böylece bozulmuyor.
 */
export type Kademe = { sira: number; tutar: number }

export type KiraKirilimi = {
  taban: number
  /** Taksit başına arz payı: taban ile arzsız tutar arasındaki fark */
  arzTaksit: number
  /** Arzsız tutar (taban ÷ 1,03) — payların matrahı */
  kalan: number
  ilPayi: number
  ilcePayi: number
  /** Okula yatan kira (grubun tamamı, taksit başına) */
  kiraToplam: number
  /** Kira birden fazla birime bölünüyorsa birim başına düşen */
  kiraBirimBasina: number
  /** Paylar birden fazla birimde ayrı yatıyorsa birim başına düşen */
  ilPayiBirim: number
  ilcePayiBirim: number
  arzBirim: number
  /** Sağlama: bir taksitte yatan her şeyin toplamı, tabana eşit olmalı */
  taksitToplami: number
}

/** Kuruşa yuvarlar; kayan nokta artığı tutarları bozmasın */
function kurus(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Kalemler birden fazla birime bölünebiliyor ve hangi kalemin bölündüğü
 * okula göre değişiyor: AKBABA'da kira iki okula ayrı yatıyor, paylar tek
 * ödeme; GÖKSU'da ise kira kantin ve yemekhane için ortak, paylar ayrı.
 */
export function kiraKirilimi(
  taban: number,
  kiraBirimSayisi = 1,
  payBirimSayisi = 1,
): KiraKirilimi {
  // Önce arzsız tutar: taban onun %3 fazlası olduğu için 1,03'e bölünür.
  // Arz, ikisi arasındaki fark.
  const kalan = kurus(taban / ARZ_CARPANI)
  const arzTaksit = kurus(taban - kalan)
  const ilPayi = kurus(kalan * IL_ORANI)
  const ilcePayi = kurus(kalan * ILCE_ORANI)
  // Okula kalan %80; paylardan arta kalan olarak alınıyor ki kuruş
  // yuvarlaması toplamı tabandan kaydırmasın
  const kiraToplam = kurus(kalan - ilPayi - ilcePayi)
  const payBolen = Math.max(1, payBirimSayisi)

  return {
    taban,
    arzTaksit,
    kalan,
    ilPayi,
    ilcePayi,
    kiraToplam,
    kiraBirimBasina: kurus(kiraToplam / Math.max(1, kiraBirimSayisi)),
    ilPayiBirim: kurus(ilPayi / payBolen),
    ilcePayiBirim: kurus(ilcePayi / payBolen),
    arzBirim: kurus(arzTaksit / payBolen),
    taksitToplami: kurus(arzTaksit + ilPayi + ilcePayi + kiraToplam),
  }
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
 * Kademelerin kapsadığı taksit aralıkları.
 *
 * Bir kademe, kendisinden sonraki kademe başlayana kadar geçerli; sonuncusu
 * sekizinci taksite kadar gider. Ekranda "4–8. taksit · 18.000" diye bunun
 * için yazılıyor.
 */
export function kademeAraliklari(
  kademeler: Kademe[],
  taksitSayisi = TAKSIT_SAYISI,
): { baslangic: number; bitis: number; tutar: number }[] {
  const sirali = [...kademeler].sort((a, b) => a.sira - b.sira)

  return sirali.map((k, i) => ({
    baslangic: k.sira,
    bitis: (sirali[i + 1]?.sira ?? taksitSayisi + 1) - 1,
    tutar: k.tutar,
  }))
}

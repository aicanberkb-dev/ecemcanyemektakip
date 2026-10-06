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
 * Kuruşu aşağı atar.
 *
 * Arzsız tutarda sözleşmenin yaptığı da bu: 50.030,63 ÷ 1,03 = 48.573,4272
 * sözleşmeye 48.573,42 diye geçmiş, arz da aradaki fark olan 1.457,21
 * olmuş. Yukarı yuvarlansa arz bir kuruş eksik çıkardı.
 */
function kurusAsagi(n: number): number {
  return Math.floor(n * 100 + 1e-6) / 100
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
  const payBolen = Math.max(1, payBirimSayisi)

  // Hesap birim başına yapılır, sonra toplanır. Sözleşmede rakamlar tek
  // birimin kira bedeli üzerinden yazılı; önce toplayıp sonra bölmek
  // kuruşu kaydırıyordu (GÖKSU'da il payı 4.857,34 yerine 4.857,35).
  const birimTaban = kurus(taban / payBolen)
  const birimArzsiz = kurusAsagi(birimTaban / ARZ_CARPANI)
  const arzBirim = kurus(birimTaban - birimArzsiz)
  const ilPayiBirim = kurus(birimArzsiz * IL_ORANI)
  const ilcePayiBirim = kurus(birimArzsiz * ILCE_ORANI)
  // Okula kalan %80; paylardan arta kalan olarak alınıyor ki kuruş
  // yuvarlaması toplamı tabandan kaydırmasın
  const okulBirim = kurus(birimArzsiz - ilPayiBirim - ilcePayiBirim)

  const arzTaksit = kurus(arzBirim * payBolen)
  const ilPayi = kurus(ilPayiBirim * payBolen)
  const ilcePayi = kurus(ilcePayiBirim * payBolen)
  const kiraToplam = kurus(okulBirim * payBolen)

  return {
    taban,
    arzTaksit,
    kalan: kurus(birimArzsiz * payBolen),
    ilPayi,
    ilcePayi,
    kiraToplam,
    kiraBirimBasina: kurus(kiraToplam / Math.max(1, kiraBirimSayisi)),
    ilPayiBirim,
    ilcePayiBirim,
    arzBirim,
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

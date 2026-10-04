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
  const arzTaksit = kurus(taban * ARZ_ORANI)
  const kalan = kurus(taban - arzTaksit)
  const ilPayi = kurus(kalan * IL_ORANI)
  const ilcePayi = kurus(kalan * ILCE_ORANI)
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

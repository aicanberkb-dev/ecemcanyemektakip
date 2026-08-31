/**
 * Simülasyon tarihi — "bugün"ü ileri/geri almak.
 *
 * Sezon başlamadan sistemi denemek imkânsızdı: tahakkuk işlemiyor, kâr/zarar
 * boş, hakedişte geçen gün sıfır. Sunucunun saatini oynatmak yerine tarayıcıya
 * bir çerez konuyor; yalnızca o tarayıcıyı etkiliyor, veriye hiç dokunmuyor.
 *
 * Çerez olduğu için gerçek veri tanımları (sezon tarihleri, ders günü sayısı)
 * bozulmuyor — testi bitirip kapatmayı unutsanız bile sezon hesabı doğru
 * kalır. Yalnız yazdığınız kayıtlar o tarihe düşer, ona dikkat.
 */

export const SIMULASYON_CEREZI = 'simulasyon_tarihi'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Gerçek bugün — simülasyondan etkilenmez. */
export function gercekBugun(): string {
  const d = new Date()
  const iki = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`
}

export function gecerliTarihMi(deger: string | undefined | null): deger is string {
  return !!deger && ISO.test(deger)
}

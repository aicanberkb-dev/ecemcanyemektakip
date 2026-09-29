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
/**
 * Bugün — Türkiye saatine göre.
 *
 * Sunucu UTC'de çalışıyor; yerel saatle hesaplanınca gece yarısı ile 03:00
 * arasında bir önceki gün dönüyordu ve o saatlerde girilen kayıt yanlış
 * güne yazılırdı.
 */
export function gercekBugun(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date())
}

export function gecerliTarihMi(deger: string | undefined | null): deger is string {
  return !!deger && ISO.test(deger)
}

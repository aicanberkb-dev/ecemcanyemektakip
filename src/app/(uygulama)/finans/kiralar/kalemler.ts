/**
 * Kira kalemleri.
 *
 * Hem ekran hem dekont paneli aynı listeyi kullanıyor; tek yerde dursun
 * diye buraya alındı.
 */

export type Kalem = 'kira' | 'il_payi' | 'ilce_payi' | 'uc_aylik' | 'giderler'

/** Kalem adı; `uc_aylik` kodu eski adından kalma, ekranda Arz Bedeli */
export const KALEM_ADLARI: Record<Kalem, string> = {
  kira: 'Kira',
  il_payi: 'İl Payı',
  ilce_payi: 'İlçe Payı',
  uc_aylik: 'Arz Bedeli',
  giderler: 'Elektrik, Su ve Isınma Giderleri',
}

/** Kalemler ekranda hep bu sırada; rastgele sıra kafa karıştırıyor */
export const KALEM_SIRASI: Kalem[] = ['kira', 'il_payi', 'ilce_payi', 'uc_aylik', 'giderler']

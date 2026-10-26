/**
 * Fatura gider türleri.
 *
 * Ayrı dosyada: `'use server'` dosyaları yalnızca async fonksiyon dışa
 * aktarabiliyor, sabitler oradan paylaşılamıyor.
 */

export const GIDER_TURLERI = ['elektrik', 'su', 'dogalgaz'] as const
export type GiderTuru = (typeof GIDER_TURLERI)[number]

export const GIDER_ADLARI: Record<GiderTuru, string> = {
  elektrik: 'Elektrik',
  su: 'Su',
  dogalgaz: 'Doğalgaz',
}

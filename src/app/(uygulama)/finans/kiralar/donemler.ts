import { AY_ADLARI } from '@/lib/format'

/**
 * Faturalarda takip edilen dönem: Ekim 2026 – Haziran 2027.
 *
 * Öğretim yılı boyunca. Yıl değişince buradan uzatılır; dönemler veriden
 * değil listeden geliyor ki girilmemiş aylar da sekmede görünsün.
 *
 * Ayrı dosyada: hem fatura ekranı (istemci) hem ödeme takvimi (sunucu)
 * kullanıyor. `'use client'` dosyasından dışa aktarılan sabit sunucuda
 * istemci referansına dönüşüyor ve okunmaya çalışılınca hata veriyor.
 */
export const DONEMLER = (() => {
  const liste: string[] = []
  for (let i = 0; i < 9; i++) {
    const ay = 10 + i
    const yil = ay <= 12 ? 2026 : 2027
    const a = ay <= 12 ? ay : ay - 12
    liste.push(`${yil}-${String(a).padStart(2, '0')}-01`)
  }
  return liste
})()

export function donemAdi(donem: string): string {
  const [yil, ay] = donem.split('-')
  return `${AY_ADLARI[Number(ay) - 1]} ${yil}`
}

export function donemKisa(donem: string): string {
  const [yil, ay] = donem.split('-')
  return `${AY_ADLARI[Number(ay) - 1].slice(0, 3)} ${yil.slice(2)}`
}

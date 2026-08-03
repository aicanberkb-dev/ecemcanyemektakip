import type { Sezon } from '@/lib/types'

// Bu dosya saf yardımcılar içerir; client bileşenlerinden de kullanılabilsin
// diye sunucuya bağımlı hiçbir şey import etmez. Veritabanı erişimi için
// sezon-sunucu.ts kullanılır.

/**
 * Seçili sezon. Geçersiz id verilirse bugünü kapsayan sezona, o da yoksa
 * en yeni sezona düşer — böylece ekranlar hiçbir zaman boş kalmaz.
 */
export function sezonSec(liste: Sezon[], istenenId?: string): Sezon | null {
  if (liste.length === 0) return null
  if (istenenId) {
    const bulunan = liste.find((s) => s.id === istenenId)
    if (bulunan) return bulunan
  }
  const bugun = new Date().toISOString().slice(0, 10)
  return liste.find((s) => s.baslangic <= bugun && bugun <= s.bitis) ?? liste[0]
}

/** Bir yıl için önerilen sezon: 01.09.yyyy – 31.08.(yyyy+1) */
export function onerilenSezon(yil: number) {
  return {
    ad: `${yil}-${yil + 1}`,
    baslangic: `${yil}-09-01`,
    bitis: `${yil + 1}-08-31`,
  }
}

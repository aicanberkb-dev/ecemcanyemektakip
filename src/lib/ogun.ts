import type { OgunOdeme, SerbestOgunTipi } from '@/lib/types'

/**
 * Öğrenciye bağlı olmayan öğünlerin ekranda görünen adı.
 *
 * Yemekhane ve toplu giriş ekranları aynı mesajları yazıyor; ad tek yerden
 * gelsin ki "Ücretli · Kart" bir ekranda başka türlü yazılmasın.
 */
export function ogunAdi(tip: SerbestOgunTipi, odeme?: OgunOdeme | null): string {
  const ad = tip === 'ucretli' ? 'Ücretli' : tip === 'ogretmen' ? 'Öğretmen' : 'Misafir'
  if (!odeme) return ad
  return `${ad} · ${odeme === 'nakit' ? 'Nakit' : 'Kredi Kartı'}`
}

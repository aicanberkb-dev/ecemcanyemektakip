/**
 * Okul temasında orta alanın (çalışma alanının arkası) nasıl boyanacağı.
 * Ayarlar sayfasından seçilir, çereze yazılır: her cihaz kendi seçimini tutar.
 * Renkler globals.css'te `[data-orta]` altında.
 */
export const GORUNUM_CEREZI = 'orta_gorunum'

export const GORUNUMLER = [
  { no: '1', ad: 'Kenarlar renkli', tarif: 'Orta açık gri, yalnız yan şeritler okulun renginde.' },
  { no: '2', ad: 'Okulun açık tonu', tarif: 'Orta alan okulun çok açık tonunda.' },
  { no: '3', ad: 'Komple aynı renk', tarif: 'Bütün ekran okulun renginde, kartlar üstünde.' },
  { no: '4', ad: 'Renkli masa, açık sayfa', tarif: 'Zemin okulun renginde, çalışma alanı açık bir sayfa.' },
  { no: '5', ad: 'Koyu bütün ekran', tarif: 'Menü dahil her şey koyu.' },
  { no: '6', ad: 'Yumuşak geçiş', tarif: 'Kenardaki renk ortaya doğru açılır.' },
] as const

export type GorunumNo = (typeof GORUNUMLER)[number]['no']

export const VARSAYILAN_GORUNUM: GorunumNo = '3'

/** Çerez değerini doğrular; boş ya da bozuksa varsayılan. */
export function gorunumCozumle(deger: string | null | undefined): GorunumNo {
  return GORUNUMLER.find((g) => g.no === deger)?.no ?? VARSAYILAN_GORUNUM
}

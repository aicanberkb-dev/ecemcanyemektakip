/**
 * Kira ödeme dekontları.
 *
 * Bir dekont birden fazla taksiti kapsayabiliyor: dört taksit tek seferde
 * yatırıldığında tek dosya dört satıra bağlanıyor. Tek taksitlik dekont da
 * aynı yoldan yükleniyor, fark yalnızca kaç satır işaretlendiğinde.
 *
 * Dosyalar `kira-dekontlari` kovasında, okul klasörlerinde duruyor; kova
 * herkese açık değil, dosyalar imzalı bağlantıyla açılıyor.
 */

export const DEKONT_KOVASI = 'kira-dekontlari'

export type Dekont = {
  id: string
  birim: string
  /** DK-01, DK-02… ekranda rozet olarak görünen kısa kod */
  kod: string
  dosya_adi: string
  dosya_yolu: string
  odeme_tarihi: string | null
  tutar: number | null
  aciklama: string | null
  /** Bu dekontun kapsadığı kira satırlarının kimlikleri */
  kiraIdleri: string[]
  /** Görüntüleme için imzalı bağlantı */
  baglanti: string | null
}

/** Rozet kodu: yükleme sırasına göre DK-01, DK-02… */
export function dekontKodu(sira: number): string {
  return `DK-${String(sira).padStart(2, '0')}`
}

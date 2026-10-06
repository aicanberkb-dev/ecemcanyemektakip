/**
 * Kira sözleşmesi dosyaları.
 *
 * Dosyalar Supabase'de `kira-sozlesmeleri` kovasında, okul başına bir
 * klasörde duruyor. Klasör adları ASCII: dosya yolunda Türkçe harf
 * imzalı bağlantıları ve indirme adlarını bozabiliyor.
 */

export const SOZLESME_KOVASI = 'kira-sozlesmeleri'

/** Ekrandaki okul adı → kovadaki klasör */
export const OKUL_KLASORU: Record<string, string> = {
  GÖKSU: 'goksu',
  AKBABA: 'akbaba',
  'AHMET MİTHAT': 'ahmet-mithat',
}

export type SozlesmeDosyasi = {
  ad: string
  yol: string
  boyut: number | null
  yuklenme: string | null
  /** Görüntüleme ve indirme için imzalı bağlantı */
  baglanti: string | null
}

const TURKCE: Record<string, string> = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
  ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
}

/**
 * Dosya adını yola uygun hâle getirir.
 *
 * Türkçe harfler karşılıklarına dönüyor, boşluk ve öbür işaretler alt
 * çizgi oluyor; uzantı korunuyor.
 */
export function dosyaAdiTemizle(ad: string): string {
  const nokta = ad.lastIndexOf('.')
  const govde = nokta > 0 ? ad.slice(0, nokta) : ad
  const uzanti = nokta > 0 ? ad.slice(nokta).toLowerCase() : ''

  const temiz = govde
    .split('')
    .map((h) => TURKCE[h] ?? h)
    .join('')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  return (temiz || 'sozlesme') + uzanti
}

/** 1.2 MB gibi okunur boyut */
export function boyutYazi(bayt: number | null): string {
  if (!bayt) return ''
  if (bayt < 1024) return `${bayt} B`
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`
  return `${(bayt / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

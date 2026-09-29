const paraFormat = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
})

const sayiFormat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 })

export function para(deger: number | string | null | undefined): string {
  return paraFormat.format(Number(deger ?? 0))
}

export function sayi(deger: number | string | null | undefined): string {
  return sayiFormat.format(Number(deger ?? 0))
}

/**
 * Bütün tarih ve saatler Türkiye saatine göre gösterilir.
 *
 * Sunucu UTC'de çalışıyor: saat dilimi verilmezse kayıt saatleri üç saat
 * geri görünüyordu ("bugün" de gece 03:00'e kadar bir önceki gün sayılıyordu).
 * Kullanıcı da veri de Türkiye'de, sabitlemek doğrusu.
 */
export const SAAT_DILIMI = 'Europe/Istanbul'

/** '2026-08-01' veya ISO timestamp → '01.08.2026' */
export function tarih(deger: string | Date | null | undefined): string {
  if (!deger) return '—'
  const d = typeof deger === 'string' ? new Date(deger) : deger
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: SAAT_DILIMI,
  }).format(d)
}

export function tarihSaat(deger: string | Date | null | undefined): string {
  if (!deger) return '—'
  const d = typeof deger === 'string' ? new Date(deger) : deger
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAAT_DILIMI,
  }).format(d)
}

/** ISO timestamp → '13:45' (Türkiye saati) */
export function saat(deger: string | Date | null | undefined): string {
  if (!deger) return '—'
  const d = typeof deger === 'string' ? new Date(deger) : deger
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAAT_DILIMI,
  }).format(d)
}

/** Türkiye saatine göre verilen anın ISO tarihi (yyyy-aa-gg) */
export function isoTarih(d: Date = new Date()): string {
  // en-CA biçimi zaten yyyy-aa-gg veriyor; elle parçalamaya gerek yok
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: SAAT_DILIMI,
  }).format(d)
}

/** Türkiye saatine göre bugünün ISO tarihi (yyyy-aa-gg) */
export function bugunISO(): string {
  return isoTarih()
}

export function ayBasiISO(): string {
  return `${isoTarih().slice(0, 7)}-01`
}

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export const GUN_KISALTMA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

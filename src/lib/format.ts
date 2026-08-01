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

/** '2026-08-01' veya ISO timestamp → '01.08.2026' */
export function tarih(deger: string | Date | null | undefined): string {
  if (!deger) return '—'
  const d = typeof deger === 'string' ? new Date(deger) : deger
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
  }).format(d)
}

/** Yerel saat diliminde bugünün ISO tarihi (yyyy-aa-gg) */
export function bugunISO(): string {
  const d = new Date()
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const gun = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${ay}-${gun}`
}

export function ayBasiISO(): string {
  const d = new Date()
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${ay}-01`
}

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export const GUN_KISALTMA = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

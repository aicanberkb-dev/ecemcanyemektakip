import type { AboneTipi } from '@/lib/types'

export function AboneRozeti({ tip }: { tip: AboneTipi }) {
  return tip === 'aylik' ? (
    <span className="rozet bg-amber-100 text-amber-800">Aylıkçı</span>
  ) : (
    <span className="rozet bg-blue-100 text-blue-800">Günlükçü</span>
  )
}

export function DurumRozeti({ aktif }: { aktif: boolean }) {
  return aktif ? (
    <span className="rozet bg-emerald-100 text-emerald-800">Aktif</span>
  ) : (
    <span className="rozet bg-slate-200 text-slate-600">Pasif</span>
  )
}

export function Bakiye({ tutar, kalin }: { tutar: number; kalin?: boolean }) {
  const renk = tutar < 0 ? 'text-red-600' : 'text-emerald-700'
  return (
    <span className={`tabular-nums ${renk} ${kalin ? 'font-bold' : 'font-medium'}`}>
      {new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
      }).format(tutar)}
    </span>
  )
}

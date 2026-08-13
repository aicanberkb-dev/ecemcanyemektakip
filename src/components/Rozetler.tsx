import { OGRENCI_TIPI_ADLARI, type AboneTipi, type OgrenciTipi } from '@/lib/types'

export function AboneRozeti({ tip }: { tip: AboneTipi }) {
  return tip === 'aylik' ? (
    <span className="rozet bg-amber-100 text-amber-800">Aylıkçı</span>
  ) : (
    <span className="rozet bg-blue-100 text-blue-800">Günlükçü</span>
  )
}

/** Tipe göre rozet rengi. 1. sınıf ayrı renkte: işleyişi diğerlerinden farklı. */
const TIP_RENGI: Record<OgrenciTipi, string> = {
  standart: '',
  birinci_sinif: 'bg-rose-100 text-rose-800',
  anasinifi: 'bg-amber-100 text-amber-800',
  anasinifi_etut: 'bg-violet-100 text-violet-800',
}

const TIP_BASLIGI: Record<OgrenciTipi, string> = {
  standart: '',
  birinci_sinif: '1. sınıf — sınıfından toplu alınır, yoklaması kâğıtta tutulur',
  anasinifi: 'Anasınıfı — kendi taksit planına tabi',
  anasinifi_etut: 'Anasınıfı + Etüt — kendi taksit planına tabi',
}

/**
 * Öğrenci tipi rozeti.
 *
 * Standart tip yazılmaz: öğrencilerin çoğu standart olduğu için her satıra
 * rozet koymak ekranı okunmaz hale getirir. Görülmesi gereken, standarttan
 * ayrılanlar.
 */
export function OgrenciTipiRozeti({ tip }: { tip: OgrenciTipi }) {
  if (tip === 'standart') return null
  return (
    <span className={`rozet ml-1 ${TIP_RENGI[tip]}`} title={TIP_BASLIGI[tip]}>
      {OGRENCI_TIPI_ADLARI[tip]}
    </span>
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

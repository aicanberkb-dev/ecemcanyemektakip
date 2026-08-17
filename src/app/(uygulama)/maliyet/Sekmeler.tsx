'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SEKMELER = [
  { yol: '/maliyet', ad: 'Malzemeler' },
  { yol: '/maliyet/receteler', ad: 'Reçeteler' },
  { yol: '/maliyet/yerler', ad: 'Hizmet Yerleri' },
  { yol: '/maliyet/kar-zarar', ad: 'Kâr / Zarar' },
]

export function Sekmeler() {
  const yol = usePathname()
  return (
    <div className="flex flex-wrap gap-2">
      {SEKMELER.map((s) => {
        const aktif = yol === s.yol
        return (
          <Link
            key={s.yol}
            href={s.yol}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              aktif
                ? 'border-vurgu bg-vurgu font-semibold text-white'
                : 'border-cizgi bg-white hover:bg-slate-50'
            }`}
          >
            {s.ad}
          </Link>
        )
      })}
    </div>
  )
}

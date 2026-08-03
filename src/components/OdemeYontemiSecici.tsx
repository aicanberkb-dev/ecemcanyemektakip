'use client'

import { useState } from 'react'

import { ODEME_YONTEMI_ADLARI, type OdemeYontemi } from '@/lib/types'

const SIRA: OdemeYontemi[] = ['nakit', 'havale', 'kredi_karti']

/**
 * Tahsilatın nasıl alındığı. Zorunlu alan — varsayılan seçim yoktur,
 * kullanıcı bilinçli olarak seçmeli.
 */
export function OdemeYontemiSecici({
  ad = 'odeme_yontemi',
  baslangic = null,
  kucuk,
  onSecim,
}: {
  ad?: string
  baslangic?: OdemeYontemi | null
  kucuk?: boolean
  onSecim?: (yontem: OdemeYontemi | null) => void
}) {
  const [secili, setSecili] = useState<OdemeYontemi | null>(baslangic)

  function sec(y: OdemeYontemi) {
    setSecili(y)
    onSecim?.(y)
  }

  return (
    <div>
      {secili && <input type="hidden" name={ad} value={secili} />}
      <div className="flex flex-wrap gap-2">
        {SIRA.map((y) => {
          const aktif = secili === y
          return (
            <button
              key={y}
              type="button"
              onClick={() => sec(y)}
              aria-pressed={aktif}
              className={`rounded-md border font-medium transition
                ${kucuk ? 'px-3 py-1.5 text-xs' : 'flex-1 px-4 py-2.5 text-sm'}
                ${
                  aktif
                    ? 'border-vurgu bg-blue-50 text-vurgu'
                    : 'border-cizgi bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              {ODEME_YONTEMI_ADLARI[y]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

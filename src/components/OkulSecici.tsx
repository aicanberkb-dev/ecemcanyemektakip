'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import type { Okul } from '@/lib/types'

import { okulDegistir } from '@/app/(uygulama)/okul-actions'

type Props = {
  okullar: Okul[]
  aktifId: string
}

/** Üst bardaki okul değiştirme düğmesi. Seçim çereze yazılır. */
export function OkulSecici({ okullar, aktifId }: Props) {
  const [acik, setAcik] = useState(false)
  const [bekliyor, basla] = useTransition()
  const sarmalRef = useRef<HTMLDivElement>(null)

  const aktif = okullar.find((o) => o.id === aktifId) ?? okullar[0]

  useEffect(() => {
    if (!acik) return
    function disariTikla(e: MouseEvent) {
      if (!sarmalRef.current?.contains(e.target as Node)) setAcik(false)
    }
    function kacisTusu(e: KeyboardEvent) {
      if (e.key === 'Escape') setAcik(false)
    }
    document.addEventListener('mousedown', disariTikla)
    document.addEventListener('keydown', kacisTusu)
    return () => {
      document.removeEventListener('mousedown', disariTikla)
      document.removeEventListener('keydown', kacisTusu)
    }
  }, [acik])

  if (okullar.length === 0) return null

  function sec(okul: Okul) {
    setAcik(false)
    if (okul.id === aktifId) return
    basla(async () => {
      await okulDegistir(okul.id)
    })
  }

  return (
    <div ref={sarmalRef} className="relative">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        disabled={bekliyor}
        aria-haspopup="listbox"
        aria-expanded={acik}
        className="flex items-center gap-2 rounded-md border border-cizgi bg-slate-50 px-3 py-1.5
                   text-sm font-semibold text-metin transition hover:bg-slate-100
                   disabled:opacity-60"
      >
        <span className="size-2 shrink-0 rounded-full bg-vurgu" aria-hidden />
        <span className="max-w-40 truncate">{bekliyor ? 'Geçiliyor…' : aktif?.ad}</span>
        <span className="text-xs text-solgun" aria-hidden>
          ▾
        </span>
      </button>

      {acik && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-56 overflow-hidden rounded-md
                     border border-cizgi bg-white shadow-lg"
        >
          <li className="border-b border-cizgi px-3 py-1.5 text-xs font-medium text-solgun">
            Okul seç
          </li>
          {okullar.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === aktifId}
                onClick={() => sec(o)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                  ${o.id === aktifId ? 'bg-blue-50 font-semibold text-vurgu' : 'hover:bg-slate-50'}`}
              >
                <span className="w-4 shrink-0">{o.id === aktifId ? '✓' : ''}</span>
                <span className="truncate">{o.ad}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

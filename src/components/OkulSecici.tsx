'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { GENEL } from '@/lib/okul-sabitler'
import type { Okul } from '@/lib/types'

import { okulDegistir } from '@/app/(uygulama)/okul-actions'

type Props = {
  okullar: Okul[]
  /** Okul id'si ya da genel mod için 'genel' */
  aktifId: string
}

/**
 * Üst bardaki okul değiştirme düğmesi. Seçim çereze yazılır.
 *
 * Okulların yanında bir de <strong>Genel</strong> var: yemek listeleri ve
 * maliyet gibi okula bağlı olmayan yönetim ekranları oradan açılır.
 */
export function OkulSecici({ okullar, aktifId }: Props) {
  const router = useRouter()
  const yol = usePathname()
  const [acik, setAcik] = useState(false)
  const [bekliyor, basla] = useTransition()
  const sarmalRef = useRef<HTMLDivElement>(null)

  const genelMi = aktifId === GENEL
  const aktif = genelMi ? null : (okullar.find((o) => o.id === aktifId) ?? okullar[0])

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

  function sec(id: string) {
    setAcik(false)
    if (id === aktifId) return
    basla(async () => {
      await okulDegistir(id, yol)
      // Sunucu bileşenleri yeni okulla yeniden çizilsin: üst menü, alt menü
      // ve listeler geçişin hemen ardından güncel olsun. Bu olmadan sayfa
      // elle yenilenene kadar önceki modun alt sekmeleri ekranda kalıyordu.
      router.refresh()
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
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold
                    transition disabled:opacity-60 ${
                      genelMi
                        ? 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'
                        : 'border-cizgi bg-slate-50 text-metin hover:bg-slate-100'
                    }`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${genelMi ? 'bg-violet-600' : 'bg-vurgu'}`}
          aria-hidden
        />
        <span className="max-w-40 truncate">
          {bekliyor ? 'Geçiliyor…' : genelMi ? 'GENEL' : aktif?.ad}
        </span>
        <span className="text-xs text-solgun" aria-hidden>
          ▾
        </span>
      </button>

      {acik && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-60 overflow-hidden rounded-md
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
                onClick={() => sec(o.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                  ${o.id === aktifId ? 'bg-blue-50 font-semibold text-vurgu' : 'hover:bg-slate-50'}`}
              >
                <span className="w-4 shrink-0">{o.id === aktifId ? '✓' : ''}</span>
                <span className="truncate">{o.ad}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-cizgi">
            <button
              type="button"
              role="option"
              aria-selected={genelMi}
              onClick={() => sec(GENEL)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                ${genelMi ? 'bg-violet-50 font-semibold text-violet-800' : 'hover:bg-slate-50'}`}
            >
              <span className="w-4 shrink-0">{genelMi ? '✓' : ''}</span>
              <span>
                GENEL
                <span className="block text-xs font-normal text-solgun">
                  Yemek listeleri · Maliyet · Kâr/Zarar
                </span>
              </span>
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

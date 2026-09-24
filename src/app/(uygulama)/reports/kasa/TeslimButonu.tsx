'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'

import { teslimAl, teslimGeriAl } from './actions'

/**
 * Günün nakiti teslim alındı işareti.
 *
 * Okulda olunmayan günlerde orada ne kadar nakit biriktiği buradan
 * izleniyor: işaretlenmemiş her gün hâlâ okulda duran para demek.
 */
export function TeslimButonu({
  tarih,
  tutar,
  alindi,
  alinanTutar,
}: {
  tarih: string
  /** Bugüne kadar hesaplanan nakit — teslim anında dondurulur */
  tutar: number
  alindi: boolean
  /** Teslim anında kaydedilen tutar */
  alinanTutar: number
}) {
  const router = useRouter()
  const [bekliyor, setBekliyor] = useState(false)

  // Teslimden sonra o güne kayıt girilmişse fark burada görünür
  const fark = alindi ? tutar - alinanTutar : 0

  async function calistir() {
    if (bekliyor) return
    if (alindi) {
      if (!confirm(`${tarihBicim(tarih)} teslim işareti kaldırılsın mı?`)) return
    } else if (
      !confirm(`${tarihBicim(tarih)} günündeki ${para(tutar)} nakit teslim alındı mı?`)
    ) {
      return
    }

    setBekliyor(true)
    try {
      if (alindi) await teslimGeriAl(tarih)
      else await teslimAl(tarih, tutar)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
    } finally {
      setBekliyor(false)
    }
  }

  if (alindi) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="rozet bg-emerald-100 text-emerald-800">
          Teslim alındı · {para(alinanTutar)}
        </span>
        {fark !== 0 && (
          <span className="text-xs text-amber-700">
            Teslimden sonra {para(Math.abs(fark))} {fark > 0 ? 'eklendi' : 'düştü'}
          </span>
        )}
        <button
          type="button"
          disabled={bekliyor}
          onClick={calistir}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {bekliyor ? 'Kaldırılıyor…' : 'Geri al'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={bekliyor || tutar === 0}
      onClick={calistir}
      className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium
                 whitespace-nowrap text-emerald-700 transition hover:bg-emerald-50
                 disabled:cursor-not-allowed disabled:border-cizgi disabled:text-slate-400"
    >
      {bekliyor ? 'Kaydediliyor…' : 'Teslim Aldım'}
    </button>
  )
}

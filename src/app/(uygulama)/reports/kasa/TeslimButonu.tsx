'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'

import { teslimAl, teslimAlToplu, teslimGeriAl } from './actions'

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
  bekleyenGun,
  bekleyenTutar,
}: {
  tarih: string
  /** Bugüne kadar hesaplanan nakit — teslim anında dondurulur */
  tutar: number
  alindi: boolean
  /** Teslim anında kaydedilen tutar */
  alinanTutar: number
  /** Bu güne kadar teslim alınmamış gün sayısı (bu gün dahil) */
  bekleyenGun: number
  /** O günlerin nakit toplamı */
  bekleyenTutar: number
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

  /** Son teslimden bu güne kadar biriken bütün günleri tek seferde işaretler */
  async function topluCalistir() {
    if (bekliyor) return
    if (
      !confirm(
        `${tarihBicim(tarih)} gününe kadar teslim alınmamış ${bekleyenGun} gün var.\n` +
          `Toplam ${para(bekleyenTutar)} teslim alındı olarak işaretlensin mi?`,
      )
    )
      return

    setBekliyor(true)
    try {
      await teslimAlToplu('2000-01-01', tarih)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
    } finally {
      setBekliyor(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      {/* Tek gün değil, birikmiş günler: iki hafta sonra gelince hepsi bir tıkla */}
      {bekleyenGun > 1 && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={topluCalistir}
          className="rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-xs
                     font-medium whitespace-nowrap text-amber-800 transition
                     hover:bg-amber-100 disabled:opacity-50"
        >
          Bu güne kadar {bekleyenGun} günü al ({para(bekleyenTutar)})
        </button>
      )}
    </div>
  )
}

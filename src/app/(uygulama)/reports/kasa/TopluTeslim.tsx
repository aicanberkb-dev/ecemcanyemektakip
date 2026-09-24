'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { para } from '@/lib/format'

import { teslimAlToplu } from './actions'

/**
 * Birikmiş günlerin tek tıkla teslim alınması.
 *
 * Satır sonundaki bağlantı gözden kaçıyordu; iki haftada bir gelinip
 * kasa alındığı için bu işlem sayfanın en görünür yerinde durmalı.
 */
export function TopluTeslim({
  bas,
  bit,
  gun,
  tutar,
}: {
  bas: string
  bit: string
  /** Teslim alınmamış gün sayısı */
  gun: number
  /** O günlerin nakit toplamı */
  tutar: number
}) {
  const router = useRouter()
  const [bekliyor, setBekliyor] = useState(false)

  async function calistir() {
    if (bekliyor) return
    if (
      !confirm(
        `${gun} günün nakiti teslim alındı olarak işaretlenecek.\n` +
          `Toplam ${para(tutar)}. Onaylıyor musunuz?`,
      )
    )
      return

    setBekliyor(true)
    try {
      await teslimAlToplu(bas, bit)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
    } finally {
      setBekliyor(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex-1">
        <p className="font-semibold text-amber-900">
          {gun} gün teslim alınmadı — {para(tutar)} okulda duruyor
        </p>
        <p className="text-xs text-amber-800">
          Hepsini birden işaretleyin; her gün yine kendi tutarıyla ayrı kaydedilir.
          Tek gün almak isterseniz satırdaki “Teslim Aldım” butonunu kullanın.
        </p>
      </div>
      <button
        type="button"
        disabled={bekliyor}
        onClick={calistir}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold whitespace-nowrap
                   text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {bekliyor ? 'İşleniyor…' : `Hepsini teslim aldım (${gun} gün)`}
      </button>
    </div>
  )
}

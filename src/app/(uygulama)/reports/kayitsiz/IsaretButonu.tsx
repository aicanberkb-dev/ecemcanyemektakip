'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { isaretle } from './actions'

/**
 * Takip işareti düğmesi.
 *
 * Basıldığında yalnızca bu rapordaki bilgi değişir; öğün kaydına, kasaya
 * ya da yemekhane ekranına dokunmaz. Yanlış basıldıysa aynı düğmeyle
 * geri alınır.
 */
export function IsaretButonu({
  id,
  alan,
  deger,
  acikAd,
  kapaliAd,
}: {
  id: string
  alan: 'veli_arandi' | 'ucret_alindi'
  deger: boolean
  /** İşaretliyken görünen metin */
  acikAd: string
  /** İşaretsizken görünen metin */
  kapaliAd: string
}) {
  const router = useRouter()
  const [bekliyor, setBekliyor] = useState(false)

  async function tikla() {
    if (bekliyor) return
    setBekliyor(true)
    try {
      await isaretle(id, alan, !deger)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'İşlem tamamlanamadı.')
    } finally {
      setBekliyor(false)
    }
  }

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={tikla}
      title={deger ? 'İşareti kaldırmak için tıklayın' : undefined}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap
                  transition disabled:opacity-50 ${
                    deger
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-cizgi bg-white text-solgun hover:bg-slate-50'
                  }`}
    >
      {bekliyor ? '…' : deger ? `✓ ${acikAd}` : kapaliAd}
    </button>
  )
}

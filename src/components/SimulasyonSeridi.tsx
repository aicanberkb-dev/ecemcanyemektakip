'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { simulasyonAyarla } from '@/app/(uygulama)/simulasyon-actions'
import { tarih as tarihBicim } from '@/lib/format'

/**
 * Simülasyon açıkken tepede duran şerit.
 *
 * Test modunda olduğunu unutup gerçek veri girmek en kötü ihtimal; bu yüzden
 * şerit her sayfada, dikkat çekici renkte ve kapatması tek tık.
 */
export function SimulasyonSeridi({
  tarih,
  gercekTarih,
}: {
  tarih: string
  gercekTarih: string
}) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()
  const [yeni, setYeni] = useState(tarih)

  function uygula(hedef: string | null) {
    basla(async () => {
      await simulasyonAyarla(hedef)
      router.refresh()
    })
  }

  return (
    <div className="yazdirma-gizle border-b-2 border-orange-400 bg-orange-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <span className="font-bold text-orange-900">SİMÜLASYON</span>
        <span className="text-orange-900">
          Sistem <strong>{tarihBicim(tarih)}</strong> tarihindeymiş gibi çalışıyor
          <span className="ml-1 opacity-70">(gerçek: {tarihBicim(gercekTarih)})</span>
        </span>

        <input
          type="date"
          value={yeni}
          onChange={(e) => setYeni(e.target.value)}
          className="rounded border border-orange-400 bg-white px-2 py-1 text-xs outline-none"
        />
        <button
          type="button"
          disabled={bekliyor || yeni === tarih}
          onClick={() => uygula(yeni)}
          className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white
                     hover:bg-orange-700 disabled:opacity-40"
        >
          Tarihi değiştir
        </button>
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => uygula(null)}
          className="ml-auto rounded border border-orange-500 px-3 py-1 text-xs font-semibold
                     text-orange-900 hover:bg-orange-200"
        >
          Simülasyonu kapat
        </button>
      </div>
      <p className="mx-auto max-w-7xl px-4 pb-2 text-xs text-orange-900/80">
        Girdiğiniz kayıtlar bu tarihe yazılır. Yalnızca bu tarayıcıyı etkiler; sezon
        tarihleri ve ders günü sayısı değişmez.
      </p>
    </div>
  )
}

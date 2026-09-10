'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { gorunumDegistir } from '@/app/(uygulama)/gorunum-actions'
import { GORUNUMLER, type GorunumNo } from '@/lib/gorunum'

/**
 * Ayarlar sayfasındaki ekran görünümü seçimi. Seçim bu cihazda saklanır;
 * tıklanınca ekran hemen yeni görünümle yenilenir.
 */
export function GorunumSecici({ secili }: { secili: GorunumNo }) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()

  function sec(no: string) {
    if (no === secili) return
    basla(async () => {
      await gorunumDegistir(no)
      router.refresh()
    })
  }

  return (
    <div className="kart p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-metin">Ekran görünümü</h2>
        <span className="text-xs text-solgun">
          {bekliyor ? 'Değiştiriliyor…' : 'Bu cihazda geçerli · her iki okulda da uygulanır'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {GORUNUMLER.map((g) => {
          const aktif = g.no === secili
          return (
            <button
              key={g.no}
              type="button"
              onClick={() => sec(g.no)}
              disabled={bekliyor}
              aria-pressed={aktif}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                aktif
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-cizgi bg-white text-metin hover:bg-slate-50'
              }`}
            >
              <span className="text-lg leading-none font-bold tabular-nums">{g.no}</span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{g.ad}</span>
                <span className={`block text-xs ${aktif ? 'text-gray-300' : 'text-solgun'}`}>
                  {g.tarif}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

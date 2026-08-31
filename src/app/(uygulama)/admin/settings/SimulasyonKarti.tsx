'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { simulasyonAyarla } from '@/app/(uygulama)/simulasyon-actions'
import { tarih as tarihBicim } from '@/lib/format'

/**
 * Simülasyon tarihi ayarı.
 *
 * Sezon başlamadan sistemi denemek için "bugün"ü ileri almaya yarar. Sunucu
 * saatini oynatmak yerine tarayıcıya çerez konuyor: veri tanımlarına (sezon
 * tarihleri, ders günü) dokunmuyor, yalnızca bu tarayıcıyı etkiliyor.
 */
export function SimulasyonKarti({
  acikTarih,
  gercekTarih,
}: {
  acikTarih: string | null
  gercekTarih: string
}) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()
  const [tarih, setTarih] = useState(acikTarih ?? gercekTarih)

  function uygula(hedef: string | null) {
    basla(async () => {
      await simulasyonAyarla(hedef)
      router.refresh()
    })
  }

  return (
    <div className="kart p-4">
      <h2 className="font-semibold">Simülasyon Tarihi</h2>
      <p className="mt-1 text-sm text-solgun">
        Sistemi başka bir tarihteymiş gibi çalıştırır. Sezon başlamadan tahakkuku,
        hakedişi ve kâr/zararı denemek için. Gerçek bugün{' '}
        <strong>{tarihBicim(gercekTarih)}</strong>.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="etiket text-xs">Tarih</label>
          <input
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => uygula(tarih)}
          className="btn-birincil !py-1.5"
        >
          {acikTarih ? 'Tarihi değiştir' : 'Simülasyonu başlat'}
        </button>
        {acikTarih && (
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => uygula(null)}
            className="btn-ikincil !py-1.5"
          >
            Kapat
          </button>
        )}
      </div>

      {acikTarih && (
        <p className="mt-3 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-900">
          Şu an <strong>{tarihBicim(acikTarih)}</strong> tarihindeymiş gibi çalışıyorsunuz.
          Her sayfanın tepesinde turuncu şerit var.
        </p>
      )}

      <p className="mt-3 text-xs text-solgun">
        Yalnızca bu tarayıcıyı etkiler; başka kullanıcılar gerçek tarihi görür. Sezon
        tarihleri ve ders günü sayısı değişmez — kapatmayı unutsanız bile sezon hesabı
        bozulmaz. <strong>Ama girdiğiniz kayıtlar seçtiğiniz tarihe yazılır</strong>,
        gerçek veri girerken kapalı olduğundan emin olun.
      </p>
    </div>
  )
}

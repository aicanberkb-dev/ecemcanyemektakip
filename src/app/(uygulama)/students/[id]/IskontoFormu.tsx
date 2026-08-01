'use client'

import { useActionState } from 'react'

import { iskontoDevirGuncelle, type FormDurumu } from '../actions'

type Props = {
  id: string
  iskontoOrani: number
  iskontoTutar: number
  devir: number
}

export function IskontoFormu({ id, iskontoOrani, iskontoTutar, devir }: Props) {
  const eylem = iskontoDevirGuncelle.bind(null, id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as FormDurumu)
  const vir = (n: number) => String(n).replace('.', ',')

  return (
    <form action={gonder} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiket text-xs">İskonto Oranı (%)</label>
          <input
            name="iskonto_orani"
            inputMode="decimal"
            defaultValue={vir(iskontoOrani)}
            className="girdi !py-1.5"
          />
          {durum.alanlar?.iskonto_orani && (
            <p className="hata">{durum.alanlar.iskonto_orani}</p>
          )}
        </div>
        <div>
          <label className="etiket text-xs">İskonto Tutarı (₺)</label>
          <input
            name="iskonto_tutar"
            inputMode="decimal"
            defaultValue={vir(iskontoTutar)}
            className="girdi !py-1.5"
          />
          {durum.alanlar?.iskonto_tutar && (
            <p className="hata">{durum.alanlar.iskonto_tutar}</p>
          )}
        </div>
        <div>
          <label className="etiket text-xs">Devir (₺)</label>
          <input
            name="devir"
            inputMode="decimal"
            defaultValue={vir(devir)}
            className="girdi !py-1.5"
          />
          {durum.alanlar?.devir && <p className="hata">{durum.alanlar.devir}</p>}
        </div>
      </div>

      {durum.hata && <p className="hata">{durum.hata}</p>}

      <button className="btn-ikincil !py-1.5" disabled={bekliyor}>
        {bekliyor ? 'Kaydediliyor…' : 'İskonto & devri güncelle'}
      </button>
    </form>
  )
}

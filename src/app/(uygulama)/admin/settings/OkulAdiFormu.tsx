'use client'

import { useActionState } from 'react'

import { okulAdiGuncelle, type AyarDurumu } from './actions'

export function OkulAdiFormu({ okulId, ad }: { okulId: string; ad: string }) {
  const eylem = okulAdiGuncelle.bind(null, okulId)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as AyarDurumu)

  return (
    <form action={gonder} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <label className="etiket" htmlFor="ad">
          Okul adı
        </label>
        <input id="ad" name="ad" defaultValue={ad} className="girdi" />
        {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
      </div>
      <button className="btn-ikincil" disabled={bekliyor}>
        {bekliyor ? 'Kaydediliyor…' : 'Adı Kaydet'}
      </button>
      {durum.hata && <p className="hata w-full">{durum.hata}</p>}
      {durum.basari && (
        <p className="w-full text-sm text-emerald-700">{durum.basari}</p>
      )}
    </form>
  )
}

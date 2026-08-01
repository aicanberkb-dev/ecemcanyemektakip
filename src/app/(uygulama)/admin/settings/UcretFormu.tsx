'use client'

import { useActionState } from 'react'

import type { AppSettings } from '@/lib/types'

import { ucretleriGuncelle, type AyarDurumu } from './actions'

export function UcretFormu({ ayar }: { ayar: AppSettings }) {
  const eylem = ucretleriGuncelle.bind(null, ayar.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as AyarDurumu)
  const vir = (n: number) => String(n).replace('.', ',')

  return (
    <form action={gonder} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="etiket" htmlFor="taban_gunluk_ucret">
            Taban günlük ücret (₺)
          </label>
          <input
            id="taban_gunluk_ucret"
            name="taban_gunluk_ucret"
            inputMode="decimal"
            defaultValue={vir(ayar.taban_gunluk_ucret)}
            className="girdi"
          />
          <p className="mt-1 text-xs text-solgun">
            Günlükçü öğrencinin iskontosuz yemek ücreti.
          </p>
          {durum.alanlar?.taban_gunluk_ucret && (
            <p className="hata">{durum.alanlar.taban_gunluk_ucret}</p>
          )}
        </div>

        <div>
          <label className="etiket" htmlFor="ucretli_ogun_ucreti">
            Ücretli öğün (₺)
          </label>
          <input
            id="ucretli_ogun_ucreti"
            name="ucretli_ogun_ucreti"
            inputMode="decimal"
            defaultValue={vir(ayar.ucretli_ogun_ucreti)}
            className="girdi"
          />
          <p className="mt-1 text-xs text-solgun">0 girilirse taban ücret kullanılır.</p>
          {durum.alanlar?.ucretli_ogun_ucreti && (
            <p className="hata">{durum.alanlar.ucretli_ogun_ucreti}</p>
          )}
        </div>

        <div>
          <label className="etiket" htmlFor="misafir_ogun_ucreti">
            Misafir öğün (₺)
          </label>
          <input
            id="misafir_ogun_ucreti"
            name="misafir_ogun_ucreti"
            inputMode="decimal"
            defaultValue={vir(ayar.misafir_ogun_ucreti)}
            className="girdi"
          />
          <p className="mt-1 text-xs text-solgun">0 girilirse ücretsiz sayılır.</p>
          {durum.alanlar?.misafir_ogun_ucreti && (
            <p className="hata">{durum.alanlar.misafir_ogun_ucreti}</p>
          )}
        </div>
      </div>

      {durum.hata && <p className="hata">{durum.hata}</p>}
      {durum.basari && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {durum.basari}
        </p>
      )}

      <button className="btn-birincil" disabled={bekliyor}>
        {bekliyor ? 'Kaydediliyor…' : 'Ücretleri Kaydet'}
      </button>
    </form>
  )
}

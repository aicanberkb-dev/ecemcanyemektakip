'use client'

import { useActionState, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import type { TaksitPlani } from '@/lib/types'

import { taksitEkle, taksitGuncelle, taksitSil, type AyarDurumu } from './actions'

export function TaksitPlaniBolumu({ yil, plan }: { yil: number; plan: TaksitPlani[] }) {
  const [durum, gonder, bekliyor] = useActionState(taksitEkle, {} as AyarDurumu)
  const toplam = plan.reduce((t, p) => t + Number(p.tutar), 0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Taksit Adı</th>
              <th>Vade Tarihi</th>
              <th className="text-right">Tutar</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((t) => (
              <TaksitSatiri key={t.id} taksit={t} />
            ))}
            {plan.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-solgun">
                  {yil} için taksit tanımlı değil.
                </td>
              </tr>
            )}
          </tbody>
          {plan.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Yıllık toplam ({plan.length} taksit)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Yeni taksit */}
      <form action={gonder} className="flex flex-wrap items-end gap-3 border-t border-cizgi pt-4">
        <input type="hidden" name="yil" value={yil} />
        <div className="min-w-40 flex-1">
          <label className="etiket text-xs">Taksit adı</label>
          <input name="ad" placeholder="ör. Şubat" className="girdi !py-1.5" required />
          {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
        </div>
        <div>
          <label className="etiket text-xs">Vade tarihi</label>
          <input
            type="date"
            name="vade_tarihi"
            defaultValue={`${yil}-01-01`}
            className="girdi !py-1.5"
            required
          />
          {durum.alanlar?.vade_tarihi && <p className="hata">{durum.alanlar.vade_tarihi}</p>}
        </div>
        <div>
          <label className="etiket text-xs">Tutar (₺)</label>
          <input
            name="tutar"
            inputMode="decimal"
            placeholder="10.000,00"
            className="girdi !py-1.5 w-36"
            required
          />
          {durum.alanlar?.tutar && <p className="hata">{durum.alanlar.tutar}</p>}
        </div>
        <button className="btn-birincil !py-1.5" disabled={bekliyor}>
          {bekliyor ? 'Ekleniyor…' : '+ Taksit Ekle'}
        </button>
        {durum.hata && <p className="hata w-full">{durum.hata}</p>}
      </form>
    </div>
  )
}

function TaksitSatiri({ taksit }: { taksit: TaksitPlani }) {
  const [duzenle, setDuzenle] = useState(false)
  const eylem = taksitGuncelle.bind(null, taksit.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as AyarDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={4} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div className="min-w-32 flex-1">
              <label className="etiket text-xs">Ad</label>
              <input name="ad" defaultValue={taksit.ad} className="girdi !py-1.5" />
            </div>
            <div>
              <label className="etiket text-xs">Vade</label>
              <input
                type="date"
                name="vade_tarihi"
                defaultValue={taksit.vade_tarihi}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Tutar</label>
              <input
                name="tutar"
                inputMode="decimal"
                defaultValue={String(taksit.tutar).replace('.', ',')}
                className="girdi !py-1.5 w-36"
              />
            </div>
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setDuzenle(false)}
              className="btn-ikincil !py-1.5"
            >
              Vazgeç
            </button>
            {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="font-medium">{taksit.ad}</td>
      <td>{tarihBicim(taksit.vade_tarihi)}</td>
      <td className="text-right tabular-nums">{para(taksit.tutar)}</td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`"${taksit.ad}" taksiti silinsin mi?`)) return
            await taksitSil(taksit.id)
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Sil
        </button>
      </td>
    </tr>
  )
}

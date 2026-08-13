'use client'

import { useActionState, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import {
  OGRENCI_TIPI_ADLARI,
  PLANLI_OGRENCI_TIPLERI,
  type OgrenciTipi,
  type TaksitPlani,
} from '@/lib/types'

import { taksitEkle, taksitGuncelle, taksitSil, type AyarDurumu } from './actions'

/**
 * Taksit planı öğrenci tipi kırılımında tutulur: standart, anasınıfı ve
 * anasınıfı+etüt öğrencilerinin ücretleri farklı. Öğrenci kendi tipinin
 * planına göre değerlendirilir; öğrenci bazlı istisna bunun üstüne biner.
 */
export function TaksitPlaniBolumu({
  sezonId,
  sezonAdi,
  plan,
}: {
  sezonId: string
  sezonAdi: string
  plan: TaksitPlani[]
}) {
  const [tip, setTip] = useState<OgrenciTipi>('standart')
  const [durum, gonder, bekliyor] = useActionState(taksitEkle, {} as AyarDurumu)

  const tipinPlani = plan.filter((p) => p.ogrenci_tipi === tip)
  const toplam = tipinPlani.reduce((t, p) => t + Number(p.tutar), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PLANLI_OGRENCI_TIPLERI.map((t) => {
          const adet = plan.filter((p) => p.ogrenci_tipi === t).length
          const tutar = plan
            .filter((p) => p.ogrenci_tipi === t)
            .reduce((x, p) => x + Number(p.tutar), 0)
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTip(t)}
              className={`rounded-md border px-3 py-2 text-sm ${
                t === tip
                  ? 'border-vurgu bg-blue-50 font-semibold text-vurgu'
                  : 'border-cizgi hover:bg-gray-50'
              }`}
            >
              {OGRENCI_TIPI_ADLARI[t]}
              <span className="ml-2 text-xs text-solgun">
                {adet === 0 ? 'plan yok' : `${adet} taksit · ${para(tutar)}`}
              </span>
            </button>
          )
        })}
      </div>

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
            {tipinPlani.map((t) => (
              <TaksitSatiri key={t.id} taksit={t} />
            ))}
            {tipinPlani.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-solgun">
                  {sezonAdi} sezonunda <strong>{OGRENCI_TIPI_ADLARI[tip]}</strong> için taksit
                  tanımlı değil.
                </td>
              </tr>
            )}
          </tbody>
          {tipinPlani.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  {OGRENCI_TIPI_ADLARI[tip]} yıllık toplam ({tipinPlani.length} taksit)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Yeni taksit — seçili tipe eklenir */}
      <form action={gonder} className="flex flex-wrap items-end gap-3 border-t border-cizgi pt-4">
        <input type="hidden" name="sezon_id" value={sezonId} />
        <input type="hidden" name="ogrenci_tipi" value={tip} />
        <div className="min-w-40 flex-1">
          <label className="etiket text-xs">Taksit adı</label>
          <input name="ad" placeholder="ör. 1. Taksit" className="girdi !py-1.5" required />
          {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
        </div>
        <div>
          <label className="etiket text-xs">Vade tarihi</label>
          <input type="date" name="vade_tarihi" className="girdi !py-1.5" required />
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
          {bekliyor ? 'Ekleniyor…' : `+ ${OGRENCI_TIPI_ADLARI[tip]} taksiti ekle`}
        </button>
        {durum.hata && <p className="hata w-full">{durum.hata}</p>}
      </form>

      <p className="text-xs text-solgun">
        Öğrenci, ana verisinde seçili tipin planına göre değerlendirilir.{' '}
        <strong>1. sınıf öğrencileri standart planı kullanır</strong>, ayrı plan
        girilmesine gerek yoktur. Tek bir öğrenciye farklı tutar ya da vade gerekiyorsa
        öğrenci sayfasındaki taksit bölümünden istisna tanımlayın — istisna tipin
        planını ezer.
      </p>
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
            <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
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

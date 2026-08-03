'use client'

import { useActionState, useState } from 'react'

import { OdemeYontemiSecici } from '@/components/OdemeYontemiSecici'
import { para, tarih as tarihBicim } from '@/lib/format'
import { ODEME_YONTEMI_ADLARI, type Transaction } from '@/lib/types'

import { islemGuncelle, islemSil, type IslemDurumu } from '../../islem-actions'

export function IslemSatiri({ islem }: { islem: Transaction }) {
  const [duzenle, setDuzenle] = useState(false)
  const [siliniyor, setSiliniyor] = useState(false)

  const eylem = islemGuncelle.bind(null, islem.id, islem.student_id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as IslemDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={5} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Tarih</label>
              <input
                type="date"
                name="tarih"
                defaultValue={islem.tarih}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Tutar</label>
              <input
                name="tutar"
                inputMode="decimal"
                defaultValue={String(islem.tutar).replace('.', ',')}
                className="girdi !py-1.5 w-32"
              />
            </div>
            <div className="min-w-48 flex-1">
              <label className="etiket text-xs">Açıklama</label>
              <input
                name="aciklama"
                defaultValue={islem.aciklama ?? ''}
                className="girdi !py-1.5"
              />
            </div>
            {islem.tip === 'tahsilat' && (
              <div>
                <label className="etiket text-xs">Ödeme Yöntemi</label>
                <OdemeYontemiSecici baslangic={islem.odeme_yontemi} kucuk />
                {durum.alanlar?.odeme_yontemi && (
                  <p className="hata">{durum.alanlar.odeme_yontemi}</p>
                )}
              </div>
            )}
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
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
      <td className="whitespace-nowrap">{tarihBicim(islem.tarih)}</td>
      <td>
        {islem.tip === 'tahsilat' ? (
          <span className="rozet bg-emerald-100 text-emerald-800">Tahsilat</span>
        ) : (
          <span className="rozet bg-slate-100 text-slate-700">
            {islem.ogun_abone_tipi ? 'Yemek' : 'Harcama'}
          </span>
        )}
      </td>
      <td className="text-solgun">
        {islem.odeme_yontemi && (
          <span className="rozet mr-2 bg-slate-100 text-slate-700">
            {ODEME_YONTEMI_ADLARI[islem.odeme_yontemi]}
          </span>
        )}
        {islem.aciklama ?? '—'}
      </td>
      <td
        className={`text-right font-medium tabular-nums ${
          islem.tip === 'tahsilat' ? 'text-emerald-700' : 'text-slate-700'
        }`}
      >
        {islem.tip === 'tahsilat' ? '+' : '−'}
        {para(islem.tutar)}
      </td>
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
          disabled={siliniyor}
          onClick={async () => {
            if (!confirm('Bu işlem silinsin mi? Geri alınamaz.')) return
            setSiliniyor(true)
            try {
              await islemSil(islem.id, islem.student_id)
            } finally {
              setSiliniyor(false)
            }
          }}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {siliniyor ? 'Siliniyor…' : 'Sil'}
        </button>
      </td>
    </tr>
  )
}

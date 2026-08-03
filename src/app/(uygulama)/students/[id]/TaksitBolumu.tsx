'use client'

import { useActionState, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import type { OgrenciTaksitSatiri } from '@/lib/types'

import {
  ogrenciTaksitGuncelle,
  ogrenciTaksitVarsayilana,
  type TaksitIstisnaDurumu,
} from './taksit-actions'

export function TaksitBolumu({
  studentId,
  yil,
  satirlar,
}: {
  studentId: string
  yil: number
  satirlar: OgrenciTaksitSatiri[]
}) {
  const toplam = satirlar.reduce((t, s) => t + Number(s.tutar), 0)
  const okulToplami = satirlar.reduce((t, s) => t + Number(s.okul_tutar), 0)
  const ozelVar = satirlar.some((s) => s.ozel_tutar || s.ozel_vade)

  if (satirlar.length === 0) {
    return (
      <p className="text-sm text-solgun">
        {yil} yılı için okul taksit planı tanımlı değil. Ayarlar sayfasından
        tanımlayabilirsiniz.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-solgun">
        Okul planı varsayılan gelir. Bir tutarı veya tarihi değiştirirsen{' '}
        <strong className="text-metin">yalnızca o satır</strong> bu öğrenciye özel olur;
        diğerleri okul planını izlemeye devam eder.
      </p>

      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Taksit</th>
              <th>Vade</th>
              <th className="text-right">Tutar</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <TaksitSatiri key={s.taksit_plani_id} studentId={studentId} satir={s} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                {yil} yıllık toplam
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {para(toplam)}
                {ozelVar && toplam !== okulToplami && (
                  <span className="ml-2 text-xs font-normal text-solgun line-through">
                    {para(okulToplami)}
                  </span>
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function TaksitSatiri({
  studentId,
  satir,
}: {
  studentId: string
  satir: OgrenciTaksitSatiri
}) {
  const [duzenle, setDuzenle] = useState(false)
  const [siliniyor, setSiliniyor] = useState(false)

  const eylem = ogrenciTaksitGuncelle.bind(null, studentId, satir.taksit_plani_id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as TaksitIstisnaDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  const ozel = satir.ozel_tutar || satir.ozel_vade

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={5} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div className="font-medium">{satir.ad}</div>
            <div>
              <label className="etiket text-xs">Vade</label>
              <input
                type="date"
                name="vade_tarihi"
                defaultValue={satir.vade_tarihi}
                className="girdi !py-1.5"
              />
              <p className="mt-1 text-xs text-solgun">
                Okul: {tarihBicim(satir.okul_vade)}
              </p>
            </div>
            <div>
              <label className="etiket text-xs">Tutar (₺)</label>
              <input
                name="tutar"
                inputMode="decimal"
                defaultValue={String(satir.tutar).replace('.', ',')}
                className="girdi !py-1.5 w-36"
              />
              <p className="mt-1 text-xs text-solgun">Okul: {para(satir.okul_tutar)}</p>
            </div>
            <div className="min-w-40 flex-1">
              <label className="etiket text-xs">Sebep (isteğe bağlı)</label>
              <input
                name="aciklama"
                defaultValue={satir.aciklama ?? ''}
                placeholder="ör. kardeş indirimi, veli talebi"
                className="girdi !py-1.5"
              />
            </div>
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
            <p className="w-full text-xs text-solgun">
              Okul planındaki değerlerle aynı bırakırsan istisna kaldırılır.
            </p>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className={ozel ? 'bg-amber-50/50' : ''}>
      <td className="font-medium">
        {satir.ad}
        {satir.aciklama && (
          <span className="ml-2 text-xs font-normal text-solgun">({satir.aciklama})</span>
        )}
      </td>
      <td className="whitespace-nowrap">
        {tarihBicim(satir.vade_tarihi)}
        {satir.ozel_vade && (
          <span className="ml-2 text-xs text-solgun line-through">
            {tarihBicim(satir.okul_vade)}
          </span>
        )}
      </td>
      <td className="text-right tabular-nums">
        {para(satir.tutar)}
        {satir.ozel_tutar && (
          <span className="ml-2 text-xs text-solgun line-through">
            {para(satir.okul_tutar)}
          </span>
        )}
      </td>
      <td>
        {ozel ? (
          <span className="rozet bg-amber-100 text-amber-800">öğrenciye özel</span>
        ) : (
          <span className="rozet bg-slate-100 text-slate-600">okul planı</span>
        )}
      </td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        {ozel && (
          <>
            <span className="mx-2 text-cizgi">|</span>
            <button
              type="button"
              disabled={siliniyor}
              onClick={async () => {
                if (!confirm(`"${satir.ad}" okul planına döndürülsün mü?`)) return
                setSiliniyor(true)
                try {
                  await ogrenciTaksitVarsayilana(studentId, satir.taksit_plani_id)
                } finally {
                  setSiliniyor(false)
                }
              }}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {siliniyor ? 'Siliniyor…' : 'Varsayılana dön'}
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

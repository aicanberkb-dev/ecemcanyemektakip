'use client'

import { useActionState, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import type { OgrenciTaksitSatiri } from '@/lib/types'

import {
  ogrenciTaksitEkstraEkle,
  ogrenciTaksitEkstraGuncelle,
  ogrenciTaksitEkstraSil,
  ogrenciTaksitGuncelle,
  ogrenciTaksitVarsayilana,
  type TaksitIstisnaDurumu,
} from './taksit-actions'

export function TaksitBolumu({
  studentId,
  sezonId,
  sezonAdi,
  satirlar,
}: {
  studentId: string
  sezonId: string
  sezonAdi: string
  satirlar: OgrenciTaksitSatiri[]
}) {
  const [ekleAcik, setEkleAcik] = useState(false)
  const ekleEylem = ogrenciTaksitEkstraEkle.bind(null, studentId, sezonId)
  const [ekleDurum, ekleGonder, ekleBekliyor] = useActionState(
    ekleEylem,
    {} as TaksitIstisnaDurumu,
  )

  const toplam = satirlar.reduce((t, s) => t + Number(s.tutar), 0)
  const okulSatirlari = satirlar.filter((s) => !s.ekstra)
  const okulToplami = okulSatirlari.reduce((t, s) => t + Number(s.okul_tutar ?? 0), 0)
  const ozelVar = satirlar.some((s) => s.ozel_tutar || s.ozel_vade || s.ekstra)

  if (ekleDurum.basari && ekleAcik) setEkleAcik(false)

  return (
    <div className="space-y-3">
      <p className="text-sm text-solgun">
        Okul planı varsayılan gelir. Bir tutarı veya tarihi değiştirirsen{' '}
        <strong className="text-metin">yalnızca o satır</strong> bu öğrenciye özel olur.
        Veliyle daha fazla taksite anlaşıldıysa aşağıdan yeni taksit ekleyebilirsin.
      </p>

      {satirlar.length === 0 ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {sezonAdi} sezonu için okul taksit planı tanımlı değil. Ayarlar sayfasından
          tanımlayabilir ya da aşağıdan bu öğrenciye özel taksit ekleyebilirsin.
        </p>
      ) : (
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
                <TaksitSatiri
                  key={s.taksit_plani_id ?? s.istisna_id}
                  studentId={studentId}
                  satir={s}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  {sezonAdi} sezon toplamı · {satirlar.length} taksit
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
      )}

      {ekleAcik ? (
        <form action={ekleGonder} className="flex flex-wrap items-end gap-3 rounded-md border border-cizgi bg-slate-50 p-3">
          <div>
            <label className="etiket text-xs">Taksit adı</label>
            <input name="ad" placeholder="ör. 4. Taksit" className="girdi !py-1.5" required />
            {ekleDurum.alanlar?.ad && <p className="hata">{ekleDurum.alanlar.ad}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Vade</label>
            <input type="date" name="vade_tarihi" className="girdi !py-1.5" required />
            {ekleDurum.alanlar?.vade_tarihi && (
              <p className="hata">{ekleDurum.alanlar.vade_tarihi}</p>
            )}
          </div>
          <div>
            <label className="etiket text-xs">Tutar (₺)</label>
            <input
              name="tutar"
              inputMode="decimal"
              placeholder="5.000,00"
              className="girdi !py-1.5 w-36"
              required
            />
            {ekleDurum.alanlar?.tutar && <p className="hata">{ekleDurum.alanlar.tutar}</p>}
          </div>
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Sebep (isteğe bağlı)</label>
            <input
              name="aciklama"
              placeholder="ör. veliyle 6 taksite anlaşıldı"
              className="girdi !py-1.5"
            />
          </div>
          <button className="btn-birincil !py-1.5" disabled={ekleBekliyor}>
            {ekleBekliyor ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <button
            type="button"
            onClick={() => setEkleAcik(false)}
            className="btn-ikincil !py-1.5"
          >
            Vazgeç
          </button>
          {ekleDurum.hata && <p className="hata w-full">{ekleDurum.hata}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setEkleAcik(true)} className="btn-ikincil">
          + Bu öğrenciye taksit ekle
        </button>
      )}
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

  const eylem = satir.ekstra
    ? ogrenciTaksitEkstraGuncelle.bind(null, studentId, satir.istisna_id!)
    : ogrenciTaksitGuncelle.bind(null, studentId, satir.taksit_plani_id!)

  const [durum, gonder, bekliyor] = useActionState(eylem, {} as TaksitIstisnaDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  const ozel = satir.ozel_tutar || satir.ozel_vade

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={5} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            {satir.ekstra ? (
              <div>
                <label className="etiket text-xs">Taksit adı</label>
                <input name="ad" defaultValue={satir.ad} className="girdi !py-1.5" />
              </div>
            ) : (
              <div className="font-medium">{satir.ad}</div>
            )}
            <div>
              <label className="etiket text-xs">Vade</label>
              <input
                type="date"
                name="vade_tarihi"
                defaultValue={satir.vade_tarihi}
                className="girdi !py-1.5"
              />
              {satir.okul_vade && (
                <p className="mt-1 text-xs text-solgun">Okul: {tarihBicim(satir.okul_vade)}</p>
              )}
            </div>
            <div>
              <label className="etiket text-xs">Tutar (₺)</label>
              <input
                name="tutar"
                inputMode="decimal"
                defaultValue={String(satir.tutar).replace('.', ',')}
                className="girdi !py-1.5 w-36"
              />
              {satir.okul_tutar !== null && (
                <p className="mt-1 text-xs text-solgun">Okul: {para(satir.okul_tutar)}</p>
              )}
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
            {!satir.ekstra && (
              <p className="w-full text-xs text-solgun">
                Okul planındaki değerlerle aynı bırakırsan istisna kaldırılır.
              </p>
            )}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className={ozel || satir.ekstra ? 'bg-amber-50/50' : ''}>
      <td className="font-medium">
        {satir.ad}
        {satir.aciklama && (
          <span className="ml-2 text-xs font-normal text-solgun">({satir.aciklama})</span>
        )}
      </td>
      <td className="whitespace-nowrap">
        {tarihBicim(satir.vade_tarihi)}
        {satir.ozel_vade && satir.okul_vade && (
          <span className="ml-2 text-xs text-solgun line-through">
            {tarihBicim(satir.okul_vade)}
          </span>
        )}
      </td>
      <td className="text-right tabular-nums">
        {para(satir.tutar)}
        {satir.ozel_tutar && satir.okul_tutar !== null && (
          <span className="ml-2 text-xs text-solgun line-through">
            {para(satir.okul_tutar)}
          </span>
        )}
      </td>
      <td>
        {satir.ekstra ? (
          <span className="rozet bg-purple-100 text-purple-800">ek taksit</span>
        ) : ozel ? (
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
        {(ozel || satir.ekstra) && (
          <>
            <span className="mx-2 text-cizgi">|</span>
            <button
              type="button"
              disabled={siliniyor}
              onClick={async () => {
                const soru = satir.ekstra
                  ? `"${satir.ad}" taksiti bu öğrenciden silinsin mi?`
                  : `"${satir.ad}" okul planına döndürülsün mü?`
                if (!confirm(soru)) return
                setSiliniyor(true)
                try {
                  if (satir.ekstra) {
                    await ogrenciTaksitEkstraSil(studentId, satir.istisna_id!)
                  } else {
                    await ogrenciTaksitVarsayilana(studentId, satir.taksit_plani_id!)
                  }
                } finally {
                  setSiliniyor(false)
                }
              }}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {siliniyor ? 'Siliniyor…' : satir.ekstra ? 'Sil' : 'Varsayılana dön'}
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

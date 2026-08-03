'use client'

import { useActionState, useState } from 'react'

import { tarih as tarihBicim } from '@/lib/format'
import { onerilenSezon } from '@/lib/sezon'
import type { Sezon } from '@/lib/types'

import { sezonEkle, sezonGuncelle, sezonSil, type AyarDurumu } from './actions'

export function SezonBolumu({ sezonlar }: { sezonlar: Sezon[] }) {
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(sezonEkle, {} as AyarDurumu)

  if (durum.basari && acik) setAcik(false)

  const bugun = new Date().toISOString().slice(0, 10)
  const oneri = onerilenSezon(new Date().getMonth() + 1 >= 9
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1)

  return (
    <div className="space-y-4">
      <p className="text-sm text-solgun">
        Okul yılı takvim yılıyla örtüşmez. Taksitler yıla değil sezona bağlanır;
        tahsilat da sezonun tarih aralığında sayılır. Böylece Ocak&apos;ta yapılan ödeme
        Eylül&apos;de başlayan sezona doğru işlenir.
      </p>

      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Sezon</th>
              <th>Başlangıç</th>
              <th>Bitiş (tahsilat penceresi)</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sezonlar.map((s) => (
              <SezonSatiri key={s.id} sezon={s} bugun={bugun} />
            ))}
            {sezonlar.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-solgun">
                  Sezon tanımlı değil. Taksit planı girebilmek için önce sezon ekleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {acik ? (
        <form action={gonder} className="flex flex-wrap items-end gap-3 border-t border-cizgi pt-4">
          <div>
            <label className="etiket text-xs">Sezon adı</label>
            <input name="ad" defaultValue={oneri.ad} className="girdi !py-1.5 w-36" required />
            {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Başlangıç</label>
            <input
              type="date"
              name="baslangic"
              defaultValue={oneri.baslangic}
              className="girdi !py-1.5"
              required
            />
            {durum.alanlar?.baslangic && <p className="hata">{durum.alanlar.baslangic}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Bitiş</label>
            <input
              type="date"
              name="bitis"
              defaultValue={oneri.bitis}
              className="girdi !py-1.5"
              required
            />
            {durum.alanlar?.bitis && <p className="hata">{durum.alanlar.bitis}</p>}
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : 'Sezon Ekle'}
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          <p className="w-full text-xs text-solgun">
            Bitiş tarihini dersler bittikten sonrasına almak, yaz aylarında yapılan geç
            ödemelerin doğru sezona sayılmasını sağlar.
          </p>
        </form>
      ) : (
        <button type="button" onClick={() => setAcik(true)} className="btn-ikincil">
          + Sezon Ekle
        </button>
      )}
    </div>
  )
}

function SezonSatiri({ sezon, bugun }: { sezon: Sezon; bugun: string }) {
  const [duzenle, setDuzenle] = useState(false)
  const [siliniyor, setSiliniyor] = useState(false)
  const eylem = sezonGuncelle.bind(null, sezon.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as AyarDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  const guncelMi = sezon.baslangic <= bugun && bugun <= sezon.bitis

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={5} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Ad</label>
              <input name="ad" defaultValue={sezon.ad} className="girdi !py-1.5 w-36" />
            </div>
            <div>
              <label className="etiket text-xs">Başlangıç</label>
              <input
                type="date"
                name="baslangic"
                defaultValue={sezon.baslangic}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Bitiş</label>
              <input
                type="date"
                name="bitis"
                defaultValue={sezon.bitis}
                className="girdi !py-1.5"
              />
              {durum.alanlar?.bitis && <p className="hata">{durum.alanlar.bitis}</p>}
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
      <td className="font-medium">{sezon.ad}</td>
      <td>{tarihBicim(sezon.baslangic)}</td>
      <td>{tarihBicim(sezon.bitis)}</td>
      <td>
        {guncelMi ? (
          <span className="rozet bg-emerald-100 text-emerald-800">güncel sezon</span>
        ) : sezon.bitis < bugun ? (
          <span className="rozet bg-slate-100 text-slate-600">geçmiş</span>
        ) : (
          <span className="rozet bg-blue-100 text-blue-800">gelecek</span>
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
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          disabled={siliniyor}
          onClick={async () => {
            if (
              !confirm(
                `"${sezon.ad}" sezonu ve bu sezona ait TÜM taksit satırları silinecek. Emin misiniz?`,
              )
            )
              return
            setSiliniyor(true)
            try {
              await sezonSil(sezon.id)
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

'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { bugunISO, para, tarih as tarihBicim } from '@/lib/format'

import {
  hizmetFiyatiEkle,
  hizmetFiyatiSil,
  hizmetNoktasiEkle,
  hizmetNoktasiGuncelle,
  hizmetNoktasiSil,
  type MaliyetDurumu,
} from '../actions'

export type HizmetNoktasi = {
  id: string
  ad: string
  liste_id: string | null
  aktif: boolean
  sira: number
}

export type HizmetFiyati = {
  id: string
  hizmet_noktasi_id: string
  gecerli_baslangic: string
  kisi_basi_fiyat: number | string
}

export type ListeSecenegi = { id: string; ad: string }

/**
 * Hizmet yerleri ve satış fiyatları.
 *
 * Fiyat tarihe bağlı tutuluyor: sözleşme fiyatı yıl içinde değişince geçmiş
 * ayların kâr/zararı bozulmasın diye. Her yer bir menü listesine bağlanır —
 * maliyet o listenin o günkü menüsünden hesaplanır.
 */
export function YerlerEkrani({
  noktalar,
  fiyatlar,
  listeler,
}: {
  noktalar: HizmetNoktasi[]
  fiyatlar: HizmetFiyati[]
  listeler: ListeSecenegi[]
}) {
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(hizmetNoktasiEkle, {} as MaliyetDurumu)

  if (durum.basari && acik) setAcik(false)

  return (
    <div className="space-y-4">
      {noktalar.map((n) => (
        <Nokta
          key={n.id}
          nokta={n}
          fiyatlar={fiyatlar.filter((f) => f.hizmet_noktasi_id === n.id)}
          listeler={listeler}
        />
      ))}

      {acik ? (
        <form action={gonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <label className="etiket text-xs">Yer adı</label>
            <input name="ad" placeholder="ör. BEYKOZ ANADOLU LİSESİ" className="girdi !py-1.5" />
            {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Yediği menü</label>
            <select name="liste_id" defaultValue="" className="girdi !py-1.5">
              <option value="">— seçilmedi —</option>
              {listeler.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.ad}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setAcik(true)} className="btn-ikincil">
          + Yer Ekle
        </button>
      )}
    </div>
  )
}

function Nokta({
  nokta,
  fiyatlar,
  listeler,
}: {
  nokta: HizmetNoktasi
  fiyatlar: HizmetFiyati[]
  listeler: ListeSecenegi[]
}) {
  const router = useRouter()
  const [duzenle, setDuzenle] = useState(false)
  const [fiyatAcik, setFiyatAcik] = useState(false)

  const guncelle = hizmetNoktasiGuncelle.bind(null, nokta.id)
  const [durum, gonder, bekliyor] = useActionState(guncelle, {} as MaliyetDurumu)

  const fiyatEkle = hizmetFiyatiEkle.bind(null, nokta.id)
  const [fDurum, fGonder, fBekliyor] = useActionState(fiyatEkle, {} as MaliyetDurumu)

  if (durum.basari && duzenle) setDuzenle(false)
  if (fDurum.basari && fiyatAcik) setFiyatAcik(false)

  const bugun = bugunISO()
  const gecerli = fiyatlar.find((f) => f.gecerli_baslangic <= bugun)
  const liste = listeler.find((l) => l.id === nokta.liste_id)

  return (
    <section className="kart p-4">
      {duzenle ? (
        <form action={gonder} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="etiket text-xs">Yer adı</label>
            <input name="ad" defaultValue={nokta.ad} className="girdi !py-1.5" />
          </div>
          <div>
            <label className="etiket text-xs">Yediği menü</label>
            <select
              name="liste_id"
              defaultValue={nokta.liste_id ?? ''}
              className="girdi !py-1.5"
            >
              <option value="">— seçilmedi —</option>
              {listeler.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.ad}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            Kaydet
          </button>
          <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-semibold">{nokta.ad}</h2>
            <p className="text-xs text-solgun">
              Menü:{' '}
              {liste ? (
                <strong>{liste.ad}</strong>
              ) : (
                <span className="text-amber-700">seçilmemiş</span>
              )}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-solgun">Güncel satış fiyatı</p>
            <p className="text-lg font-bold tabular-nums">
              {gecerli ? para(gecerli.kisi_basi_fiyat) : '—'}
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setDuzenle(true)}
              className="text-vurgu hover:underline"
            >
              Düzelt
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  !confirm(
                    `${nokta.ad} silinecek.\nBu yerin fiyat geçmişi ve girilmiş kişi sayıları da silinir. Emin misiniz?`,
                  )
                )
                  return
                const s = await hizmetNoktasiSil(nokta.id)
                if (s.hata) alert(s.hata)
                else router.refresh()
              }}
              className="text-red-600 hover:underline"
            >
              Sil
            </button>
          </div>
        </div>
      )}

      {/* Fiyat geçmişi */}
      <div className="mt-3 border-t border-cizgi pt-3">
        {fiyatlar.length > 0 && (
          <table className="tablo">
            <thead>
              <tr>
                <th>Geçerlilik başlangıcı</th>
                <th className="text-right">Kişi başı fiyat</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {fiyatlar.map((f) => (
                <tr key={f.id} className={f.id === gecerli?.id ? 'bg-emerald-50/50' : undefined}>
                  <td>
                    {tarihBicim(f.gecerli_baslangic)}
                    {f.id === gecerli?.id && (
                      <span className="rozet ml-2 bg-emerald-100 text-emerald-800">
                        şu an geçerli
                      </span>
                    )}
                    {f.gecerli_baslangic > bugun && (
                      <span className="rozet ml-2 bg-blue-100 text-blue-800">ileri tarihli</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{para(f.kisi_basi_fiyat)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Bu fiyat satırı silinecek. Emin misiniz?')) return
                        const s = await hizmetFiyatiSil(f.id)
                        if (s.hata) alert(s.hata)
                        else router.refresh()
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {fiyatAcik ? (
          <form action={fGonder} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Geçerlilik başlangıcı</label>
              <input
                type="date"
                name="gecerli_baslangic"
                defaultValue={bugun}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Kişi başı fiyat (₺)</label>
              <input
                name="kisi_basi_fiyat"
                inputMode="decimal"
                className="girdi !py-1.5 w-32"
                defaultValue={gecerli ? String(gecerli.kisi_basi_fiyat).replace('.', ',') : ''}
              />
              {fDurum.alanlar?.kisi_basi_fiyat && (
                <p className="hata">{fDurum.alanlar.kisi_basi_fiyat}</p>
              )}
            </div>
            <button className="btn-birincil !py-1.5" disabled={fBekliyor}>
              {fBekliyor ? 'Kaydediliyor…' : 'Fiyat Ekle'}
            </button>
            <button
              type="button"
              onClick={() => setFiyatAcik(false)}
              className="btn-ikincil !py-1.5"
            >
              Vazgeç
            </button>
            {fDurum.hata && <p className="hata w-full">{fDurum.hata}</p>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setFiyatAcik(true)}
            className="mt-2 text-sm text-vurgu hover:underline"
          >
            + Fiyat ekle / değiştir
          </button>
        )}
      </div>
    </section>
  )
}

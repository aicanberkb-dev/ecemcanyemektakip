'use client'

import Link from 'next/link'
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
  okul_id: string | null
  varsayilan_kisi_sayisi: number
  varsayilan_cikan_porsiyon: number
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
 * Okula bağlı yerlerde (GÖKSU, AHMET MİTHAT) fiyat ayarlardaki ücret
 * tarifesinden okunur ve yiyen kişi sayısı gün sonundan gelir — aynı bilgiyi
 * ikinci kez girmek iki kaynağın çatışması olurdu. Dışarıdaki yerlerde fiyat
 * tarihe bağlı olarak burada tutulur; sözleşme fiyatı değişince geçmiş ayların
 * kâr/zararı bozulmasın diye.
 *
 * Çıkan porsiyon her yer için burada tanımlanır: maliyetin tabanı yiyen kişi
 * değil, yemekhaneden gönderilen yemektir.
 */
export function YerlerEkrani({
  noktalar,
  fiyatlar,
  listeler,
  okulTarifesi,
}: {
  noktalar: HizmetNoktasi[]
  fiyatlar: HizmetFiyati[]
  listeler: ListeSecenegi[]
  /** okul_id → o okulun güncel taban günlük ücreti */
  okulTarifesi: Record<string, number>
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
          okulFiyati={n.okul_id ? okulTarifesi[n.okul_id] : undefined}
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
          <div>
            <label className="etiket text-xs">Çıkan porsiyon</label>
            <input
              name="varsayilan_cikan_porsiyon"
              inputMode="numeric"
              defaultValue="0"
              className="girdi !py-1.5 w-28"
            />
          </div>
          <div>
            <label className="etiket text-xs">Faturalanan kişi</label>
            <input
              name="varsayilan_kisi_sayisi"
              inputMode="numeric"
              defaultValue="0"
              className="girdi !py-1.5 w-28"
            />
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
  okulFiyati,
}: {
  nokta: HizmetNoktasi
  fiyatlar: HizmetFiyati[]
  listeler: ListeSecenegi[]
  okulFiyati: number | undefined
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
  const okulaBagli = !!nokta.okul_id

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
          {/* Okullarda porsiyon tahmin edilmiyor; gerçek sayı her gün
              Kâr/Zarar ekranından yemek bazında giriliyor. */}
          <div>
            <label className="etiket text-xs">
              {okulaBagli ? 'Çıkan porsiyon (kullanılmıyor)' : 'Çıkan porsiyon'}
            </label>
            <input
              name="varsayilan_cikan_porsiyon"
              inputMode="numeric"
              defaultValue={String(nokta.varsayilan_cikan_porsiyon)}
              disabled={okulaBagli}
              className="girdi !py-1.5 w-28 disabled:bg-slate-100 disabled:text-solgun"
            />
          </div>
          <div>
            <label className="etiket text-xs">
              {okulaBagli ? 'Faturalanan (kullanılmıyor)' : 'Faturalanan kişi'}
            </label>
            <input
              name="varsayilan_kisi_sayisi"
              inputMode="numeric"
              defaultValue={String(nokta.varsayilan_kisi_sayisi)}
              disabled={okulaBagli}
              className="girdi !py-1.5 w-28 disabled:bg-slate-100 disabled:text-solgun"
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
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              {nokta.ad}
              {okulaBagli ? (
                <span className="rozet bg-blue-100 text-blue-800">bizim okulumuz</span>
              ) : (
                <span className="rozet bg-slate-100 text-slate-700">dış hizmet</span>
              )}
            </h2>
            <p className="text-xs text-solgun">
              Menü:{' '}
              {liste ? (
                <strong>{liste.ad}</strong>
              ) : (
                <span className="text-amber-700">seçilmemiş</span>
              )}
              {!okulaBagli && (
                <>
                  {' · '}Faturalanan:{' '}
                  <strong>{nokta.varsayilan_kisi_sayisi || 'girilmemiş'}</strong>
                </>
              )}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-solgun">Günde çıkan porsiyon</p>
            <p className="text-lg font-bold tabular-nums">
              {okulaBagli ? (
                <span className="text-sm font-normal text-solgun">gün gün girilir</span>
              ) : (
                nokta.varsayilan_cikan_porsiyon || (
                  <span className="text-sm font-normal text-amber-700">girilmemiş</span>
                )
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-solgun">
              {okulaBagli ? 'Tarifeden gelen günlük ücret' : 'Güncel satış fiyatı'}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {okulaBagli
                ? okulFiyati !== undefined
                  ? para(okulFiyati)
                  : '—'
                : gecerli
                  ? para(gecerli.kisi_basi_fiyat)
                  : '—'}
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

      {/* Fiyat: okula bağlıysa tarifeden, değilse elle */}
      <div className="mt-3 border-t border-cizgi pt-3">
        {okulaBagli ? (
          <p className="text-sm text-solgun">
            Bu yerin satış fiyatı{' '}
            <Link href="/admin/settings" className="text-vurgu hover:underline">
              Ayarlar → Ücret Tarifeleri
            </Link>
            &apos;nden okunur, <strong>yiyen</strong> kişi sayısı da gün sonu kayıtlarından
            gelir. Burada elle fiyat girilmez — iki yerde tutulup birbirinden ayrı düşmesin.
            Çıkan porsiyon da tahmin edilmez:{' '}
            <Link href="/maliyet/kar-zarar" className="text-vurgu hover:underline">
              Kâr/Zarar
            </Link>{' '}
            ekranında gün gün, yemek yemek girilir.
          </p>
        ) : (
          <>
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
                    <tr
                      key={f.id}
                      className={f.id === gecerli?.id ? 'bg-emerald-50/50' : undefined}
                    >
                      <td>
                        {tarihBicim(f.gecerli_baslangic)}
                        {f.id === gecerli?.id && (
                          <span className="rozet ml-2 bg-emerald-100 text-emerald-800">
                            şu an geçerli
                          </span>
                        )}
                        {f.gecerli_baslangic > bugun && (
                          <span className="rozet ml-2 bg-blue-100 text-blue-800">
                            ileri tarihli
                          </span>
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
                    defaultValue={
                      gecerli ? String(gecerli.kisi_basi_fiyat).replace('.', ',') : ''
                    }
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
          </>
        )}
      </div>
    </section>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, para } from '@/lib/format'

import { gunlukHizmetKaydet, type MaliyetDurumu } from '../actions'

export type GunlukKisi = { tarih: string; kisi_sayisi: number }
export type GunMaliyeti = { tarih: string; ozet: string | null; maliyet: number | string }

const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

/**
 * Bir yerin bir aylık kişi sayıları.
 *
 * Yanına o günün menüsü ve kişi başı maliyeti yazılıyor: sayı yanlış
 * girildiğinde tutar sırıtsın diye. Kaydetmeden önce ayın toplamı da altta
 * görünür.
 */
export function KisiSayisiEkrani({
  noktaId,
  noktaAdi,
  listesizMi,
  yil,
  ay,
  kisiler,
  gunMaliyetleri,
}: {
  noktaId: string
  noktaAdi: string
  listesizMi: boolean
  yil: number
  ay: number
  kisiler: GunlukKisi[]
  gunMaliyetleri: GunMaliyeti[]
}) {
  const router = useRouter()
  const [durum, setDurum] = useState<MaliyetDurumu>({})
  const [kaydediliyor, basla] = useTransition()

  const maliyetHaritasi = useMemo(() => {
    const m = new Map<string, GunMaliyeti>()
    for (const g of gunMaliyetleri) m.set(g.tarih, g)
    return m
  }, [gunMaliyetleri])

  const baslangic = useMemo(() => {
    const mevcut = new Map(kisiler.map((k) => [k.tarih, k.kisi_sayisi]))
    const gunSayisi = new Date(yil, ay, 0).getDate()
    const liste: { tarih: string; deger: string }[] = []
    for (let g = 1; g <= gunSayisi; g++) {
      const h = new Date(yil, ay - 1, g).getDay()
      if (h === 0 || h === 6) continue // hafta sonu yemek yok
      const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
      const v = mevcut.get(tarih)
      liste.push({ tarih, deger: v ? String(v) : '' })
    }
    return liste
  }, [kisiler, yil, ay])

  const [satirlar, setSatirlar] = useState(baslangic)
  const [topluDeger, setTopluDeger] = useState('')

  const toplamKisi = satirlar.reduce((t, s) => t + (Number(s.deger) || 0), 0)
  const toplamMaliyet = satirlar.reduce((t, s) => {
    const kisi = Number(s.deger) || 0
    return t + kisi * Number(maliyetHaritasi.get(s.tarih)?.maliyet ?? 0)
  }, 0)

  function yaz(tarih: string, deger: string) {
    setSatirlar((o) => o.map((s) => (s.tarih === tarih ? { ...s, deger } : s)))
    setDurum({})
  }

  /** Menüsü olan tüm günlere aynı sayıyı yazar — çoğu ay tek sayı yeter. */
  function hepsineUygula() {
    const n = topluDeger.trim()
    setSatirlar((o) =>
      o.map((s) => (maliyetHaritasi.has(s.tarih) || !listesizMi ? { ...s, deger: n } : s)),
    )
    setDurum({})
  }

  function kaydet() {
    basla(async () => {
      const s = await gunlukHizmetKaydet(
        noktaId,
        satirlar.map((x) => ({ tarih: x.tarih, kisi_sayisi: Number(x.deger) || 0 })),
      )
      setDurum(s)
      if (s.basari) router.refresh()
    })
  }

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-semibold">
            {noktaAdi} — {AY_ADLARI[ay - 1]} {yil} kişi sayıları
          </h2>
          <p className="text-xs text-solgun">
            Yalnızca hafta içi günler. Boş ya da 0 bırakılan gün “hizmet verilmedi”
            sayılır.
          </p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="etiket text-xs">Tüm günlere yaz</label>
            <input
              value={topluDeger}
              onChange={(e) => setTopluDeger(e.target.value)}
              inputMode="numeric"
              placeholder="ör. 120"
              className="girdi !py-1.5 w-24"
            />
          </div>
          <button type="button" onClick={hepsineUygula} className="btn-ikincil !py-1.5">
            Uygula
          </button>
          <button
            type="button"
            onClick={kaydet}
            disabled={kaydediliyor}
            className="btn-birincil !py-1.5"
          >
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {durum.basari && (
        <p className="mt-2 text-sm font-medium text-emerald-700">{durum.basari}</p>
      )}
      {durum.hata && <p className="hata mt-2">{durum.hata}</p>}

      {listesizMi && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yere menü listesi bağlanmamış; günlük maliyet hesaplanamıyor.{' '}
          <strong>Hizmet Yerleri</strong> sekmesinden bir menü seçin.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="w-24">Gün</th>
              <th className="w-28 text-right">Kişi</th>
              <th className="text-right">Kişi başı maliyet</th>
              <th className="text-right">Günün maliyeti</th>
              <th>Menü</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const d = new Date(s.tarih)
              const gm = maliyetHaritasi.get(s.tarih)
              const kisi = Number(s.deger) || 0
              const birim = Number(gm?.maliyet ?? 0)
              return (
                <tr key={s.tarih}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                  </td>
                  <td className="text-right">
                    <input
                      value={s.deger}
                      onChange={(e) => yaz(s.tarih, e.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      placeholder="—"
                      className={`w-24 rounded border px-2 py-1 text-right text-sm tabular-nums
                                  outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100
                                  ${s.deger ? 'border-cizgi bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}
                    />
                  </td>
                  <td className="text-right tabular-nums text-solgun">
                    {gm ? para(birim) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {kisi > 0 && gm ? para(kisi * birim) : '—'}
                  </td>
                  <td className="text-xs text-solgun">{gm?.ozet ?? 'menü girilmemiş'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Toplam</td>
              <td className="text-right font-semibold tabular-nums">{toplamKisi}</td>
              <td />
              <td className="text-right font-bold tabular-nums">{para(toplamMaliyet)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

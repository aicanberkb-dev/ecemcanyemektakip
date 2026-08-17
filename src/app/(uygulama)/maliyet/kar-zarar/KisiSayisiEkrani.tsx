'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, para } from '@/lib/format'

import { gunlukHizmetKaydet, type MaliyetDurumu } from '../actions'

export type GunlukKisi = { tarih: string; kisi_sayisi: number }
export type GunMaliyeti = { tarih: string; ozet: string | null; maliyet: number | string }
export type OkulGunu = {
  tarih: string
  kisi: number
  misafir: number
  ciro: number | string
}

const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

/**
 * Bir yerin bir aylık kişi sayıları ve o ayın maliyeti.
 *
 * Okula bağlı yerlerde sayılar gün sonu kayıtlarından geliyor ve elle
 * değiştirilmiyor — kasada okutulan öğün zaten tek doğru kaynak. Dış hizmet
 * yerlerinde sayı genelde sabit: yerin varsayılan kişi sayısı her güne
 * otomatik yazılır, farklı olan günü elle düzeltmek yeterli.
 */
export function KisiSayisiEkrani({
  noktaId,
  noktaAdi,
  okulaBagliMi,
  varsayilanKisi,
  listesizMi,
  yil,
  ay,
  kisiler,
  gunMaliyetleri,
  okulGunleri,
}: {
  noktaId: string
  noktaAdi: string
  okulaBagliMi: boolean
  varsayilanKisi: number
  listesizMi: boolean
  yil: number
  ay: number
  kisiler: GunlukKisi[]
  gunMaliyetleri: GunMaliyeti[]
  okulGunleri: OkulGunu[]
}) {
  const router = useRouter()
  const [durum, setDurum] = useState<MaliyetDurumu>({})
  const [kaydediliyor, basla] = useTransition()

  const maliyetHaritasi = useMemo(() => {
    const m = new Map<string, GunMaliyeti>()
    for (const g of gunMaliyetleri) m.set(g.tarih, g)
    return m
  }, [gunMaliyetleri])

  // Girilmiş satır: değer boş string ise kayıt yok (varsayılan geçerli)
  const baslangic = useMemo(() => {
    const mevcut = new Map(kisiler.map((k) => [k.tarih, k.kisi_sayisi]))
    const gunSayisi = new Date(yil, ay, 0).getDate()
    const liste: { tarih: string; deger: string }[] = []
    for (let g = 1; g <= gunSayisi; g++) {
      const h = new Date(yil, ay - 1, g).getDay()
      if (h === 0 || h === 6) continue // hafta sonu yemek yok
      const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
      const v = mevcut.get(tarih)
      liste.push({ tarih, deger: v === undefined ? '' : String(v) })
    }
    return liste
  }, [kisiler, yil, ay])

  const [satirlar, setSatirlar] = useState(baslangic)

  function yaz(tarih: string, deger: string) {
    setSatirlar((o) => o.map((s) => (s.tarih === tarih ? { ...s, deger } : s)))
    setDurum({})
  }

  function kaydet() {
    basla(async () => {
      const s = await gunlukHizmetKaydet(
        noktaId,
        satirlar.map((x) => ({
          tarih: x.tarih,
          kisi_sayisi: x.deger.trim() === '' ? null : Number(x.deger),
        })),
      )
      setDurum(s)
      if (s.basari) router.refresh()
    })
  }

  // ------------------------------------------------------------------
  // Okula bağlı yer: salt okunur özet
  // ------------------------------------------------------------------
  if (okulaBagliMi) {
    const toplam = okulGunleri.reduce(
      (t, g) => ({
        kisi: t.kisi + Number(g.kisi),
        misafir: t.misafir + Number(g.misafir),
        ciro: t.ciro + Number(g.ciro),
        maliyet:
          t.maliyet +
          (Number(g.kisi) + Number(g.misafir)) *
            Number(maliyetHaritasi.get(g.tarih)?.maliyet ?? 0),
      }),
      { kisi: 0, misafir: 0, ciro: 0, maliyet: 0 },
    )

    return (
      <div className="kart p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-semibold">
              {noktaAdi} — {AY_ADLARI[ay - 1]} {yil}
            </h2>
            <p className="text-xs text-solgun">
              Sayılar{' '}
              <Link href="/reports/gun-sonu" className="text-vurgu hover:underline">
                gün sonu
              </Link>{' '}
              kayıtlarından geliyor, elle girilmiyor. Misafirler parantez içinde; onlardan
              ücret alınmadığı için ciroya dahil değil.
            </p>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="tablo">
            <thead>
              <tr>
                <th className="w-24">Gün</th>
                <th className="w-32 text-right">Kişi (misafir)</th>
                <th className="text-right">Ciro</th>
                <th className="text-right">Kişi başı maliyet</th>
                <th className="text-right">Günün maliyeti</th>
                <th>Menü</th>
              </tr>
            </thead>
            <tbody>
              {okulGunleri.map((g) => {
                const d = new Date(g.tarih)
                const gm = maliyetHaritasi.get(g.tarih)
                const birim = Number(gm?.maliyet ?? 0)
                const yiyen = Number(g.kisi) + Number(g.misafir)
                return (
                  <tr key={g.tarih}>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{d.getDate()}</span>
                      <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {g.kisi}
                      {Number(g.misafir) > 0 && (
                        <span className="font-normal text-solgun"> ({g.misafir})</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{para(g.ciro)}</td>
                    <td className="text-right tabular-nums text-solgun">
                      {gm ? para(birim) : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {gm ? para(yiyen * birim) : '—'}
                    </td>
                    <td className="text-xs text-solgun">{gm?.ozet ?? 'menü girilmemiş'}</td>
                  </tr>
                )
              })}
              {okulGunleri.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-solgun">
                    Bu ayda yemek kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
            {okulGunleri.length > 0 && (
              <tfoot>
                <tr>
                  <td className="font-semibold">Toplam</td>
                  <td className="text-right font-semibold tabular-nums">
                    {toplam.kisi}
                    {toplam.misafir > 0 && (
                      <span className="font-normal text-solgun"> ({toplam.misafir})</span>
                    )}
                  </td>
                  <td className="text-right font-semibold tabular-nums">{para(toplam.ciro)}</td>
                  <td />
                  <td className="text-right font-bold tabular-nums">{para(toplam.maliyet)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Dış hizmet yeri: sabit sayı + gün bazlı düzeltme
  // ------------------------------------------------------------------
  const etkinKisi = (deger: string) => (deger.trim() === '' ? varsayilanKisi : Number(deger) || 0)

  const hizmetGunleri = satirlar.filter((s) => maliyetHaritasi.has(s.tarih) || s.deger !== '')
  const toplamKisi = hizmetGunleri.reduce((t, s) => t + etkinKisi(s.deger), 0)
  const toplamMaliyet = hizmetGunleri.reduce(
    (t, s) => t + etkinKisi(s.deger) * Number(maliyetHaritasi.get(s.tarih)?.maliyet ?? 0),
    0,
  )

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-semibold">
            {noktaAdi} — {AY_ADLARI[ay - 1]} {yil} kişi sayıları
          </h2>
          <p className="text-xs text-solgun">
            Boş bırakılan gün, yerin sabit kişi sayısını (
            <strong>{varsayilanKisi || 'girilmemiş'}</strong>) kullanır. Farklı olan günü
            yazın; o gün hiç yemek verilmediyse <strong>0</strong> yazın.{' '}
            <Link href="/maliyet/yerler" className="text-vurgu hover:underline">
              Sabit sayıyı değiştir
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={kaydet}
          disabled={kaydediliyor}
          className="btn-birincil ml-auto !py-1.5"
        >
          {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      {durum.basari && (
        <p className="mt-2 text-sm font-medium text-emerald-700">{durum.basari}</p>
      )}
      {durum.hata && <p className="hata mt-2">{durum.hata}</p>}

      {varsayilanKisi === 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yerin sabit kişi sayısı girilmemiş; boş bıraktığınız günler 0 kişi sayılır.{' '}
          <Link href="/maliyet/yerler" className="underline">
            Hizmet Yerleri
          </Link>{' '}
          sekmesinden bir kez girin.
        </p>
      )}

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
              <th className="w-36 text-right">Kişi</th>
              <th className="text-right">Kişi başı maliyet</th>
              <th className="text-right">Günün maliyeti</th>
              <th>Menü</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const d = new Date(s.tarih)
              const gm = maliyetHaritasi.get(s.tarih)
              const kisi = etkinKisi(s.deger)
              const birim = Number(gm?.maliyet ?? 0)
              const hizmetVar = !!gm || s.deger !== ''
              return (
                <tr key={s.tarih} className={hizmetVar ? undefined : 'opacity-50'}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        value={s.deger}
                        onChange={(e) => yaz(s.tarih, e.target.value.replace(/[^0-9]/g, ''))}
                        inputMode="numeric"
                        placeholder={String(varsayilanKisi)}
                        className={`w-20 rounded border px-2 py-1 text-right text-sm tabular-nums
                                    outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100
                                    ${
                                      s.deger
                                        ? 'border-cizgi bg-white font-semibold'
                                        : 'border-dashed border-slate-300 bg-slate-50'
                                    }`}
                      />
                      <span className="w-14 text-left text-xs text-solgun">
                        {s.deger === '' ? 'sabit' : 'elle'}
                      </span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums text-solgun">
                    {gm ? para(birim) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {hizmetVar && gm ? para(kisi * birim) : '—'}
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
              <td className="text-xs text-solgun">{hizmetGunleri.length} hizmet günü</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

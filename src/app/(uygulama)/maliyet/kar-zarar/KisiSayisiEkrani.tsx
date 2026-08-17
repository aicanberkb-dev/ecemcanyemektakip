'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, bugunISO, para } from '@/lib/format'

import { gunlukHizmetKaydet, type MaliyetDurumu } from '../actions'

export type GunlukKisi = {
  tarih: string
  kisi_sayisi: number | null
  cikan_porsiyon: number | null
}
export type GunMaliyeti = { tarih: string; ozet: string | null; maliyet: number | string }
export type OkulGunu = {
  tarih: string
  kisi: number
  misafir: number
  ciro: number | string
}

const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

type Satir = {
  tarih: string
  /** Mutfaktan çıkan porsiyon — boş ise yerin varsayılanı geçerli */
  cikan: string
  /** Faturalanan kişi — okula bağlı yerlerde kullanılmaz */
  yiyen: string
}

/**
 * Bir yerin bir aylık çıkan porsiyon ve yiyen kişi sayıları.
 *
 * Maliyetin tabanı çıkan porsiyon: yemek mutfaktan çıktığı anda para
 * harcanmıştır, kaç kişinin yediği bunu değiştirmez. Yiyen kişi ciroyu
 * belirler; okullarda gün sonundan gelir, dış hizmetlerde sözleşme adedidir.
 * Aradaki fark fire.
 *
 * Sabit sayı yalnızca bugüne kadarki hafta içi günlere uygulanır; henüz olmamış
 * günü saymak ayın 17'sinde ay sonu cirosu göstermek olurdu.
 */
export function KisiSayisiEkrani({
  noktaId,
  noktaAdi,
  okulaBagliMi,
  varsayilanKisi,
  varsayilanCikan,
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
  varsayilanCikan: number
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
  const bugun = bugunISO()

  const maliyetHaritasi = useMemo(() => {
    const m = new Map<string, GunMaliyeti>()
    for (const g of gunMaliyetleri) m.set(g.tarih, g)
    return m
  }, [gunMaliyetleri])

  /** Okulun gün sonundan gelen yiyen sayıları */
  const okulHaritasi = useMemo(() => {
    const m = new Map<string, OkulGunu>()
    for (const g of okulGunleri) m.set(g.tarih, g)
    return m
  }, [okulGunleri])

  const baslangic = useMemo(() => {
    const mevcut = new Map(kisiler.map((k) => [k.tarih, k]))
    const gunSayisi = new Date(yil, ay, 0).getDate()
    const liste: Satir[] = []
    for (let g = 1; g <= gunSayisi; g++) {
      const h = new Date(yil, ay - 1, g).getDay()
      const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
      const kayit = mevcut.get(tarih)
      // Hafta sonu yalnızca kayıt varsa listelenir
      if ((h === 0 || h === 6) && !kayit && !okulHaritasi.has(tarih)) continue
      liste.push({
        tarih,
        cikan: kayit?.cikan_porsiyon == null ? '' : String(kayit.cikan_porsiyon),
        yiyen: kayit?.kisi_sayisi == null ? '' : String(kayit.kisi_sayisi),
      })
    }
    return liste
  }, [kisiler, okulHaritasi, yil, ay])

  const [satirlar, setSatirlar] = useState<Satir[]>(baslangic)
  const [topluCikan, setTopluCikan] = useState('')

  function yaz(tarih: string, alan: 'cikan' | 'yiyen', deger: string) {
    setSatirlar((o) => o.map((s) => (s.tarih === tarih ? { ...s, [alan]: deger } : s)))
    setDurum({})
  }

  /** Bugüne kadarki günlere aynı çıkan miktarını yazar. */
  function hepsineUygula() {
    setSatirlar((o) =>
      o.map((s) => (s.tarih <= bugun ? { ...s, cikan: topluCikan.trim() } : s)),
    )
    setDurum({})
  }

  /** Gelecek gün için sayı girilmedikçe hiçbir şey sayılmaz. */
  const etkinCikan = (s: Satir) => {
    if (s.cikan.trim() !== '') return Number(s.cikan) || 0
    if (s.tarih > bugun) return 0
    if (varsayilanCikan > 0) return varsayilanCikan
    // Çıkan bilinmiyor: eksik hesap, yiyen kadar varsayılır
    return etkinYiyen(s)
  }

  const etkinYiyen = (s: Satir) => {
    if (okulaBagliMi) {
      const o = okulHaritasi.get(s.tarih)
      return o ? Number(o.kisi) + Number(o.misafir) : 0
    }
    if (s.yiyen.trim() !== '') return Number(s.yiyen) || 0
    return s.tarih > bugun ? 0 : varsayilanKisi
  }

  const cikanBilinmiyor = (s: Satir) =>
    s.cikan.trim() === '' && varsayilanCikan === 0 && etkinYiyen(s) > 0 && s.tarih <= bugun

  const toplam = satirlar.reduce(
    (t, s) => {
      const cikan = etkinCikan(s)
      const yiyen = etkinYiyen(s)
      const birim = Number(maliyetHaritasi.get(s.tarih)?.maliyet ?? 0)
      return {
        cikan: t.cikan + cikan,
        yiyen: t.yiyen + yiyen,
        maliyet: t.maliyet + cikan * birim,
        fire: t.fire + (cikan - yiyen) * birim,
        ciro: t.ciro + Number(okulHaritasi.get(s.tarih)?.ciro ?? 0),
      }
    },
    { cikan: 0, yiyen: 0, maliyet: 0, fire: 0, ciro: 0 },
  )

  const hizmetGunleri = satirlar.filter((s) => etkinCikan(s) > 0 || etkinYiyen(s) > 0)
  const menusuzGun = hizmetGunleri.filter((s) => !maliyetHaritasi.has(s.tarih)).length
  const cikansizGun = satirlar.filter(cikanBilinmiyor).length

  function kaydet() {
    basla(async () => {
      const s = await gunlukHizmetKaydet(
        noktaId,
        satirlar.map((x) => ({
          tarih: x.tarih,
          cikan_porsiyon: x.cikan.trim() === '' ? null : Number(x.cikan),
          // Okula bağlı yerde yiyen sayısı gün sonundan gelir, yazılmaz
          kisi_sayisi: okulaBagliMi || x.yiyen.trim() === '' ? null : Number(x.yiyen),
        })),
      )
      setDurum(s)
      if (s.basari) router.refresh()
    })
  }

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-semibold">
            {noktaAdi} — {AY_ADLARI[ay - 1]} {yil}
          </h2>
          <p className="max-w-2xl text-xs text-solgun">
            <strong>Çıkan</strong>, mutfaktan o yere gönderilen porsiyondur ve maliyeti
            belirler.{' '}
            {okulaBagliMi ? (
              <>
                <strong>Yiyen</strong> gün sonu kayıtlarından gelir, elle girilmez.
              </>
            ) : (
              <>
                <strong>Yiyen</strong> faturaladığınız kişi sayısıdır.
              </>
            )}{' '}
            Boş bıraktığınız gün yerin sabit değerini kullanır, ileri tarihler gün geldikçe
            eklenir.{' '}
            <Link href="/maliyet/yerler" className="text-vurgu hover:underline">
              Sabit değerleri değiştir
            </Link>
          </p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="etiket text-xs">Tüm günlere çıkan</label>
            <input
              value={topluCikan}
              onChange={(e) => setTopluCikan(e.target.value.replace(/[^0-9]/g, ''))}
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

      {cikansizGun > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>{cikansizGun}</strong> günün çıkan porsiyonu bilinmiyor; o günlerde maliyet
          yiyen kişiden hesaplandı ve fire görünmüyor. Sabit çıkan porsiyonu bir kez girmeniz
          yeter.
        </p>
      )}

      {!okulaBagliMi && varsayilanKisi === 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yerin faturalanan kişi sayısı girilmemiş; ciro 0 çıkar.{' '}
          <Link href="/maliyet/yerler" className="underline">
            Hizmet Yerleri
          </Link>{' '}
          sekmesinden bir kez girin.
        </p>
      )}

      {listesizMi ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yere menü listesi bağlanmamış; günlük maliyet hesaplanamıyor.{' '}
          <strong>Hizmet Yerleri</strong> sekmesinden bir menü seçin.
        </p>
      ) : (
        menusuzGun > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Hizmet verilen <strong>{menusuzGun}</strong> günün menüsü girilmemiş; o günlerin
            maliyeti 0 ₺ sayılıyor.{' '}
            <Link href="/menu" className="underline">
              Yemek listesinden girin
            </Link>
            .
          </p>
        )
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="w-28">Gün</th>
              <th className="w-36 text-right">Çıkan</th>
              <th className="w-36 text-right">Yiyen</th>
              <th className="text-right">Fire</th>
              <th className="text-right">Kişi başı maliyet</th>
              <th className="text-right">Günün maliyeti</th>
              <th>Menü</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const d = new Date(s.tarih)
              const gm = maliyetHaritasi.get(s.tarih)
              const birim = Number(gm?.maliyet ?? 0)
              const cikan = etkinCikan(s)
              const yiyen = etkinYiyen(s)
              const fire = cikan - yiyen
              const gelecek = s.tarih > bugun
              const bugunMu = s.tarih === bugun
              return (
                <tr
                  key={s.tarih}
                  className={
                    bugunMu ? 'bg-blue-50/50' : cikan === 0 ? 'bg-slate-50' : undefined
                  }
                >
                  <td className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                    {bugunMu && (
                      <span className="rozet ml-2 bg-blue-100 text-blue-800">bugün</span>
                    )}
                  </td>

                  {/* Çıkan — her zaman elle girilir */}
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        value={s.cikan}
                        onChange={(e) =>
                          yaz(s.tarih, 'cikan', e.target.value.replace(/[^0-9]/g, ''))
                        }
                        inputMode="numeric"
                        placeholder={gelecek ? '—' : String(varsayilanCikan || '?')}
                        title="Mutfaktan bu yere gönderilen porsiyon"
                        className="w-20 rounded border border-cizgi bg-white px-2 py-1 text-right
                                   text-sm font-semibold tabular-nums outline-none
                                   placeholder:font-normal placeholder:text-slate-400
                                   focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                      />
                      <span className="w-12 text-left text-xs text-solgun">
                        {s.cikan !== ''
                          ? 'elle'
                          : gelecek
                            ? 'ileride'
                            : cikanBilinmiyor(s)
                              ? '?'
                              : 'sabit'}
                      </span>
                    </div>
                  </td>

                  {/* Yiyen — okullarda gün sonundan, dışarıda elle */}
                  <td className="text-right">
                    {okulaBagliMi ? (
                      <span className="tabular-nums">
                        {okulHaritasi.has(s.tarih) ? (
                          <>
                            {okulHaritasi.get(s.tarih)!.kisi}
                            {Number(okulHaritasi.get(s.tarih)!.misafir) > 0 && (
                              <span className="text-solgun">
                                {' '}
                                ({okulHaritasi.get(s.tarih)!.misafir})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-solgun">—</span>
                        )}
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          value={s.yiyen}
                          onChange={(e) =>
                            yaz(s.tarih, 'yiyen', e.target.value.replace(/[^0-9]/g, ''))
                          }
                          inputMode="numeric"
                          placeholder={gelecek ? '—' : String(varsayilanKisi)}
                          title="Faturalanan kişi sayısı"
                          className="w-20 rounded border border-cizgi bg-white px-2 py-1 text-right
                                     text-sm tabular-nums outline-none
                                     placeholder:text-slate-400
                                     focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                        />
                        <span className="w-12 text-left text-xs text-solgun">
                          {s.yiyen !== '' ? 'elle' : gelecek ? '' : 'sabit'}
                        </span>
                      </div>
                    )}
                  </td>

                  <td
                    className={`text-right tabular-nums ${
                      fire > 0 ? 'text-orange-700' : 'text-solgun'
                    }`}
                  >
                    {cikan > 0 || yiyen > 0 ? fire : '—'}
                  </td>
                  <td className="text-right tabular-nums text-solgun">
                    {gm ? para(birim) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {cikan > 0 && gm ? para(cikan * birim) : '—'}
                  </td>
                  <td className="text-xs text-solgun">
                    {gelecek && s.cikan === '' ? (
                      'henüz gelmedi'
                    ) : gm?.ozet ? (
                      gm.ozet
                    ) : (
                      <span className="text-amber-700">menü girilmemiş — maliyet 0</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Toplam</td>
              <td className="text-right font-semibold tabular-nums">{toplam.cikan}</td>
              <td className="text-right font-semibold tabular-nums">{toplam.yiyen}</td>
              <td
                className={`text-right font-semibold tabular-nums ${
                  toplam.cikan - toplam.yiyen > 0 ? 'text-orange-700' : 'text-solgun'
                }`}
              >
                {toplam.cikan - toplam.yiyen}
              </td>
              <td className="text-right text-xs text-solgun">
                {toplam.yiyen > 0 && `kişi başı ${para(toplam.maliyet / toplam.yiyen)}`}
              </td>
              <td className="text-right font-bold tabular-nums">{para(toplam.maliyet)}</td>
              <td className="text-xs text-solgun">
                {hizmetGunleri.length} hizmet günü
                {toplam.fire > 0 && ` · fire ${para(toplam.fire)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

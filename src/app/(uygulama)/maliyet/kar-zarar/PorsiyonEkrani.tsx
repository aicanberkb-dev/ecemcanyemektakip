'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, bugunISO, para } from '@/lib/format'

import { gunlukHizmetKaydet, type MaliyetDurumu } from '../actions'

export type GunlukKisi = { tarih: string; kisi_sayisi: number | null }
export type GunlukCikan = { tarih: string; yemek_adi: string; porsiyon: number }
export type SatisFiyati = { gecerli_baslangic: string; kisi_basi_fiyat: number | string }
export type OkulGunu = {
  tarih: string
  kisi: number
  misafir: number
  ciro: number | string
}

export type GunKalemleri = {
  tarih: string
  corba: string | null
  corba_maliyet: number | string
  ana_yemek: string | null
  ana_yemek_maliyet: number | string
  yardimci: string | null
  yardimci_maliyet: number | string
  ek: string | null
  ek_maliyet: number | string
}

const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

const SLOTLAR = ['corba', 'ana_yemek', 'yardimci', 'ek'] as const
type Slot = (typeof SLOTLAR)[number]

const SLOT_ETIKET: Record<Slot, string> = {
  corba: 'Çorba',
  ana_yemek: 'Ana Yemek',
  yardimci: 'Yardımcı',
  ek: '4. Kalem',
}

type Kalem = { yemek: string; birim: number }

/**
 * Bir yerin bir aylık çıkan porsiyonları — yemek bazında.
 *
 * Menüdeki kalemler aynı sayıda çıkmıyor: 80 kişilik bir yere ıspanak 50,
 * tatlı 100 kişilik gönderiliyor, çünkü çocukların ıspanağı sevmediği biliniyor
 * ve tatlıyı iki alan oluyor. Maliyetin doğru tabanı bu; yiyen kişi yalnızca
 * ciroyu belirler.
 *
 * Boş bırakılan kalem yerin varsayılan porsiyonunu kullanır — normal günde
 * hiçbir şey yazmadan doğru sonuç çıkar, yalnızca sapan kalem yazılır.
 */
export function PorsiyonEkrani({
  noktaId,
  noktaAdi,
  okulaBagliMi,
  varsayilanKisi,
  varsayilanCikan,
  listesizMi,
  yil,
  ay,
  kisiler,
  kalemler,
  cikanlar,
  okulGunleri,
  fiyatlar,
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
  kalemler: GunKalemleri[]
  cikanlar: GunlukCikan[]
  okulGunleri: OkulGunu[]
  /** Dış hizmet yerlerinin tarihli satış fiyatları, en yeni önce */
  fiyatlar: SatisFiyati[]
}) {
  const router = useRouter()
  const [durum, setDurum] = useState<MaliyetDurumu>({})
  const [kaydediliyor, basla] = useTransition()
  const bugun = bugunISO()

  /** tarih → slot → { yemek, kişi başı maliyet } */
  const menuHaritasi = useMemo(() => {
    const m = new Map<string, Partial<Record<Slot, Kalem>>>()
    for (const g of kalemler) {
      const gun: Partial<Record<Slot, Kalem>> = {}
      if (g.corba) gun.corba = { yemek: g.corba, birim: Number(g.corba_maliyet) }
      if (g.ana_yemek)
        gun.ana_yemek = { yemek: g.ana_yemek, birim: Number(g.ana_yemek_maliyet) }
      if (g.yardimci) gun.yardimci = { yemek: g.yardimci, birim: Number(g.yardimci_maliyet) }
      if (g.ek) gun.ek = { yemek: g.ek, birim: Number(g.ek_maliyet) }
      m.set(g.tarih, gun)
    }
    return m
  }, [kalemler])

  const okulHaritasi = useMemo(() => {
    const m = new Map<string, OkulGunu>()
    for (const g of okulGunleri) m.set(g.tarih, g)
    return m
  }, [okulGunleri])

  /** Ayın günleri: hafta içi + kaydı olan hafta sonları */
  const gunler = useMemo(() => {
    const gunSayisi = new Date(yil, ay, 0).getDate()
    const liste: string[] = []
    for (let g = 1; g <= gunSayisi; g++) {
      const h = new Date(yil, ay - 1, g).getDay()
      const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
      if ((h === 0 || h === 6) && !okulHaritasi.has(tarih) && !menuHaritasi.has(tarih)) continue
      liste.push(tarih)
    }
    return liste
  }, [yil, ay, okulHaritasi, menuHaritasi])

  // Porsiyon girdileri: "tarih|yemek" → değer
  const [porsiyon, setPorsiyon] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {}
    for (const c of cikanlar) b[`${c.tarih}|${c.yemek_adi}`] = String(c.porsiyon)
    return b
  })

  // Faturalanan kişi: tarih → değer (yalnızca dış hizmet yerlerinde)
  const [yiyen, setYiyen] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {}
    for (const k of kisiler) if (k.kisi_sayisi !== null) b[k.tarih] = String(k.kisi_sayisi)
    return b
  })

  const [topluDeger, setTopluDeger] = useState('')

  function etkinYiyen(tarih: string): number {
    if (okulaBagliMi) {
      const o = okulHaritasi.get(tarih)
      return o ? Number(o.kisi) + Number(o.misafir) : 0
    }
    const d = yiyen[tarih]
    if (d !== undefined && d.trim() !== '') return Number(d) || 0
    return tarih > bugun ? 0 : varsayilanKisi
  }

  /** Bir kalemin o günkü porsiyonu: girilen → yerin sabiti → yiyen kişi */
  function etkinPorsiyon(tarih: string, yemek: string): number {
    const d = porsiyon[`${tarih}|${yemek}`]
    if (d !== undefined && d.trim() !== '') return Number(d) || 0
    if (tarih > bugun) return 0
    // Okulda o gün hiç yemek kaydı yoksa hizmet verilmemiştir; menü girilmiş
    // olması yemeğin çıktığı anlamına gelmiyor. Elle yazılırsa geçerli olur.
    if (okulaBagliMi && !okulHaritasi.has(tarih)) return 0
    return varsayilanCikan > 0 ? varsayilanCikan : etkinYiyen(tarih)
  }

  /**
   * O günün cirosu.
   *
   * Okullarda gün sonu kayıtlarından hazır geliyor (günlükçünün gerçek tutarı,
   * aylıkçının o günkü tarifesi, ücretli öğünler). Dış hizmet yerlerinde
   * faturalanan kişi × o tarihte geçerli sözleşme fiyatı.
   */
  function gunCirosu(tarih: string): number {
    if (okulaBagliMi) return Number(okulHaritasi.get(tarih)?.ciro ?? 0)
    const f = fiyatlar.find((x) => x.gecerli_baslangic <= tarih)
    return etkinYiyen(tarih) * Number(f?.kisi_basi_fiyat ?? 0)
  }

  function gunMaliyeti(tarih: string): number {
    const gun = menuHaritasi.get(tarih)
    if (!gun) return 0
    return SLOTLAR.reduce((t, s) => {
      const k = gun[s]
      return k ? t + etkinPorsiyon(tarih, k.yemek) * k.birim : t
    }, 0)
  }

  function gunPorsiyonu(tarih: string): number {
    const gun = menuHaritasi.get(tarih)
    if (!gun) return 0
    return SLOTLAR.reduce((t, s) => {
      const k = gun[s]
      return k ? t + etkinPorsiyon(tarih, k.yemek) : t
    }, 0)
  }

  /** Bugüne kadarki günlerin tüm kalemlerine aynı porsiyonu yazar. */
  function hepsineUygula() {
    const yeni = { ...porsiyon }
    for (const tarih of gunler) {
      if (tarih > bugun) continue
      const gun = menuHaritasi.get(tarih)
      if (!gun) continue
      for (const s of SLOTLAR) {
        const k = gun[s]
        if (k) yeni[`${tarih}|${k.yemek}`] = topluDeger.trim()
      }
    }
    setPorsiyon(yeni)
    setDurum({})
  }

  function kaydet() {
    basla(async () => {
      const cikanGirdileri: { tarih: string; yemek_adi: string; porsiyon: number | null }[] = []
      for (const tarih of gunler) {
        const gun = menuHaritasi.get(tarih)
        if (!gun) continue
        for (const s of SLOTLAR) {
          const k = gun[s]
          if (!k) continue
          const d = porsiyon[`${tarih}|${k.yemek}`]
          cikanGirdileri.push({
            tarih,
            yemek_adi: k.yemek,
            porsiyon: d === undefined || d.trim() === '' ? null : Number(d),
          })
        }
      }

      const kisiGirdileri = gunler.map((tarih) => ({
        tarih,
        kisi_sayisi:
          okulaBagliMi || !yiyen[tarih] || yiyen[tarih].trim() === ''
            ? null
            : Number(yiyen[tarih]),
      }))

      const s = await gunlukHizmetKaydet(noktaId, kisiGirdileri, cikanGirdileri)
      setDurum(s)
      if (s.basari) router.refresh()
    })
  }

  const toplam = gunler.reduce(
    (t, tarih) => ({
      porsiyon: t.porsiyon + gunPorsiyonu(tarih),
      yiyen: t.yiyen + etkinYiyen(tarih),
      maliyet: t.maliyet + gunMaliyeti(tarih),
      ciro: t.ciro + gunCirosu(tarih),
    }),
    { porsiyon: 0, yiyen: 0, maliyet: 0, ciro: 0 },
  )

  const menusuzGun = gunler.filter(
    (t) => !menuHaritasi.has(t) && gunPorsiyonu(t) + etkinYiyen(t) > 0,
  ).length
  const cikansizGun = gunler.filter(
    (t) =>
      t <= bugun &&
      varsayilanCikan === 0 &&
      menuHaritasi.has(t) &&
      SLOTLAR.every((s) => {
        const k = menuHaritasi.get(t)![s]
        return !k || porsiyon[`${t}|${k.yemek}`] === undefined
      }),
  ).length

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-semibold">
            {noktaAdi} — {AY_ADLARI[ay - 1]} {yil} çıkan porsiyonlar
          </h2>
          <p className="max-w-3xl text-xs text-solgun">
            Her yemeğin kaç kişilik çıktığını ayrı yazın — ıspanak 50, tatlı 100 olabilir.
            Boş bıraktığınız kalem yerin sabit porsiyonunu (
            <strong>{varsayilanCikan || 'girilmemiş'}</strong>) kullanır, ileri tarihler gün
            geldikçe eklenir.{' '}
            <Link href="/maliyet/yerler" className="text-vurgu hover:underline">
              Sabit değerleri değiştir
            </Link>
          </p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="etiket text-xs">Tüm kalemlere</label>
            <input
              value={topluDeger}
              onChange={(e) => setTopluDeger(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="ör. 80"
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
          <strong>{cikansizGun}</strong> günün porsiyonu bilinmiyor; o günlerde maliyet yiyen
          kişiden hesaplandı ve israf görünmüyor. Yerin sabit porsiyonunu bir kez girmeniz
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
          Bu yere menü listesi bağlanmamış; hangi yemeğin çıktığı bilinmediği için maliyet
          hesaplanamıyor. <strong>Hizmet Yerleri</strong> sekmesinden bir menü seçin.
        </p>
      ) : (
        menusuzGun > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <strong>{menusuzGun}</strong> günün menüsü girilmemiş; o günlerin maliyeti 0 ₺
            sayılıyor.{' '}
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
              <th className="w-24">Gün</th>
              {SLOTLAR.map((s) => (
                <th key={s} className="min-w-44">
                  {SLOT_ETIKET[s]}
                </th>
              ))}
              <th className="w-28 text-right">Yiyen</th>
              <th className="text-right">Ciro</th>
              <th className="text-right">Maliyet</th>
              <th className="text-right">Kâr / Zarar</th>
            </tr>
          </thead>
          <tbody>
            {gunler.map((tarih) => {
              const d = new Date(tarih)
              const gun = menuHaritasi.get(tarih)
              const gelecek = tarih > bugun
              const bugunMu = tarih === bugun
              const okulGunu = okulHaritasi.get(tarih)
              return (
                <tr key={tarih} className={bugunMu ? 'bg-blue-50/50' : undefined}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                    {bugunMu && (
                      <span className="rozet ml-1 bg-blue-100 text-blue-800">bugün</span>
                    )}
                  </td>

                  {SLOTLAR.map((s) => {
                    const k = gun?.[s]
                    if (!k)
                      return (
                        <td key={s} className="text-xs text-solgun">
                          —
                        </td>
                      )
                    const anahtar = `${tarih}|${k.yemek}`
                    const p = etkinPorsiyon(tarih, k.yemek)
                    return (
                      <td key={s} className="!py-1.5">
                        <div className="text-[11px] leading-tight font-medium text-slate-700">
                          {k.yemek}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <input
                            value={porsiyon[anahtar] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '')
                              setPorsiyon((o) => ({ ...o, [anahtar]: v }))
                              setDurum({})
                            }}
                            inputMode="numeric"
                            placeholder={gelecek ? '—' : String(varsayilanCikan || '?')}
                            title={`${k.yemek} — kaç kişilik çıktı`}
                            className="w-16 rounded border border-cizgi bg-white px-1.5 py-0.5
                                       text-right text-sm font-semibold tabular-nums outline-none
                                       placeholder:font-normal placeholder:text-slate-400
                                       focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="text-[10px] text-solgun">
                            {k.birim > 0 ? para(p * k.birim) : '0 ₺'}
                          </span>
                        </div>
                      </td>
                    )
                  })}

                  <td className="text-right">
                    {okulaBagliMi ? (
                      <span className="tabular-nums">
                        {okulGunu ? (
                          <>
                            {okulGunu.kisi}
                            {Number(okulGunu.misafir) > 0 && (
                              <span className="text-solgun"> ({okulGunu.misafir})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-solgun">—</span>
                        )}
                      </span>
                    ) : (
                      <input
                        value={yiyen[tarih] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '')
                          setYiyen((o) => ({ ...o, [tarih]: v }))
                          setDurum({})
                        }}
                        inputMode="numeric"
                        placeholder={gelecek ? '—' : String(varsayilanKisi)}
                        title="Faturalanan kişi sayısı"
                        className="w-20 rounded border border-cizgi bg-white px-2 py-1 text-right
                                   text-sm tabular-nums outline-none placeholder:text-slate-400
                                   focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                      />
                    )}
                  </td>

                  {(() => {
                    const ciro = gunCirosu(tarih)
                    const maliyet = gunMaliyeti(tarih)
                    const kar = ciro - maliyet
                    const veriVar = ciro > 0 || maliyet > 0
                    return (
                      <>
                        <td className="text-right tabular-nums">
                          {ciro > 0 ? para(ciro) : <span className="text-solgun">—</span>}
                        </td>
                        <td className="text-right tabular-nums">
                          {gun ? para(maliyet) : <span className="text-solgun">—</span>}
                        </td>
                        <td
                          className={`text-right font-semibold tabular-nums ${
                            !veriVar ? 'text-solgun' : kar < 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {veriVar ? para(kar) : '—'}
                        </td>
                      </>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Toplam</td>
              <td colSpan={4} className="text-xs text-solgun">
                {toplam.porsiyon} porsiyon çıktı
                {toplam.yiyen > 0 &&
                  ` · kişi başı gerçek maliyet ${para(toplam.maliyet / toplam.yiyen)}`}
              </td>
              <td className="text-right font-semibold tabular-nums">{toplam.yiyen}</td>
              <td className="text-right font-semibold tabular-nums">{para(toplam.ciro)}</td>
              <td className="text-right font-semibold tabular-nums">{para(toplam.maliyet)}</td>
              <td
                className={`text-right font-bold tabular-nums ${
                  toplam.ciro - toplam.maliyet < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {para(toplam.ciro - toplam.maliyet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

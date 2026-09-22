'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugunTarihi } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import { ciroKaydet, ciroSil, type FinansDurumu } from '../actions'

export type CiroSatiri = {
  id: string
  tarih: string
  yer: string
  tutar: number | string
  aciklama: string | null
}

/** Tutar kutularına yazılan metin: yer adı → değer */
type Tutarlar = Record<string, string>

/**
 * Günlük ciro defteri: satırlar gün, sütunlar yer.
 *
 * Bir günün bütün yerleri tek formda girilir; kayıt yer başına ayrı satır
 * olur ama kullanıcı gün gün düşündüğü için ekran da öyle duruyor.
 */
export function CiroEkrani({
  satirlar,
  yerler: gelenYerler,
}: {
  satirlar: CiroSatiri[]
  yerler: string[]
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [tarih, setTarih] = useBugunTarihi()
  const [tutarlar, setTutarlar] = useState<Tutarlar>({})
  const [yeniYer, setYeniYer] = useState('')
  const [durum, setDurum] = useState<FinansDurumu>({})
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')

  const yerler = useMemo(
    () => [...new Set([...gelenYerler, ...Object.keys(tutarlar)])],
    [gelenYerler, tutarlar],
  )

  // gün → yer → satır
  const gunler = useMemo(() => {
    const m = new Map<string, Map<string, CiroSatiri>>()
    for (const s of satirlar) {
      if (bas && s.tarih < bas) continue
      if (bit && s.tarih > bit) continue
      const gun = m.get(s.tarih) ?? new Map<string, CiroSatiri>()
      gun.set(s.yer, s)
      m.set(s.tarih, gun)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [satirlar, bas, bit])

  const yerToplami = (yer: string) =>
    gunler.reduce((t, [, gun]) => t + Number(gun.get(yer)?.tutar ?? 0), 0)
  const gunToplami = (gun: Map<string, CiroSatiri>) =>
    [...gun.values()].reduce((t, s) => t + Number(s.tutar), 0)
  const genelToplam = gunler.reduce((t, [, gun]) => t + gunToplami(gun), 0)

  /** Seçili günün kayıtlı değerlerini forma doldurur — düzeltmek için */
  function gunuYukle(gun: string) {
    const kayitlar = satirlar.filter((s) => s.tarih === gun)
    setTarih(gun)
    setTutarlar(
      Object.fromEntries(
        kayitlar.map((s) => [s.yer, String(Number(s.tutar)).replace('.', ',')]),
      ),
    )
    setDurum({})
  }

  function kaydet(e: React.FormEvent) {
    e.preventDefault()
    const girilenler = Object.entries(tutarlar).filter(([, v]) => v.trim() !== '')
    if (girilenler.length === 0) {
      setDurum({ hata: 'En az bir yere tutar yazın.' })
      return
    }

    baslat(async () => {
      for (const [yer, tutar] of girilenler) {
        const sonuc = await ciroKaydet({ tarih, yer, tutar })
        if (sonuc.hata || sonuc.alanlar) {
          setDurum({ hata: sonuc.hata ?? 'Girilen değerlerde hata var.' })
          return
        }
      }
      setDurum({ basari: `${tarihBicim(tarih)} kaydedildi.` })
      setTutarlar({})
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={kaydet} className="kart space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="etiket text-xs" htmlFor="ciro-tarih">
              Tarih
            </label>
            <input
              id="ciro-tarih"
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="girdi !py-1.5"
            />
          </div>

          {yerler.map((yer) => (
            <div key={yer}>
              <label className="etiket text-xs" htmlFor={`ciro-${yer}`}>
                {yer}
              </label>
              <input
                id={`ciro-${yer}`}
                inputMode="decimal"
                placeholder="0,00"
                value={tutarlar[yer] ?? ''}
                onChange={(e) => setTutarlar({ ...tutarlar, [yer]: e.target.value })}
                className="girdi w-32 !py-1.5 text-right tabular-nums"
              />
            </div>
          ))}

          <div>
            <label className="etiket text-xs" htmlFor="ciro-yeni-yer">
              Yeni yer
            </label>
            <div className="flex gap-2">
              <input
                id="ciro-yeni-yer"
                value={yeniYer}
                onChange={(e) => setYeniYer(e.target.value)}
                placeholder="Yer adı"
                className="girdi w-32 !py-1.5"
              />
              <button
                type="button"
                className="btn-ikincil !py-1.5"
                onClick={() => {
                  const ad = yeniYer.trim().toLocaleUpperCase('tr')
                  if (!ad) return
                  setTutarlar({ ...tutarlar, [ad]: tutarlar[ad] ?? '' })
                  setYeniYer('')
                }}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Kaydediliyor…' : 'Günü Kaydet'}
          </button>
          {durum.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
          {durum.basari && !bekliyor && (
            <span className="text-sm text-emerald-700">{durum.basari}</span>
          )}
        </div>
      </form>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket text-xs" htmlFor="ciro-bas">
            Başlangıç
          </label>
          <input
            id="ciro-bas"
            type="date"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="ciro-bit">
            Bitiş
          </label>
          <input
            id="ciro-bit"
            type="date"
            value={bit}
            onChange={(e) => setBit(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        {(bas || bit) && (
          <button
            type="button"
            className="btn-ikincil !py-1.5"
            onClick={() => {
              setBas('')
              setBit('')
            }}
          >
            Tüm tarihler
          </button>
        )}
        <div className="ml-auto text-right">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Dönem toplamı
          </p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">
            {para(genelToplam)}
          </p>
        </div>
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              {yerler.map((y) => (
                <th key={y} className="text-right">
                  {y}
                </th>
              ))}
              <th className="text-right">Gün Toplamı</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gunler.map(([gun, kayitlar]) => (
              <tr key={gun}>
                <td className="whitespace-nowrap">{tarihBicim(gun)}</td>
                {yerler.map((y) => (
                  <td key={y} className="text-right tabular-nums">
                    {kayitlar.has(y) ? (
                      para(kayitlar.get(y)!.tutar)
                    ) : (
                      <span className="text-solgun">—</span>
                    )}
                  </td>
                ))}
                <td className="text-right font-semibold tabular-nums text-emerald-700">
                  {para(gunToplami(kayitlar))}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="text-xs text-vurgu hover:underline"
                    onClick={() => gunuYukle(gun)}
                  >
                    Düzelt
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-xs text-red-600 hover:underline"
                    disabled={bekliyor}
                    onClick={() => {
                      if (!confirm(`${tarihBicim(gun)} kayıtları silinsin mi?`)) return
                      baslat(async () => {
                        for (const s of kayitlar.values()) {
                          const sonuc = await ciroSil(s.id)
                          if (sonuc.hata) {
                            setDurum({ hata: sonuc.hata })
                            return
                          }
                        }
                        router.refresh()
                      })
                    }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {gunler.length === 0 && (
              <tr>
                <td colSpan={yerler.length + 3} className="py-8 text-center text-solgun">
                  Henüz ciro girilmemiş. Yukarıdan bir günün rakamlarını yazıp kaydedin.
                </td>
              </tr>
            )}
          </tbody>
          {gunler.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2">Toplam</td>
                {yerler.map((y) => (
                  <td key={y} className="px-3 py-2 text-right tabular-nums">
                    {para(yerToplami(y))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {para(genelToplam)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

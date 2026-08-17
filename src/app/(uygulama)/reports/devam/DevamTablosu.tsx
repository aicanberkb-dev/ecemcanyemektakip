'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'
import type { DevamSatiri } from '@/lib/types'

export function DevamTablosu({
  satirlar,
  siniflar,
  yil,
  gunler,
  haftaSonuGunler,
}: {
  satirlar: DevamSatiri[]
  siniflar: string[]
  yil: number
  gunler: number[]
  /** Hafta sonuna denk gelen gün numaraları */
  haftaSonuGunler: number[]
}) {
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')

  const haftaSonu = useMemo(() => new Set(haftaSonuGunler), [haftaSonuGunler])

  const suzulmus = useMemo(
    () =>
      satirlar.filter((s) => {
        if (sinif && s.sinif !== sinif) return false
        if (!arama.trim()) return true
        return aramaEslesir(`${s.ad_soyad} ${s.ogrenci_no}`, arama)
      }),
    [satirlar, arama, sinif],
  )

  const oneriler = useMemo(
    () =>
      suzulmus.map((s) => ({
        deger: s.ad_soyad,
        etiket: s.ad_soyad,
        alt: [s.ogrenci_no, s.sinif].filter(Boolean).join(' · '),
      })),
    [suzulmus],
  )

  return (
    <div className="space-y-4">
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <AramaKutusu
          deger={arama}
          degistir={setArama}
          etiket="Öğrenci ara (ad veya no)"
          ipucu="Adın herhangi bir parçası yeter"
          sonuc={`${suzulmus.length} / ${satirlar.length} öğrenci`}
          oneriler={oneriler}
        />
        <div>
          <label className="etiket" htmlFor="sinifSuz">
            Sınıf
          </label>
          <select
            id="sinifSuz"
            value={sinif}
            onChange={(e) => setSinif(e.target.value)}
            className="girdi"
          >
            <option value="">Hepsi</option>
            {siniflar.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-4 text-xs text-solgun">
        <span>
          <span className="mr-1 inline-block rounded bg-emerald-50 px-1.5 font-semibold text-emerald-700">
            ✓
          </span>
          yemeğe geldi
        </span>
        <span>
          <span className="mr-1 inline-block rounded border-b-4 border-amber-500 bg-amber-50 px-1.5">
            ₺
          </span>
          o gün ödeme alındı
        </span>
        <span>
          <span className="mr-1 inline-block rounded bg-slate-100 px-2">&nbsp;</span>
          hafta sonu
        </span>
      </p>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50">Öğrenci</th>
              {gunler.map((g) => (
                <th
                  key={g}
                  className={`!px-1 text-center tabular-nums ${
                    haftaSonu.has(g) ? 'bg-slate-200 text-slate-400' : ''
                  }`}
                >
                  {g}
                </th>
              ))}
              <th className="text-right">Geldi</th>
              <th className="text-right">Gelmedi</th>
            </tr>
          </thead>
          <tbody>
            {suzulmus.map((s) => {
              const geldigi = new Set(s.geldigi_gunler)
              const odeme = new Set(s.odeme_gunleri)
              return (
                <tr key={s.student_id}>
                  <td className="sticky left-0 z-10 bg-white whitespace-nowrap">
                    <Link
                      href={`/reports/devam/${s.student_id}?yil=${yil}`}
                      className="font-medium text-vurgu hover:underline"
                    >
                      {s.ad_soyad}
                    </Link>
                    <span className="ml-2 text-xs text-solgun">{s.sinif ?? ''}</span>
                  </td>
                  {gunler.map((g) => {
                    const geldi = geldigi.has(g)
                    const d = s.odeme_detay?.[String(g)]
                    const odendi = odeme.has(g)
                    return (
                      <td
                        key={g}
                        // Ödeme alınan gün alttan turuncu çizgiyle işaretlenir;
                        // geliş işaretiyle çakışmadan aynı hücrede görünür.
                        className={`group relative !px-1 text-center ${
                          odendi ? 'border-b-4 border-amber-500' : ''
                        } ${
                          haftaSonu.has(g)
                            ? 'bg-slate-100'
                            : geldi
                              ? 'bg-emerald-50 font-semibold text-emerald-700'
                              : odendi
                                ? 'bg-amber-50'
                                : ''
                        }`}
                      >
                        {geldi ? '✓' : odendi ? '₺' : ''}
                        {d && (
                          <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-1 w-52 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-left text-xs whitespace-normal text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                            <span className="mb-1 block font-semibold">
                              {g}. gün — tahsilat
                            </span>
                            <span className="flex justify-between gap-2">
                              <span className="text-slate-300">Önceki bakiye</span>
                              <span className="tabular-nums">{para(d.oncesi)}</span>
                            </span>
                            <span className="flex justify-between gap-2">
                              <span className="text-slate-300">Alınan</span>
                              <span className="tabular-nums text-emerald-300">
                                +{para(d.tutar)}
                              </span>
                            </span>
                            <span className="mt-1 flex justify-between gap-2 border-t border-slate-700 pt-1 font-semibold">
                              <span className="text-slate-300">Gün sonu</span>
                              <span className="tabular-nums">{para(d.sonrasi)}</span>
                            </span>
                            {geldi && (
                              <span className="mt-1 block text-slate-400">
                                O gün yemeğe de geldi.
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-right font-semibold tabular-nums text-emerald-700">
                    {s.geldi_sayisi}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{s.gelmedi_sayisi}</td>
                </tr>
              )
            })}
            {suzulmus.length === 0 && (
              <tr>
                <td colSpan={gunler.length + 3} className="py-8 text-center text-solgun">
                  {arama.trim() || sinif ? 'Bu filtreyle eşleşen öğrenci yok.' : 'Kayıt bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

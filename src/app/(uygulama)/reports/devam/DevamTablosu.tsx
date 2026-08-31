'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'
import type { DevamSatiri } from '@/lib/types'

type OdemeDetay = { oncesi: number; tutar: number; sonrasi: number }

type Ipucu = {
  gun: number
  detay: OdemeDetay
  geldi: boolean
  /** Ekran koordinatı: kutu bu noktanın altında ya da üstünde açılır */
  x: number
  y: number
  yukari: boolean
}

export function DevamTablosu({
  satirlar,
  siniflar,
  yil,
  gunler,
  kapaliGunler,
}: {
  satirlar: DevamSatiri[]
  siniflar: string[]
  yil: number
  gunler: number[]
  /** Okul olmayan gün numaraları: hafta sonu + resmi tatil / ara tatil */
  kapaliGunler: number[]
}) {
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')
  const [ipucu, setIpucu] = useState<Ipucu | null>(null)

  const kapali = useMemo(() => new Set(kapaliGunler), [kapaliGunler])

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
                    kapali.has(g) ? 'bg-slate-200 text-slate-400' : ''
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
                        onMouseEnter={
                          d
                            ? (e) => {
                                const r = e.currentTarget.getBoundingClientRect()
                                // Üstte yer yoksa aşağı açılsın: tek satır kalan
                                // aramalarda kutu tablonun dışında kesiliyordu.
                                const yukari = r.top > 200
                                setIpucu({
                                  gun: g,
                                  detay: d,
                                  geldi,
                                  x: r.left + r.width / 2,
                                  y: yukari ? r.top - 8 : r.bottom + 8,
                                  yukari,
                                })
                              }
                            : undefined
                        }
                        onMouseLeave={d ? () => setIpucu(null) : undefined}
                        className={`relative !px-1 text-center ${
                          odendi ? 'border-b-4 border-amber-500' : ''
                        } ${
                          kapali.has(g)
                            ? 'bg-slate-100'
                            : geldi
                              ? 'bg-emerald-50 font-semibold text-emerald-700'
                              : odendi
                                ? 'bg-amber-50'
                                : ''
                        }`}
                      >
                        {geldi ? '✓' : odendi ? '₺' : ''}
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

      {/* Tahsilat balonu tablonun dışında, sabit konumda duruyor: tablo yatay
          kaydırmalı olduğu için hücrenin içinde çizilince kesiliyordu. */}
      {ipucu && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-md bg-slate-900 px-3 py-2 text-left text-xs text-white shadow-lg"
          style={{
            left: ipucu.x,
            top: ipucu.y,
            transform: `translate(-50%, ${ipucu.yukari ? '-100%' : '0'})`,
          }}
        >
          <p className="mb-1 font-semibold">{ipucu.gun}. gün — tahsilat</p>
          <p className="flex justify-between gap-2">
            <span className="text-slate-300">Önceki bakiye</span>
            <span className="tabular-nums">{para(ipucu.detay.oncesi)}</span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-slate-300">Alınan</span>
            <span className="tabular-nums text-emerald-300">+{para(ipucu.detay.tutar)}</span>
          </p>
          <p className="mt-1 flex justify-between gap-2 border-t border-slate-700 pt-1 font-semibold">
            <span className="text-slate-300">Gün sonu</span>
            <span className="tabular-nums">{para(ipucu.detay.sonrasi)}</span>
          </p>
          {ipucu.geldi && (
            <p className="mt-1 text-slate-400">O gün yemeğe de geldi.</p>
          )}
        </div>
      )}
    </div>
  )
}

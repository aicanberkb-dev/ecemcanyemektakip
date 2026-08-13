'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'

export type BorcluSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  veli_adi: string | null
  veli2_adi: string | null
  veli_telefon: string | null
  gunluk_ucret: number
  borc: number
}

export function BorcluListesi({
  borclular,
  siniflar,
}: {
  borclular: BorcluSatiri[]
  siniflar: string[]
}) {
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')

  const suzulmus = useMemo(
    () =>
      borclular.filter((o) => {
        if (sinif && o.sinif !== sinif) return false
        if (!arama.trim()) return true
        return aramaEslesir(
          `${o.ad_soyad} ${o.ogrenci_no} ${o.veli_adi ?? ''} ${o.veli2_adi ?? ''}`,
          arama,
        )
      }),
    [borclular, arama, sinif],
  )

  const oneriler = useMemo(
    () =>
      suzulmus.map((o) => ({
        deger: o.ad_soyad,
        etiket: o.ad_soyad,
        alt: [o.ogrenci_no, o.sinif, o.veli_adi].filter(Boolean).join(' · '),
      })),
    [suzulmus],
  )

  const toplamBorc = suzulmus.reduce((t, o) => t + o.borc, 0)
  const telefonsuz = suzulmus.filter((o) => !o.veli_telefon).length

  const csvYolu =
    '/reports/borclu/csv?' +
    new URLSearchParams({
      ...(arama.trim() ? { q: arama.trim() } : {}),
      ...(sinif ? { sinif } : {}),
    }).toString()

  return (
    <div className="space-y-4">
      <div className="kart yazdirma-gizle flex flex-wrap items-end gap-3 p-4">
        <AramaKutusu
          deger={arama}
          degistir={setArama}
          etiket="Öğrenci veya veli ara"
          ipucu="Adın herhangi bir parçası yeter"
          sonuc={`${suzulmus.length} / ${borclular.length} öğrenci`}
          oneriler={oneriler}
        />
        <div>
          <label className="etiket" htmlFor="sinif">
            Sınıf
          </label>
          <select
            id="sinif"
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
        <a href={csvYolu} className="btn-ikincil">
          CSV indir
        </a>
        {(arama || sinif) && (
          <button
            type="button"
            onClick={() => {
              setArama('')
              setSinif('')
            }}
            className="btn-ikincil"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Borçlu öğrenci" deger={String(suzulmus.length)} />
        <Ozet baslik="Toplam alacak" deger={para(toplamBorc)} renk="text-red-600" />
        <Ozet
          baslik="Telefonu eksik"
          deger={String(telefonsuz)}
          alt={telefonsuz > 0 ? 'veliye ulaşılamaz' : 'hepsinde telefon var'}
        />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Veli</th>
              <th>Telefon</th>
              <th className="text-right">Günlük Ücret</th>
              <th className="text-right">Borç</th>
            </tr>
          </thead>
          <tbody>
            {suzulmus.map((o) => (
              <tr key={o.student_id}>
                <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                <td>
                  <Link
                    href={`/students/${o.student_id}`}
                    className="font-medium text-vurgu hover:underline"
                  >
                    {o.ad_soyad}
                  </Link>
                </td>
                <td>{o.sinif ?? '—'}</td>
                <td>{o.veli_adi ?? '—'}</td>
                <td className="whitespace-nowrap">
                  {o.veli_telefon ? (
                    <a
                      href={`tel:${o.veli_telefon.replace(/\s/g, '')}`}
                      className="text-vurgu hover:underline"
                    >
                      {o.veli_telefon}
                    </a>
                  ) : (
                    <span className="rozet bg-amber-100 text-amber-800">telefon yok</span>
                  )}
                </td>
                <td className="text-right tabular-nums text-solgun">{para(o.gunluk_ucret)}</td>
                <td className="text-right font-bold tabular-nums text-red-600">
                  {para(o.borc)}
                </td>
              </tr>
            ))}
            {suzulmus.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  {arama.trim() || sinif ? (
                    <p className="text-solgun">Bu filtreyle eşleşen borçlu öğrenci yok.</p>
                  ) : (
                    <>
                      <p className="font-medium text-emerald-700">Borçlu öğrenci yok.</p>
                      <p className="mt-1 text-sm text-solgun">
                        Tüm günlükçü öğrencilerin bakiyesi sıfır veya artıda.
                      </p>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  deger,
  alt,
  renk,
}: {
  baslik: string
  deger: string
  alt?: string
  renk?: string
}) {
  return (
    <div className="kart p-4">
      <p className="text-xs font-medium tracking-wide text-solgun uppercase">{baslik}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${renk ?? ''}`}>{deger}</p>
      {alt && <p className="mt-1 text-xs text-solgun">{alt}</p>}
    </div>
  )
}

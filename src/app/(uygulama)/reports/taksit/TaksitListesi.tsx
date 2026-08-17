'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { OgrenciTipiRozeti } from '@/components/Rozetler'
import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'
import { OGRENCI_TIPI_ADLARI, type OgrenciTipi, type TaksitDurumu } from '@/lib/types'

export function TaksitListesi({ satirlar }: { satirlar: TaksitDurumu[] }) {
  const [arama, setArama] = useState('')
  const [seciliId, setSeciliId] = useState<string | null>(null)
  const [tip, setTip] = useState<OgrenciTipi | ''>('')

  const suzulmus = useMemo(() => {
    let liste = satirlar
    if (tip) liste = liste.filter((s) => s.ogrenci_tipi === tip)
    // Öneriden seçim yapıldıysa yalnızca o öğrenci gösterilir
    if (seciliId) return liste.filter((s) => s.student_id === seciliId)
    if (!arama.trim()) return liste
    return liste.filter((s) => aramaEslesir(`${s.ad_soyad} ${s.ogrenci_no} ${s.sinif ?? ''}`, arama))
  }, [satirlar, arama, seciliId, tip])

  const oneriler = useMemo(
    () =>
      suzulmus.map((s) => ({
        id: s.student_id,
        deger: s.ad_soyad,
        etiket: s.ad_soyad,
        alt: [s.ogrenci_no, s.sinif, OGRENCI_TIPI_ADLARI[s.ogrenci_tipi]]
          .filter(Boolean)
          .join(' · '),
      })),
    [suzulmus],
  )

  const borclu = suzulmus.filter((s) => s.odeme_alinmali)
  const toplamEksik = borclu.reduce((t, s) => t + Number(s.eksik), 0)
  const toplamOdenen = suzulmus.reduce((t, s) => t + Number(s.odenen), 0)

  const tipler = [...new Set(satirlar.map((s) => s.ogrenci_tipi))]

  return (
    <div className="space-y-4">
      <div className="kart yazdirma-gizle flex flex-wrap items-end gap-3 p-4">
        <AramaKutusu
          deger={arama}
          degistir={(v) => {
            setArama(v)
            setSeciliId(null)
          }}
          oneriSec={(o) => {
            setArama(o.deger)
            setSeciliId(o.id ?? null)
          }}
          etiket="Öğrenci ara"
          ipucu="Adın herhangi bir parçası yeter"
          sonuc={
            seciliId
              ? `yalnızca ${arama}`
              : `${suzulmus.length} / ${satirlar.length} öğrenci`
          }
          oneriler={oneriler}
        />
        {tipler.length > 1 && (
          <div>
            <label className="etiket" htmlFor="tipSuz">
              Öğrenci tipi
            </label>
            <select
              id="tipSuz"
              value={tip}
              onChange={(e) => setTip(e.target.value as OgrenciTipi | '')}
              className="girdi"
            >
              <option value="">Hepsi</option>
              {tipler.map((t) => (
                <option key={t} value={t}>
                  {OGRENCI_TIPI_ADLARI[t]}
                </option>
              ))}
            </select>
          </div>
        )}
        {(arama || tip) && (
          <button
            type="button"
            onClick={() => {
              setArama('')
              setSeciliId(null)
              setTip('')
            }}
            className="btn-ikincil"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Aylıkçı öğrenci" deger={String(suzulmus.length)} />
        <Ozet baslik="Toplanan" deger={para(toplamOdenen)} renk="text-emerald-700" />
        <Ozet
          baslik="Ödeme alınmalı"
          deger={para(toplamEksik)}
          alt={`${borclu.length} öğrenci`}
          renk="text-red-600"
        />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Tip</th>
              <th className="text-right">Yıllık</th>
              <th className="text-right">Vadesi Gelen</th>
              <th className="text-right">Ödenen</th>
              <th className="text-right">Eksik</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {suzulmus.map((s) => (
              <tr key={s.student_id} className={s.odeme_alinmali ? 'bg-red-50/60' : ''}>
                <td className="tabular-nums text-solgun">{s.ogrenci_no}</td>
                <td>
                  <Link
                    href={`/students/${s.student_id}`}
                    className="font-medium text-vurgu hover:underline"
                  >
                    {s.ad_soyad}
                  </Link>
                  {s.ozel_plan && (
                    <span
                      className="rozet ml-2 bg-amber-100 text-amber-800"
                      title="Bu öğrencinin taksit planı kendi tipinin planından farklı"
                    >
                      özel plan
                    </span>
                  )}
                </td>
                <td>{s.sinif ?? '—'}</td>
                <td className="whitespace-nowrap">
                  {s.ogrenci_tipi === 'standart' ? (
                    <span className="text-solgun">Standart</span>
                  ) : (
                    <OgrenciTipiRozeti tip={s.ogrenci_tipi} />
                  )}
                </td>
                <td className="text-right tabular-nums">{para(s.yillik_toplam)}</td>
                <td className="text-right tabular-nums">{para(s.vadesi_gelen)}</td>
                <td className="text-right tabular-nums text-emerald-700">{para(s.odenen)}</td>
                <td className="text-right font-semibold tabular-nums">
                  {Number(s.eksik) > 0 ? (
                    <span className="text-red-600">{para(s.eksik)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td>
                  {s.odeme_alinmali ? (
                    <span className="rozet bg-red-600 text-white">ÖDEME ALINMALI</span>
                  ) : (
                    <span className="rozet bg-emerald-100 text-emerald-800">Güncel</span>
                  )}
                </td>
              </tr>
            ))}
            {suzulmus.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-solgun">
                  {arama || tip ? 'Bu filtreyle eşleşen öğrenci yok.' : 'Aylıkçı öğrenci yok.'}
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

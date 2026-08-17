'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { aramaEslesir } from '@/lib/arama'
import { para, tarih as tarihBicim } from '@/lib/format'
import { ODEME_YONTEMI_ADLARI, type OdemeYontemi } from '@/lib/types'

export type TahsilatSatiri = {
  id: string
  student_id: string
  tarih: string
  tutar: number
  aciklama: string | null
  odeme_yontemi: OdemeYontemi | null
  ad_soyad: string
  ogrenci_no: string
  sinif: string | null
}

export function TahsilatListesi({ kayitlar }: { kayitlar: TahsilatSatiri[] }) {
  const [arama, setArama] = useState('')
  // Öneriden bir öğrenci seçilirse o kayda kilitlenilir: "Ayşe" araması
  // Ayşe Urgancı'yı da getiriyordu, seçim yapıldığında bu olmamalı.
  const [seciliId, setSeciliId] = useState<string | null>(null)

  const suzulmus = useMemo(() => {
    if (seciliId) return kayitlar.filter((k) => k.student_id === seciliId)
    if (!arama.trim()) return kayitlar
    return kayitlar.filter((k) =>
      aramaEslesir(`${k.ad_soyad} ${k.ogrenci_no} ${k.sinif ?? ''}`, arama),
    )
  }, [kayitlar, arama, seciliId])

  // Kutunun altında görünecek öneriler: eşleşen kayıtlardaki farklı öğrenciler.
  const oneriler = useMemo(() => {
    const gorulen = new Map<string, { ad: string; no: string; sinif: string | null }>()
    for (const k of suzulmus) {
      if (!gorulen.has(k.student_id)) {
        gorulen.set(k.student_id, { ad: k.ad_soyad, no: k.ogrenci_no, sinif: k.sinif })
      }
    }
    return [...gorulen.entries()]
      .sort((a, b) => a[1].ad.localeCompare(b[1].ad, 'tr'))
      .map(([id, o]) => ({
        id,
        deger: o.ad,
        etiket: o.ad,
        alt: [o.no, o.sinif].filter(Boolean).join(' · '),
      }))
  }, [suzulmus])

  const toplam = suzulmus.reduce((t, k) => t + k.tutar, 0)

  const yonteme = { nakit: 0, havale: 0, kredi_karti: 0, belirtilmemis: 0 }
  const adet = { nakit: 0, havale: 0, kredi_karti: 0, belirtilmemis: 0 }
  for (const k of suzulmus) {
    const anahtar = k.odeme_yontemi ?? 'belirtilmemis'
    yonteme[anahtar] += k.tutar
    adet[anahtar] += 1
  }

  const ogrenciBazli = new Map<string, { ad: string; tutar: number; adet: number }>()
  for (const k of suzulmus) {
    const m = ogrenciBazli.get(k.student_id) ?? { ad: k.ad_soyad, tutar: 0, adet: 0 }
    m.tutar += k.tutar
    m.adet += 1
    ogrenciBazli.set(k.student_id, m)
  }
  const ozetSatirlari = [...ogrenciBazli.entries()].sort((a, b) => b[1].tutar - a[1].tutar)

  return (
    <div className="space-y-4">
      <div className="kart p-4">
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
          ipucu="Adın herhangi bir parçası yeter: öm · be · or"
          sonuc={
            seciliId
              ? `yalnızca ${arama} · ${suzulmus.length} işlem`
              : `${suzulmus.length} / ${kayitlar.length} işlem`
          }
          oneriler={oneriler}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Toplam tahsilat" deger={para(toplam)} renk="text-emerald-700" />
        <Ozet baslik="İşlem sayısı" deger={String(suzulmus.length)} />
        <Ozet baslik="Ödeme yapan öğrenci" deger={String(ogrenciBazli.size)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {(['nakit', 'havale', 'kredi_karti'] as OdemeYontemi[]).map((y) => (
          <Ozet
            key={y}
            baslik={ODEME_YONTEMI_ADLARI[y]}
            deger={para(yonteme[y])}
            alt={`${adet[y]} işlem`}
          />
        ))}
        {adet.belirtilmemis > 0 && (
          <Ozet
            baslik="Belirtilmemiş"
            deger={para(yonteme.belirtilmemis)}
            alt={`${adet.belirtilmemis} eski kayıt`}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="kart overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
            İşlemler ({suzulmus.length})
          </h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Ödeme Yöntemi</th>
                <th>Açıklama</th>
                <th className="text-right">Tutar</th>
                <th className="text-right">Düzelt</th>
              </tr>
            </thead>
            <tbody>
              {suzulmus.map((k) => (
                <tr key={k.id}>
                  <td className="whitespace-nowrap">{tarihBicim(k.tarih)}</td>
                  <td>
                    <Link
                      href={`/students/${k.student_id}`}
                      className="font-medium text-vurgu hover:underline"
                    >
                      {k.ad_soyad}
                    </Link>
                  </td>
                  <td>{k.sinif ?? '—'}</td>
                  <td>
                    {k.odeme_yontemi ? (
                      <span className="rozet bg-slate-100 text-slate-700">
                        {ODEME_YONTEMI_ADLARI[k.odeme_yontemi]}
                      </span>
                    ) : (
                      <span className="rozet bg-amber-100 text-amber-800">belirtilmemiş</span>
                    )}
                  </td>
                  <td className="text-solgun">{k.aciklama ?? '—'}</td>
                  <td className="text-right font-medium tabular-nums text-emerald-700">
                    {para(k.tutar)}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/students/${k.student_id}`}
                      className="text-xs text-vurgu hover:underline"
                    >
                      Düzelt →
                    </Link>
                  </td>
                </tr>
              ))}
              {suzulmus.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-solgun">
                    {arama.trim()
                      ? `"${arama}" ile eşleşen tahsilat yok.`
                      : 'Bu aralıkta tahsilat yok.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="kart h-fit overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">Öğrenci Bazlı</h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th className="text-right">Adet</th>
                <th className="text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {ozetSatirlari.map(([id, o]) => (
                <tr key={id}>
                  <td>
                    <Link href={`/students/${id}`} className="text-vurgu hover:underline">
                      {o.ad}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums text-solgun">{o.adet}</td>
                  <td className="text-right font-medium tabular-nums">{para(o.tutar)}</td>
                </tr>
              ))}
              {ozetSatirlari.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-solgun">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

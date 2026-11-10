'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { DenemeRozeti } from '@/components/Rozetler'
import { aramaEslesir } from '@/lib/arama'
import { para, tarih } from '@/lib/format'
import { anasinifiMi, birinciSinifMi } from '@/lib/sinif'
import type { AzGelenSatiri } from '@/lib/types'

const ESIKLER = [40, 50, 60, 70]

/** Bu kadar yemek günü geçmemiş öğrenciye oran yazmak yanıltıcı. */
const EN_AZ_OLCUM_GUNU = 5

function anasinifiSatiri(s: AzGelenSatiri) {
  return (
    s.ogrenci_tipi === 'anasinifi' ||
    s.ogrenci_tipi === 'anasinifi_etut' ||
    anasinifiMi(s.sinif)
  )
}

function birinciSinifSatiri(s: AzGelenSatiri) {
  return s.ogrenci_tipi === 'birinci_sinif' || birinciSinifMi(s.sinif)
}

export function AzGelenlerListesi({
  satirlar,
  anasinifiVar,
}: {
  satirlar: AzGelenSatiri[]
  /** Okulda anasınıfı yoksa o süzgeç hiç gösterilmez */
  anasinifiVar: boolean
}) {
  const [esik, setEsik] = useState(60)
  const [anasinifiGizle, setAnasinifiGizle] = useState(true)
  const [birinciGizle, setBirinciGizle] = useState(true)
  const [arama, setArama] = useState('')

  // Havuz: eşikten bağımsız olarak karşılaştırmaya giren öğrenciler. Ortanca
  // buradan hesaplanır — "az geliyor" ancak okulun geneliyle anlam kazanıyor.
  const havuz = useMemo(
    () =>
      satirlar.filter((s) => {
        if (anasinifiGizle && anasinifiSatiri(s)) return false
        if (birinciGizle && birinciSinifSatiri(s)) return false
        return true
      }),
    [satirlar, anasinifiGizle, birinciGizle],
  )

  // Ölçülecek günü az olanlar ayrı duruyor: yeni kayıtta 2/4 gelişten oran
  // çıkmaz, listeye karışırsa yanlış veliyi ararsın.
  const yeniKayitlar = useMemo(
    () => havuz.filter((s) => s.oran === null || s.ders_gunu < EN_AZ_OLCUM_GUNU),
    [havuz],
  )

  const olculenler = useMemo(
    () => havuz.filter((s) => s.oran !== null && s.ders_gunu >= EN_AZ_OLCUM_GUNU),
    [havuz],
  )

  const ortanca = useMemo(() => {
    if (olculenler.length === 0) return null
    const oranlar = olculenler.map((s) => Number(s.oran)).sort((a, b) => a - b)
    const orta = Math.floor(oranlar.length / 2)
    return oranlar.length % 2 === 0
      ? Math.round((oranlar[orta - 1] + oranlar[orta]) / 2)
      : oranlar[orta]
  }, [olculenler])

  const suzulmus = useMemo(
    () =>
      olculenler
        .filter((s) => Number(s.oran) < esik)
        .filter((s) => {
          if (!arama.trim()) return true
          return aramaEslesir(
            `${s.ad_soyad} ${s.ogrenci_no} ${s.veli_adi ?? ''} ${s.veli2_adi ?? ''}`,
            arama,
          )
        }),
    [olculenler, esik, arama],
  )

  const oneriler = useMemo(
    () =>
      suzulmus.map((s) => ({
        deger: s.ad_soyad,
        etiket: s.ad_soyad,
        alt: [s.ogrenci_no, s.sinif, s.veli_adi].filter(Boolean).join(' · '),
      })),
    [suzulmus],
  )

  const telefonsuz = suzulmus.filter((s) => !s.veli_telefon && !s.veli2_telefon).length
  const hicGelmeyen = suzulmus.filter((s) => s.gelis === 0).length

  return (
    <div className="space-y-4">
      <div className="kart yazdirma-gizle flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="etiket" htmlFor="esik">
            Eşik
          </label>
          <select
            id="esik"
            value={String(esik)}
            onChange={(e) => setEsik(Number(e.target.value))}
            className="girdi"
          >
            {ESIKLER.map((e) => (
              <option key={e} value={e}>
                %{e} altı
              </option>
            ))}
          </select>
        </div>

        <AramaKutusu
          deger={arama}
          degistir={setArama}
          etiket="Öğrenci veya veli ara"
          ipucu="Adın herhangi bir parçası yeter"
          sonuc={`${suzulmus.length} / ${olculenler.length} öğrenci`}
          oneriler={oneriler}
        />

        <div className="flex flex-col gap-1 text-sm">
          {anasinifiVar && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={anasinifiGizle}
                onChange={(e) => setAnasinifiGizle(e.target.checked)}
              />
              Anasınıfını sayma
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={birinciGizle}
              onChange={(e) => setBirinciGizle(e.target.checked)}
            />
            1. sınıfları sayma
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Ozet baslik="Eşik altı" deger={String(suzulmus.length)} renk="text-red-600" />
        <Ozet
          baslik="Okul ortancası"
          deger={ortanca === null ? '—' : `%${ortanca}`}
          alt={`${olculenler.length} aylıkçı öğrenci`}
        />
        <Ozet
          baslik="Hiç gelmemiş"
          deger={String(hicGelmeyen)}
          alt={hicGelmeyen > 0 ? 'ödeme almışsa önce kontrol et' : undefined}
          renk={hicGelmeyen > 0 ? 'text-red-600' : undefined}
        />
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
              <th className="text-right">Geliş</th>
              <th className="text-right">Oran</th>
              <th>Son geliş</th>
              <th>Veli</th>
              <th>Telefon</th>
              <th className="text-right">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {suzulmus.map((s) => {
              const telefon = s.veli_telefon ?? s.veli2_telefon
              const veli = s.veli_telefon ? s.veli_adi : (s.veli2_adi ?? s.veli_adi)
              return (
                <tr key={s.student_id}>
                  <td className="tabular-nums text-solgun">{s.ogrenci_no}</td>
                  <td>
                    <Link
                      href={`/students/${s.student_id}`}
                      className="font-medium text-vurgu hover:underline"
                    >
                      {s.ad_soyad}
                    </Link>
                    <DenemeRozeti deneme={s.deneme} />
                  </td>
                  <td>{s.sinif ?? '—'}</td>
                  <td className="text-right tabular-nums text-solgun">
                    {s.gelis} / {s.ders_gunu}
                  </td>
                  <td
                    className={`text-right font-bold tabular-nums ${
                      Number(s.oran) < 25 ? 'text-red-600' : 'text-amber-700'
                    }`}
                  >
                    %{Number(s.oran)}
                  </td>
                  <td className="whitespace-nowrap text-solgun">
                    {s.son_gelis ? tarih(s.son_gelis) : 'hiç gelmemiş'}
                  </td>
                  <td>{veli ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    {telefon ? (
                      <a
                        href={`tel:${telefon.replace(/\s/g, '')}`}
                        className="text-vurgu hover:underline"
                      >
                        {telefon}
                      </a>
                    ) : (
                      <span className="rozet bg-amber-100 text-amber-800">telefon yok</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{para(s.kalan ?? 0)}</td>
                </tr>
              )
            })}
            {suzulmus.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center">
                  {arama.trim() ? (
                    <p className="text-solgun">Bu aramayla eşleşen öğrenci yok.</p>
                  ) : (
                    <>
                      <p className="font-medium text-emerald-700">
                        %{esik} altında kalan öğrenci yok.
                      </p>
                      <p className="mt-1 text-sm text-solgun">
                        Eşiği yükseltip daha geniş bakabilirsin.
                      </p>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {yeniKayitlar.length > 0 && (
        <div className="kart p-4">
          <h2 className="font-semibold">Henüz ölçülemeyen {yeniKayitlar.length} öğrenci</h2>
          <p className="mt-1 text-sm text-solgun">
            Aylık aboneliği {EN_AZ_OLCUM_GUNU} yemek gününden kısa süredir açık; oran
            çıkarmak için fazla yeni. Listeye girmiyorlar.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {yeniKayitlar.map((s) => (
              <li key={s.student_id}>
                <Link href={`/students/${s.student_id}`} className="text-vurgu hover:underline">
                  {s.ad_soyad}
                </Link>{' '}
                <span className="text-solgun">
                  ({s.gelis}/{s.ders_gunu} · {tarih(s.olcum_baslangici)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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

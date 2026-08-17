'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { AboneRozeti, Bakiye, DurumRozeti, OgrenciTipiRozeti } from '@/components/Rozetler'
import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'
import type { AboneTipi, OgrenciTipi } from '@/lib/types'

export type OgrenciSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kimlik_no: string | null
  veli_adi: string | null
  veli_telefon: string | null
  veli2_adi: string | null
  veli2_telefon: string | null
  iskonto_orani: number
  iskonto_tutar: number
  devir: number
  ogun_sayisi: number
  kardes_grup_id: string | null
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
  aktif: boolean
  alinan_para: number
  harcanan: number
  kalan: number
}

export function OgrenciListesi({
  ogrenciler,
  siniflar,
}: {
  ogrenciler: OgrenciSatiri[]
  siniflar: string[]
}) {
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')
  const [borc, setBorc] = useState<'hepsi' | 'borclu' | 'borcsuz'>('hepsi')
  const [durum, setDurum] = useState<'aktif' | 'pasif' | 'hepsi'>('aktif')

  const suzulmus = useMemo(
    () =>
      ogrenciler.filter((o) => {
        if (sinif && o.sinif !== sinif) return false
        if (durum === 'aktif' && !o.aktif) return false
        if (durum === 'pasif' && o.aktif) return false
        if (borc === 'borclu' && o.kalan >= 0) return false
        if (borc === 'borcsuz' && o.kalan < 0) return false
        if (!arama.trim()) return true
        return aramaEslesir(
          `${o.ad_soyad} ${o.ogrenci_no} ${o.kimlik_no ?? ''} ${o.veli_adi ?? ''} ${o.veli2_adi ?? ''}`,
          arama,
        )
      }),
    [ogrenciler, arama, sinif, borc, durum],
  )

  // Kardeş sayısı: listede rozet olarak gösterilir, kimin kardeşi olduğu
  // detay sayfasında yazar.
  const kardesSayisi = useMemo(() => {
    const grup = new Map<string, number>()
    for (const o of ogrenciler) {
      if (o.kardes_grup_id) grup.set(o.kardes_grup_id, (grup.get(o.kardes_grup_id) ?? 0) + 1)
    }
    return grup
  }, [ogrenciler])

  const oneriler = useMemo(
    () =>
      suzulmus.map((o) => ({
        deger: o.ad_soyad,
        etiket: o.ad_soyad,
        alt: [o.ogrenci_no, o.sinif].filter(Boolean).join(' · '),
      })),
    [suzulmus],
  )

  const toplamKalan = suzulmus.reduce((t, o) => t + o.kalan, 0)
  const borcluSayisi = suzulmus.filter((o) => o.kalan < 0).length
  const temizlenebilir = arama !== '' || sinif !== '' || borc !== 'hepsi' || durum !== 'aktif'

  return (
    <div className="space-y-4">
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <AramaKutusu
          deger={arama}
          degistir={setArama}
          etiket="Ad / No / Kimlik / Veli"
          ipucu="Adın herhangi bir parçası yeter: öm · be · or"
          sonuc={`${suzulmus.length} / ${ogrenciler.length} öğrenci`}
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

        <div>
          <label className="etiket" htmlFor="borc">
            Borç durumu
          </label>
          <select
            id="borc"
            value={borc}
            onChange={(e) => setBorc(e.target.value as typeof borc)}
            className="girdi"
          >
            <option value="hepsi">Hepsi</option>
            <option value="borclu">Borçlu (eksi bakiye)</option>
            <option value="borcsuz">Borçsuz</option>
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="durum">
            Durum
          </label>
          <select
            id="durum"
            value={durum}
            onChange={(e) => setDurum(e.target.value as typeof durum)}
            className="girdi"
          >
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
            <option value="hepsi">Hepsi</option>
          </select>
        </div>

        {temizlenebilir && (
          <button
            type="button"
            onClick={() => {
              setArama('')
              setSinif('')
              setBorc('hepsi')
              setDurum('aktif')
            }}
            className="btn-ikincil"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Abone / Tip</th>
              <th>Veli</th>
              <th>Telefon</th>
              <th>Kimlik / Kart</th>
              <th className="text-right">İskonto</th>
              <th className="text-right">Devir</th>
              <th className="text-right">Öğün</th>
              <th className="text-right">Alınan</th>
              <th className="text-right">Harcanan</th>
              <th className="text-right">Kalan</th>
              <th>Durum</th>
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
                  {o.kardes_grup_id && (kardesSayisi.get(o.kardes_grup_id) ?? 0) > 1 && (
                    <span
                      className="rozet ml-2 bg-violet-100 text-violet-800"
                      title="Bu öğrencinin kardeşi tanımlı"
                    >
                      kardeş {(kardesSayisi.get(o.kardes_grup_id) ?? 1) - 1}
                    </span>
                  )}
                </td>
                <td>{o.sinif ?? '—'}</td>
                <td className="whitespace-nowrap">
                  <AboneRozeti tip={o.abone_tipi} />
                  <OgrenciTipiRozeti tip={o.ogrenci_tipi} />
                </td>
                <td className="whitespace-nowrap">
                  {o.veli_adi ?? '—'}
                  {o.veli2_adi && (
                    <span className="block text-xs text-solgun">{o.veli2_adi}</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {o.veli_telefon ? (
                    <a
                      href={`tel:${o.veli_telefon.replace(/\s/g, '')}`}
                      className="text-vurgu hover:underline"
                    >
                      {o.veli_telefon}
                    </a>
                  ) : (
                    <span className="text-solgun">—</span>
                  )}
                  {o.veli2_telefon && (
                    <span className="block text-xs text-solgun">{o.veli2_telefon}</span>
                  )}
                </td>
                <td className="tabular-nums text-solgun">{o.kimlik_no ?? '—'}</td>
                <td className="text-right tabular-nums text-solgun">
                  {o.iskonto_orani > 0 || o.iskonto_tutar > 0 ? (
                    <span className="text-amber-700">
                      {o.iskonto_orani > 0 && `%${o.iskonto_orani}`}
                      {o.iskonto_orani > 0 && o.iskonto_tutar > 0 && ' + '}
                      {o.iskonto_tutar > 0 && para(o.iskonto_tutar)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="text-right tabular-nums text-solgun">
                  {o.devir !== 0 ? para(o.devir) : '—'}
                </td>
                <td className="text-right tabular-nums text-solgun">{o.ogun_sayisi}</td>
                <td className="text-right tabular-nums">{para(o.alinan_para)}</td>
                <td className="text-right tabular-nums">{para(o.harcanan)}</td>
                <td className="text-right">
                  <Bakiye tutar={o.kalan} />
                </td>
                <td>
                  <DurumRozeti aktif={o.aktif} />
                </td>
              </tr>
            ))}
            {suzulmus.length === 0 && (
              <tr>
                <td colSpan={14} className="py-8 text-center text-solgun">
                  {arama.trim() ? `"${arama}" ile eşleşen öğrenci yok.` : 'Kayıt bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
          {suzulmus.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={12} className="px-3 py-2">
                  {suzulmus.length} öğrenci · {borcluSayisi} borçlu
                </td>
                <td className="px-3 py-2 text-right">
                  <Bakiye tutar={toplamKalan} kalin />
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

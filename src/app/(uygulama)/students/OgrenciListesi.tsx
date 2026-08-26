'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { Bakiye, DurumRozeti, OgrenciTipiRozeti } from '@/components/Rozetler'
import { aramaEslesir } from '@/lib/arama'
import { para, tarih as tarihBicim } from '@/lib/format'
import type { AboneTipi, OgrenciTipi } from '@/lib/types'

/** Aylıkçının taksit durumu — taksit_durumu görünümünden gelir. */
export type TaksitBilgisi = {
  yillik_toplam: number
  vadesi_gelen: number
  odenen: number
  eksik: number
  odeme_alinmali: boolean
  son_vade: string | null
  ozel_plan: boolean
}

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
  /** Yalnızca aylıkçılarda dolu */
  taksit: TaksitBilgisi | null
}

/**
 * Öğrenci listesi — günlükçüler ve aylıkçılar ayrı.
 *
 * Aylıkçının bakiyesi yanıltıcı: öğün ücreti düşülmediği için "kalan" hep
 * yatırılan paraya eşit görünüyor ve her şey yolundaymış gibi duruyor.
 * Oysa aylıkçının ölçüsü taksit planı — vadesi gelen ne kadar, ne kadarı
 * ödenmiş. Bu yüzden iki grup kendi ölçüsüyle listeleniyor.
 */
export function OgrenciListesi({
  ogrenciler,
  siniflar,
  sezonVarMi,
}: {
  ogrenciler: OgrenciSatiri[]
  siniflar: string[]
  sezonVarMi: boolean
}) {
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')
  const [borc, setBorc] = useState<'hepsi' | 'borclu' | 'borcsuz'>('hepsi')
  const [durum, setDurum] = useState<'aktif' | 'pasif' | 'hepsi'>('aktif')

  /** Aylıkçıda borç taksit eksiğidir, günlükçüde eksi bakiye. */
  const borcluMu = (o: OgrenciSatiri) =>
    o.abone_tipi === 'aylik' ? (o.taksit?.eksik ?? 0) > 0 : o.kalan < 0

  const suzulmus = useMemo(
    () =>
      ogrenciler.filter((o) => {
        if (sinif && o.sinif !== sinif) return false
        if (durum === 'aktif' && !o.aktif) return false
        if (durum === 'pasif' && o.aktif) return false
        if (borc === 'borclu' && !borcluMu(o)) return false
        if (borc === 'borcsuz' && borcluMu(o)) return false
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

  const gunlukculer = suzulmus.filter((o) => o.abone_tipi === 'gunluk')
  const aylikcilar = suzulmus.filter((o) => o.abone_tipi === 'aylik')
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
            <option value="borclu">Borçlu</option>
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

      <AylikciBolumu
        ogrenciler={aylikcilar}
        kardesSayisi={kardesSayisi}
        sezonVarMi={sezonVarMi}
        arama={arama}
      />

      <GunlukcuBolumu ogrenciler={gunlukculer} kardesSayisi={kardesSayisi} arama={arama} />
    </div>
  )
}

/** Ad + kardeş rozeti — iki tabloda da aynı görünür. */
function AdHucresi({
  ogrenci,
  kardesSayisi,
}: {
  ogrenci: OgrenciSatiri
  kardesSayisi: Map<string, number>
}) {
  return (
    <td>
      <Link
        href={`/students/${ogrenci.student_id}`}
        className="font-medium text-vurgu hover:underline"
      >
        {ogrenci.ad_soyad}
      </Link>
      {ogrenci.kardes_grup_id && (kardesSayisi.get(ogrenci.kardes_grup_id) ?? 0) > 1 && (
        <span
          className="rozet ml-2 bg-violet-100 text-violet-800"
          title="Bu öğrencinin kardeşi tanımlı"
        >
          kardeş {(kardesSayisi.get(ogrenci.kardes_grup_id) ?? 1) - 1}
        </span>
      )}
    </td>
  )
}

function VeliHucreleri({ ogrenci }: { ogrenci: OgrenciSatiri }) {
  return (
    <>
      <td className="whitespace-nowrap">
        {ogrenci.veli_adi ?? '—'}
        {ogrenci.veli2_adi && (
          <span className="block text-xs text-solgun">{ogrenci.veli2_adi}</span>
        )}
      </td>
      <td className="whitespace-nowrap">
        {ogrenci.veli_telefon ? (
          <a
            href={`tel:${ogrenci.veli_telefon.replace(/\s/g, '')}`}
            className="text-vurgu hover:underline"
          >
            {ogrenci.veli_telefon}
          </a>
        ) : (
          <span className="text-solgun">—</span>
        )}
        {ogrenci.veli2_telefon && (
          <span className="block text-xs text-solgun">{ogrenci.veli2_telefon}</span>
        )}
      </td>
    </>
  )
}

/**
 * Aylıkçılar — ölçü taksit planı.
 *
 * Bakiye kolonları burada yok: aylıkçıdan öğün başına para düşülmediği için
 * "kalan" hep yatırılan paraya eşit çıkıyor ve borçluyu borçsuz gösteriyor.
 */
function AylikciBolumu({
  ogrenciler,
  kardesSayisi,
  sezonVarMi,
  arama,
}: {
  ogrenciler: OgrenciSatiri[]
  kardesSayisi: Map<string, number>
  sezonVarMi: boolean
  arama: string
}) {
  const gecikmis = ogrenciler.filter((o) => (o.taksit?.eksik ?? 0) > 0)
  const toplamEksik = gecikmis.reduce((t, o) => t + (o.taksit?.eksik ?? 0), 0)
  // Planı olmayan öğrenci "borcu yok" sayılamaz; ölçüsü henüz yok demektir.
  const plansiz = ogrenciler.filter((o) => !o.taksit || o.taksit.yillik_toplam === 0)

  return (
    <div className="kart overflow-x-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cizgi px-4 py-3">
        <h2 className="font-semibold">
          Aylıkçılar <span className="text-solgun">({ogrenciler.length})</span>
        </h2>
        <span className="text-sm">
          {gecikmis.length > 0 ? (
            <span className="text-red-700">
              <strong>{gecikmis.length}</strong> öğrencinin taksit borcu var ·{' '}
              <strong>{para(toplamEksik)}</strong>
            </span>
          ) : plansiz.length === ogrenciler.length ? (
            <span className="text-amber-700">Taksit planı tanımlı değil</span>
          ) : (
            <span className="text-emerald-700">Taksit borcu olan yok</span>
          )}
          <Link href="/reports/taksit" className="ml-3 text-vurgu hover:underline">
            Taksit takibi →
          </Link>
        </span>
      </div>

      {ogrenciler.length > 0 && (!sezonVarMi || plansiz.length > 0) && (
        <p className="bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {!sezonVarMi
            ? 'Sezon tanımlı değil, bu yüzden taksit durumu hesaplanamıyor.'
            : `${plansiz.length} aylıkçı öğrencinin taksit planı yok; bu öğrenciler ödemesi tamammış gibi görünür ama aslında ölçülmüyor.`}{' '}
          <Link href="/admin/settings" className="underline">
            Ayarlardan sezon ve taksit planı tanımlayın
          </Link>
          .
        </p>
      )}

      <table className="tablo">
        <thead>
          <tr>
            <th>No</th>
            <th>Ad Soyad</th>
            <th>Sınıf</th>
            <th>Tip</th>
            <th>Veli</th>
            <th>Telefon</th>
            <th className="text-right">Yıllık Plan</th>
            <th className="text-right">Vadesi Gelen</th>
            <th className="text-right">Ödenen</th>
            <th className="text-right">Eksik</th>
            <th>Taksit Durumu</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {ogrenciler.map((o) => {
            const t = o.taksit
            const eksik = t?.eksik ?? 0
            const planVar = t !== null && t.yillik_toplam > 0
            return (
              <tr key={o.student_id} className={eksik > 0 ? 'bg-red-50/50' : undefined}>
                <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                <AdHucresi ogrenci={o} kardesSayisi={kardesSayisi} />
                <td>{o.sinif ?? '—'}</td>
                <td className="whitespace-nowrap">
                  <OgrenciTipiRozeti tip={o.ogrenci_tipi} />
                  {t?.ozel_plan && (
                    <span
                      className="rozet ml-1 bg-blue-100 text-blue-800"
                      title="Bu öğrenciye özel taksit planı tanımlı"
                    >
                      özel plan
                    </span>
                  )}
                </td>
                <VeliHucreleri ogrenci={o} />
                <td className="text-right tabular-nums text-solgun">
                  {planVar ? para(t.yillik_toplam) : '—'}
                </td>
                <td className="text-right tabular-nums">
                  {planVar ? para(t.vadesi_gelen) : '—'}
                </td>
                <td className="text-right tabular-nums text-emerald-700">
                  {t ? para(t.odenen) : '—'}
                </td>
                <td
                  className={`text-right font-semibold tabular-nums ${
                    eksik > 0 ? 'text-red-600' : 'text-solgun'
                  }`}
                >
                  {eksik > 0 ? para(eksik) : '—'}
                </td>
                <td className="whitespace-nowrap">
                  {!planVar ? (
                    <span
                      className="rozet bg-amber-100 text-amber-800"
                      title="Bu öğrenci için taksit planı tanımlı olmadığından ödeme durumu ölçülemiyor"
                    >
                      taksit planı yok
                    </span>
                  ) : eksik > 0 ? (
                    <span className="rozet bg-red-100 text-red-800">
                      taksit ödenmedi
                      {t.son_vade && (
                        <span className="ml-1 font-normal">
                          · vade {tarihBicim(t.son_vade)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="rozet bg-emerald-100 text-emerald-800">
                      taksitler ödendi
                    </span>
                  )}
                </td>
                <td>
                  <DurumRozeti aktif={o.aktif} />
                </td>
              </tr>
            )
          })}
          {ogrenciler.length === 0 && (
            <tr>
              <td colSpan={12} className="py-8 text-center text-solgun">
                {arama.trim() ? `"${arama}" ile eşleşen aylıkçı yok.` : 'Aylıkçı öğrenci yok.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Günlükçüler — ölçü bakiye: yatırılan para eksi yenen öğünler. */
function GunlukcuBolumu({
  ogrenciler,
  kardesSayisi,
  arama,
}: {
  ogrenciler: OgrenciSatiri[]
  kardesSayisi: Map<string, number>
  arama: string
}) {
  const toplamKalan = ogrenciler.reduce((t, o) => t + o.kalan, 0)
  const borclu = ogrenciler.filter((o) => o.kalan < 0)

  return (
    <div className="kart overflow-x-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cizgi px-4 py-3">
        <h2 className="font-semibold">
          Günlükçüler <span className="text-solgun">({ogrenciler.length})</span>
        </h2>
        <span className="text-sm">
          {borclu.length > 0 ? (
            <span className="text-red-700">
              <strong>{borclu.length}</strong> öğrencinin bakiyesi eksi
            </span>
          ) : (
            <span className="text-emerald-700">Eksi bakiyeli yok</span>
          )}
        </span>
      </div>

      <table className="tablo">
        <thead>
          <tr>
            <th>No</th>
            <th>Ad Soyad</th>
            <th>Sınıf</th>
            <th>Tip</th>
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
          {ogrenciler.map((o) => (
            <tr key={o.student_id}>
              <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
              <AdHucresi ogrenci={o} kardesSayisi={kardesSayisi} />
              <td>{o.sinif ?? '—'}</td>
              <td className="whitespace-nowrap">
                <OgrenciTipiRozeti tip={o.ogrenci_tipi} />
              </td>
              <VeliHucreleri ogrenci={o} />
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
          {ogrenciler.length === 0 && (
            <tr>
              <td colSpan={14} className="py-8 text-center text-solgun">
                {arama.trim() ? `"${arama}" ile eşleşen günlükçü yok.` : 'Günlükçü öğrenci yok.'}
              </td>
            </tr>
          )}
        </tbody>
        {ogrenciler.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td colSpan={12} className="px-3 py-2">
                {ogrenciler.length} günlükçü · {borclu.length} eksi bakiyeli
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
  )
}

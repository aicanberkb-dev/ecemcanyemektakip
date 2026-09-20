'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { AboneRozeti } from '@/components/Rozetler'
import { para, tarih as tarihBicim } from '@/lib/format'
import { ODEME_YONTEMI_ADLARI, type AboneTipi, type OdemeYontemi } from '@/lib/types'

import { faturaKesildiDegistir } from './actions'

export type FaturaOdemesi = {
  id: string
  tarih: string
  tutar: number
  odeme_yontemi: OdemeYontemi | null
  aciklama: string | null
}

export type FaturaSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  aktif: boolean
  veli_adi: string | null
  fatura_bilgisi: string | null
  ozel_not: string | null
  odemeler: FaturaOdemesi[]
  /** Bu dönem için kesilmişse kesildiği tarih ve o anki tutar */
  kesildi: { tarih: string; tutar: number } | null
}

export function FaturaListesi({
  satirlar,
  bas,
  bit,
}: {
  satirlar: FaturaSatiri[]
  bas: string
  bit: string
}) {
  const [acik, setAcik] = useState<string | null>(null)

  return (
    <div className="kart overflow-x-auto">
      <table className="tablo">
        <thead>
          <tr>
            <th className="text-center">Kesildi</th>
            <th>No</th>
            <th>Öğrenci</th>
            <th>Sınıf</th>
            <th>Abone</th>
            <th>Veli</th>
            <th>Fatura Bilgileri</th>
            <th className="text-right">Dönem Tahsilatı</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => {
            const toplam = s.odemeler.reduce((t, o) => t + o.tutar, 0)
            const acikMi = acik === s.student_id
            return (
              <FaturaSatir
                key={s.student_id}
                satir={s}
                toplam={toplam}
                bas={bas}
                bit={bit}
                acik={acikMi}
                ac={() => setAcik(acikMi ? null : s.student_id)}
              />
            )
          })}
          {satirlar.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-solgun">
                Fatura istiyor işareti konmuş öğrenci yok. İşaret öğrenci ana verisinde,
                Özel Not alanının yanında.
              </td>
            </tr>
          )}
        </tbody>
        {satirlar.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td colSpan={7} className="px-3 py-2">
                Toplam
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                {para(
                  satirlar.reduce(
                    (t, s) => t + s.odemeler.reduce((a, o) => a + o.tutar, 0),
                    0,
                  ),
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function FaturaSatir({
  satir,
  toplam,
  bas,
  bit,
  acik,
  ac,
}: {
  satir: FaturaSatiri
  toplam: number
  bas: string
  bit: string
  acik: boolean
  ac: () => void
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  function degistir(kesildi: boolean) {
    setHata(null)
    baslat(async () => {
      const sonuc = await faturaKesildiDegistir(satir.student_id, bas, bit, toplam, kesildi)
      if (sonuc.hata) setHata(sonuc.hata)
      else router.refresh()
    })
  }

  return (
    <>
      <tr className={satir.kesildi ? 'bg-emerald-50/60' : undefined}>
        <td className="text-center">
          <label className="inline-flex cursor-pointer flex-col items-center gap-0.5">
            <input
              type="checkbox"
              checked={!!satir.kesildi}
              disabled={bekliyor}
              onChange={(e) => degistir(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            {satir.kesildi && (
              <span className="text-[10px] whitespace-nowrap text-emerald-700">
                {tarihBicim(satir.kesildi.tarih)}
              </span>
            )}
          </label>
        </td>
        <td className="tabular-nums text-solgun">{satir.ogrenci_no}</td>
        <td className="font-medium">
          <Link href={`/students/${satir.student_id}`} className="text-vurgu hover:underline">
            {satir.ad_soyad}
          </Link>
          {!satir.aktif && <span className="rozet ml-1 bg-slate-100 text-slate-600">Pasif</span>}
          {hata && <p className="text-xs text-red-600">{hata}</p>}
        </td>
        <td>{satir.sinif ?? '—'}</td>
        <td>
          <AboneRozeti tip={satir.abone_tipi} />
        </td>
        <td className="text-solgun">{satir.veli_adi ?? '—'}</td>
        <td className="max-w-80 text-xs whitespace-pre-wrap">
          {satir.fatura_bilgisi ?? (
            <span className="text-solgun">
              {satir.ozel_not ?? '— girilmemiş —'}
            </span>
          )}
        </td>
        <td className="text-right whitespace-nowrap">
          <span className="font-medium tabular-nums text-emerald-700">{para(toplam)}</span>
          <button
            type="button"
            onClick={ac}
            className="yazdirma-gizle ml-2 text-xs text-vurgu hover:underline"
          >
            {acik ? 'gizle' : `${satir.odemeler.length} ödeme`}
          </button>
          {satir.kesildi && satir.kesildi.tutar !== toplam && (
            <p className="text-[11px] text-amber-700">
              kesilirken {para(satir.kesildi.tutar)} idi
            </p>
          )}
        </td>
      </tr>

      {/* Ödeme dökümü: fatura tutarı hangi tahsilatlardan geliyor */}
      {(acik || satir.kesildi) && satir.odemeler.length > 0 && (
        <tr className={acik ? '' : 'yazdirma-goster hidden print:table-row'}>
          <td />
          <td colSpan={7} className="bg-slate-50">
            <table className="w-full text-xs">
              <tbody>
                {satir.odemeler.map((o) => (
                  <tr key={o.id}>
                    <td className="py-1 pr-3 whitespace-nowrap text-solgun">
                      {tarihBicim(o.tarih)}
                    </td>
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {o.odeme_yontemi ? ODEME_YONTEMI_ADLARI[o.odeme_yontemi] : 'belirtilmemiş'}
                    </td>
                    <td className="py-1 pr-3 text-solgun">{o.aciklama ?? '—'}</td>
                    <td className="py-1 text-right font-medium tabular-nums text-emerald-700">
                      {para(o.tutar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

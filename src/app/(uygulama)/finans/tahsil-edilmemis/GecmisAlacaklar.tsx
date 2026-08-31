'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'

import { useBugun } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import { faturaKapat } from '../actions'

export type GecmisSatir = {
  id: string
  cariAdi: string
  grup: string
  cariSira: number
  /** "2026-08" — sıralama için */
  donem: string
  donemAdi: string
  adet: number | null
  tutar: number
  tahsil: number
  kalan: number
  kapatildi: string | null
}

/**
 * Geçmiş ayların açık faturaları, cari grubuna göre.
 *
 * Sıralama grup → cari → dönem: aynı kurumun birikmiş aylarını alt alta
 * görmek, hangi ayın atlandığını en çabuk gösteren düzen.
 */
export function GecmisAlacaklar({
  satirlar,
  gruplar,
}: {
  satirlar: GecmisSatir[]
  gruplar: { anahtar: string; ad: string }[]
}) {
  if (satirlar.length === 0) {
    return (
      <div className="kart p-8 text-center">
        <p className="font-medium text-emerald-700">
          Geçmiş ayların tamamı tahsil edilmiş.
        </p>
        <p className="mt-1 text-sm text-solgun">Takipte bekleyen fatura yok.</p>
      </div>
    )
  }

  return (
    <div className="kart overflow-x-auto">
      <table className="tablo">
        <thead>
          <tr>
            <th>Cari</th>
            <th>Dönem</th>
            <th className="text-right">Adet</th>
            <th className="text-right">Fatura</th>
            <th className="text-right">Tahsil</th>
            <th className="text-right">Kalan</th>
            <th className="text-right yazdirma-gizle">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {gruplar.map((g) => {
            const grubun = satirlar
              .filter((s) => s.grup === g.anahtar)
              .sort(
                (a, b) => a.cariSira - b.cariSira || a.donem.localeCompare(b.donem),
              )
            if (grubun.length === 0) return null
            const grupKalan = grubun.reduce((t, s) => t + s.kalan, 0)

            return (
              <Fragment key={g.anahtar}>
                <tr className="bg-slate-100">
                  <td
                    colSpan={5}
                    className="py-1.5 text-xs font-bold tracking-wide text-slate-700"
                  >
                    {g.ad}
                  </td>
                  <td className="py-1.5 text-right text-xs font-bold tabular-nums text-amber-800">
                    {para(grupKalan)}
                  </td>
                  <td className="yazdirma-gizle" />
                </tr>
                {grubun.map((s) => (
                  <Satir key={s.id} satir={s} />
                ))}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td colSpan={5} className="px-3 py-2">
              Toplam
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-amber-800">
              {para(satirlar.reduce((t, s) => t + s.kalan, 0))}
            </td>
            <td className="yazdirma-gizle" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Satir({ satir }: { satir: GecmisSatir }) {
  const router = useRouter()
  const bugun = useBugun()
  const [calisiyor, setCalisiyor] = useState(false)
  const kapali = !!satir.kapatildi

  async function degistir() {
    setCalisiyor(true)
    try {
      const s = await faturaKapat(satir.id, kapali ? null : bugun)
      if (s.hata) alert(s.hata)
      else router.refresh()
    } finally {
      setCalisiyor(false)
    }
  }

  // Eksik tahsilat kısmi mi, hiç mi? Kısmi ödeme farklı bir hikâye:
  // takip ederken "hiç ödemedi" ile "eksik ödedi" ayrımı önemli.
  const kismi = !kapali && satir.tahsil > 0.005 && satir.kalan > 0.005

  return (
    <tr className={kapali ? 'bg-emerald-50/60' : undefined}>
      <td className="font-medium">
        {satir.cariAdi}
        {kapali && (
          <span
            className="rozet ml-2 bg-emerald-100 text-emerald-800"
            title={`${tarihBicim(satir.kapatildi)} tarihinde ödendi işaretlendi`}
          >
            ödendi
          </span>
        )}
        {kismi && (
          <span className="rozet ml-2 bg-amber-100 text-amber-800">kısmi ödeme</span>
        )}
      </td>
      <td className="whitespace-nowrap">{satir.donemAdi}</td>
      <td className="text-right tabular-nums text-solgun">{satir.adet ?? '—'}</td>
      <td className="text-right tabular-nums">{para(satir.tutar)}</td>
      <td className="text-right tabular-nums text-emerald-700">
        {satir.tahsil > 0 ? para(satir.tahsil) : '—'}
      </td>
      <td
        className={`text-right font-semibold tabular-nums ${
          satir.kalan > 0.005 ? 'text-amber-700' : 'text-emerald-700'
        }`}
      >
        {para(satir.kalan)}
      </td>
      <td className="yazdirma-gizle text-right whitespace-nowrap">
        <button
          type="button"
          disabled={calisiyor}
          onClick={degistir}
          className={
            kapali
              ? 'text-xs text-solgun hover:underline'
              : 'btn-birincil !px-3 !py-1 text-xs'
          }
          title={
            kapali
              ? 'Ödendi işaretini kaldır'
              : 'Tahsilat tamam — tutar birebir tutmasa da faturayı kapat'
          }
        >
          {kapali ? 'Geri al' : 'Ödendi'}
        </button>
      </td>
    </tr>
  )
}

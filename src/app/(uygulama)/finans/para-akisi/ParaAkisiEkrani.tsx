'use client'

import { useMemo, useState } from 'react'

import { useBugun } from '@/components/BugunSaglayici'
import {
  araliktaMi,
  ayEtiketi,
  BOS_ARALIK,
  TarihFiltresi,
  type Aralik,
} from '@/components/TarihFiltresi'
import { para, tarih as tarihBicim } from '@/lib/format'

/** `para_akisi_gunluk` fonksiyonunun döndürdüğü bir gün */
export type GunSatiri = {
  tarih: string
  nakit: number | string
  kart: number | string
  ek_gelir: number | string
  ogrenci: number | string
  kurum: number | string
  gider: number | string
  birikim_arti: number | string
  birikim_eksi: number | string
}

const s = (v: number | string) => Number(v ?? 0)

/** Bir günün girenleri, çıkanları ve aradaki fark */
function hesapla(g: GunSatiri) {
  const giren = s(g.nakit) + s(g.kart) + s(g.ek_gelir) + s(g.ogrenci) + s(g.kurum)
  const birikim = s(g.birikim_arti) - s(g.birikim_eksi)
  return { giren, gider: s(g.gider), birikim, kalan: giren - s(g.gider) - birikim }
}

export function ParaAkisiEkrani({ gunler }: { gunler: GunSatiri[] }) {
  const bugun = useBugun()
  const [aralik, setAralik] = useState<Aralik>(BOS_ARALIK)

  const aylar = useMemo(
    () => [...new Set(gunler.map((g) => g.tarih.slice(0, 7)))].sort().reverse(),
    [gunler],
  )

  const suzulmus = useMemo(
    () => gunler.filter((g) => araliktaMi(g.tarih, aralik)),
    [gunler, aralik],
  )

  const toplam = useMemo(() => {
    const t = {
      nakit: 0,
      kart: 0,
      ek: 0,
      ogrenci: 0,
      kurum: 0,
      gider: 0,
      arti: 0,
      eksi: 0,
    }
    for (const g of suzulmus) {
      t.nakit += s(g.nakit)
      t.kart += s(g.kart)
      t.ek += s(g.ek_gelir)
      t.ogrenci += s(g.ogrenci)
      t.kurum += s(g.kurum)
      t.gider += s(g.gider)
      t.arti += s(g.birikim_arti)
      t.eksi += s(g.birikim_eksi)
    }
    const giren = t.nakit + t.kart + t.ek + t.ogrenci + t.kurum
    const birikim = t.arti - t.eksi
    return { ...t, giren, birikim, kalan: giren - t.gider - birikim }
  }, [suzulmus])

  const kalanRenk =
    Math.abs(toplam.kalan) < 1
      ? 'text-slate-700'
      : toplam.kalan > 0
        ? 'text-amber-700'
        : 'text-red-700'

  return (
    <div className="space-y-4">
      <div className="kart p-4">
        <TarihFiltresi
          bugun={bugun}
          aralik={aralik}
          degistir={setAralik}
          aylar={aylar}
          ozet={
            <>
              <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
                {aralik.ay ? ayEtiketi(aralik.ay) : 'Seçili aralık'}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${kalanRenk}`}>
                {para(toplam.kalan)}
              </p>
              <p className="text-xs text-solgun">kayıt dışı · {suzulmus.length} gün</p>
            </>
          }
        />
      </div>

      {/* Dört büyük rakam: giren, çıkan, birikim, kalan */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kart bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Giren</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(toplam.giren)}</p>
          <p className="mt-0.5 text-xs opacity-75">ciro · tahsilat</p>
        </div>
        <div className="kart bg-red-50 p-4 text-red-900">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Çıkan</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(toplam.gider)}</p>
          <p className="mt-0.5 text-xs opacity-75">günlük masraf</p>
        </div>
        <div className="kart bg-indigo-50 p-4 text-indigo-900">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Birikim</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(toplam.birikim)}</p>
          <p className="mt-0.5 text-xs opacity-75">
            {para(toplam.arti)} artı · {para(toplam.eksi)} eksi
          </p>
        </div>
        <div className="kart bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
            Kayıt dışı
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${kalanRenk}`}>
            {para(toplam.kalan)}
          </p>
          <p className="mt-0.5 text-xs opacity-75">giren − çıkan − birikim</p>
        </div>
      </div>

      {/* Girenin kırılımı: hangi kanaldan ne geldi */}
      <div className="kart p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-solgun uppercase">
          Giren para nereden geldi
        </p>
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {[
            { ad: 'Nakit', tutar: toplam.nakit },
            { ad: 'Kredi kartı', tutar: toplam.kart },
            { ad: 'Öğrenci parası', tutar: toplam.ogrenci },
            { ad: 'Kurum ödemeleri', tutar: toplam.kurum },
            { ad: 'Ek gelir', tutar: toplam.ek },
          ].map((k) => (
            <div key={k.ad} className="flex items-baseline justify-between gap-2">
              <span className="text-solgun">{k.ad}</span>
              <span className="font-semibold tabular-nums">{para(k.tutar)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="kart overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th className="text-right">Giren</th>
                <th className="text-right">Çıkan</th>
                <th className="text-right">Birikim</th>
                <th className="text-right">Kayıt dışı</th>
              </tr>
            </thead>
            <tbody>
              {suzulmus.map((g) => {
                const h = hesapla(g)
                return (
                  <tr key={g.tarih}>
                    <td className="whitespace-nowrap">{tarihBicim(g.tarih)}</td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums text-emerald-700">
                      {h.giren > 0 ? para(h.giren) : '—'}
                      {h.giren > 0 && (
                        <span className="block text-[11px] font-normal text-solgun">
                          {para(s(g.nakit))} nakit · {para(s(g.kart))} kart
                        </span>
                      )}
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums text-red-700">
                      {h.gider > 0 ? para(h.gider) : '—'}
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums text-indigo-700">
                      {h.birikim !== 0 ? para(h.birikim) : '—'}
                    </td>
                    <td
                      className={`text-right font-semibold whitespace-nowrap tabular-nums ${
                        Math.abs(h.kalan) < 1 ? 'text-solgun' : 'text-amber-700'
                      }`}
                    >
                      {para(h.kalan)}
                    </td>
                  </tr>
                )
              })}
              {suzulmus.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-solgun">
                    Seçili aralıkta kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-cizgi font-bold">
                <td>Toplam</td>
                <td className="text-right tabular-nums text-emerald-700">
                  {para(toplam.giren)}
                </td>
                <td className="text-right tabular-nums text-red-700">{para(toplam.gider)}</td>
                <td className="text-right tabular-nums text-indigo-700">
                  {para(toplam.birikim)}
                </td>
                <td className={`text-right tabular-nums ${kalanRenk}`}>
                  {para(toplam.kalan)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-solgun">
        <strong>Kayıt dışı</strong> = giren − çıkan − birikim. Artı çıkması, giren paranın
        bir kısmının ne masrafa ne birikime yazıldığını gösterir; eksi çıkması, deftere
        girmemiş bir gelirin harcandığı anlamına gelir. Günlük satırda büyük sapma varsa
        o günün masraf ya da ciro kaydı eksiktir.
      </p>
    </div>
  )
}

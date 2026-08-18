'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { AY_ADLARI, bugunISO, para, tarih as tarihBicim } from '@/lib/format'

import {
  cariEkle,
  cariSil,
  faturaEkle,
  faturaGuncelle,
  faturaSil,
  tahsilatEkle,
  tahsilatSil,
  type FinansDurumu,
} from '../actions'

export type Cari = {
  id: string
  ad: string
  hizmet_noktasi_id: string | null
  aktif: boolean
  sira: number
}

export type Fatura = {
  id: string
  cari_id: string
  donem_yil: number
  donem_ay: number
  adet: number | null
  tutar: number | string
  fatura_no: string | null
  aciklama: string | null
}

export type Tahsilat = {
  id: string
  fatura_id: string
  tarih: string
  tutar: number | string
}

/** "12.345,67" → 12345.67 */
function sayiOku(metin: string): number {
  const temiz = metin.trim().replace(/\s/g, '')
  if (temiz === '') return 0
  const normal = temiz.includes(',')
    ? temiz.replace(/\./g, '').replace(',', '.')
    : temiz
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Aylık alacak takibi.
 *
 * Excel'de her ay bir blok, her cari bir satır, yanına gelen ödemeler
 * yeşil hücrelerle yazılıyordu. Burada aynı şey: fatura tutarı bir satır,
 * tahsilatlar altında liste. Kalan sıfırlanınca satır yeşile döner.
 */
export function AlacakEkrani({
  yil,
  ay,
  cariler,
  faturalar,
  tahsilatlar,
}: {
  yil: number
  ay: number
  cariler: Cari[]
  faturalar: Fatura[]
  tahsilatlar: Tahsilat[]
}) {
  const [cariAcik, setCariAcik] = useState(false)
  const [faturaAcik, setFaturaAcik] = useState(false)
  const [cDurum, cGonder, cBekliyor] = useActionState(cariEkle, {} as FinansDurumu)
  const [fDurum, fGonder, fBekliyor] = useActionState(faturaEkle, {} as FinansDurumu)

  if (cDurum.basari && cariAcik) setCariAcik(false)
  if (fDurum.basari && faturaAcik) setFaturaAcik(false)

  const faturaliCariler = new Set(faturalar.map((f) => f.cari_id))
  const faturasizCariler = cariler.filter((c) => !faturaliCariler.has(c.id))

  const toplam = faturalar.reduce((t, f) => t + Number(f.tutar), 0)
  const tahsilToplam = tahsilatlar.reduce((t, x) => t + Number(x.tutar), 0)
  const kalan = toplam - tahsilToplam

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Ozet baslik="Fatura toplamı" tutar={toplam} renk="bg-slate-100 text-slate-800" />
        <Ozet baslik="Tahsil edilen" tutar={tahsilToplam} renk="bg-emerald-50 text-emerald-800" />
        <Ozet
          baslik="Kalan alacak"
          tutar={kalan}
          renk={kalan > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}
        />
      </div>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <form className="flex items-end gap-2">
          <div>
            <label className="etiket" htmlFor="ay">
              Ay
            </label>
            <select id="ay" name="ay" defaultValue={String(ay)} className="girdi">
              {AY_ADLARI.map((adi, i) => (
                <option key={adi} value={i + 1}>
                  {adi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiket" htmlFor="yil">
              Yıl
            </label>
            <input
              id="yil"
              type="number"
              name="yil"
              defaultValue={yil}
              min={2000}
              max={2100}
              className="girdi w-28"
            />
          </div>
          <button className="btn-birincil">Göster</button>
        </form>

        <div className="ml-auto flex gap-2">
          {!faturaAcik && (
            <button
              type="button"
              onClick={() => setFaturaAcik(true)}
              className="btn-ikincil !py-1.5"
            >
              + Fatura Ekle
            </button>
          )}
          {!cariAcik && (
            <button
              type="button"
              onClick={() => setCariAcik(true)}
              className="btn-ikincil !py-1.5"
            >
              + Cari Ekle
            </button>
          )}
        </div>
      </div>

      {cariAcik && (
        <form action={cGonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <label className="etiket text-xs">Cari adı</label>
            <input name="ad" placeholder="ör. BEYKOZ KAYMAKAMLIK" className="girdi !py-1.5" />
            {cDurum.alanlar?.ad && <p className="hata">{cDurum.alanlar.ad}</p>}
          </div>
          <button className="btn-birincil !py-1.5" disabled={cBekliyor}>
            Ekle
          </button>
          <button type="button" onClick={() => setCariAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {cDurum.hata && <p className="hata w-full">{cDurum.hata}</p>}
        </form>
      )}

      {faturaAcik && (
        <form action={fGonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="donem_yil" value={yil} />
          <input type="hidden" name="donem_ay" value={ay} />
          <div className="min-w-48 flex-1">
            <label className="etiket text-xs">Cari</label>
            <select name="cari_id" className="girdi !py-1.5">
              {(faturasizCariler.length > 0 ? faturasizCariler : cariler).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiket text-xs">Adet</label>
            <input name="adet" inputMode="numeric" defaultValue="0" className="girdi !py-1.5 w-24" />
          </div>
          <div>
            <label className="etiket text-xs">Tutar (₺)</label>
            <input name="tutar" inputMode="decimal" className="girdi !py-1.5 w-36" />
            {fDurum.alanlar?.tutar && <p className="hata">{fDurum.alanlar.tutar}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Fatura no</label>
            <input name="fatura_no" className="girdi !py-1.5 w-36" />
          </div>
          <button className="btn-birincil !py-1.5" disabled={fBekliyor}>
            {AY_ADLARI[ay - 1]} {yil} için ekle
          </button>
          <button
            type="button"
            onClick={() => setFaturaAcik(false)}
            className="btn-ikincil !py-1.5"
          >
            Vazgeç
          </button>
          {fDurum.hata && <p className="hata w-full">{fDurum.hata}</p>}
        </form>
      )}

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
          {AY_ADLARI[ay - 1]} {yil}
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Cari</th>
              <th className="text-right">Adet</th>
              <th className="text-right">Fatura</th>
              <th className="text-right">Tahsil</th>
              <th className="text-right">Kalan</th>
              <th>Tahsilatlar</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {faturalar.map((f) => (
              <FaturaSatiri
                key={f.id}
                fatura={f}
                cari={cariler.find((c) => c.id === f.cari_id)}
                tahsilatlar={tahsilatlar.filter((t) => t.fatura_id === f.id)}
              />
            ))}
            {faturalar.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  Bu ay için fatura girilmemiş.
                </td>
              </tr>
            )}
          </tbody>
          {faturalar.length > 0 && (
            <tfoot>
              <tr>
                <td className="font-semibold">Toplam</td>
                <td />
                <td className="text-right font-semibold tabular-nums">{para(toplam)}</td>
                <td className="text-right font-semibold tabular-nums text-emerald-700">
                  {para(tahsilToplam)}
                </td>
                <td
                  className={`text-right font-bold tabular-nums ${
                    kalan > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {para(kalan)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Cari listesi — silme buradan */}
      <details className="kart p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Cariler ({cariler.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {cariler.map((c) => (
            <CariRozeti key={c.id} cari={c} />
          ))}
        </div>
        <p className="mt-3 text-xs text-solgun">
          Sistemdeki hizmet yerleriyle aynı adı taşıyan cariler otomatik bağlanır. Cariyi
          silmek, o cariye ait tüm faturaları ve tahsilatları da siler.
        </p>
      </details>
    </div>
  )
}

function Ozet({ baslik, tutar, renk }: { baslik: string; tutar: number; renk: string }) {
  return (
    <div className={`kart p-4 ${renk}`}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{baslik}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{para(tutar)}</p>
    </div>
  )
}

function CariRozeti({ cari }: { cari: Cari }) {
  const router = useRouter()
  return (
    <span className="flex items-center gap-2 rounded border border-cizgi px-2 py-1 text-xs">
      {cari.ad}
      {cari.hizmet_noktasi_id && (
        <span className="rozet bg-blue-100 text-blue-800">sistemde</span>
      )}
      <button
        type="button"
        onClick={async () => {
          if (!confirm(`${cari.ad} carisi ve tüm faturaları silinecek. Emin misiniz?`)) return
          const s = await cariSil(cari.id)
          if (s.hata) alert(s.hata)
          else router.refresh()
        }}
        className="text-red-600 hover:underline"
      >
        ×
      </button>
    </span>
  )
}

function FaturaSatiri({
  fatura,
  cari,
  tahsilatlar,
}: {
  fatura: Fatura
  cari: Cari | undefined
  tahsilatlar: Tahsilat[]
}) {
  const router = useRouter()
  const [tutar, setTutar] = useState(String(fatura.tutar).replace('.', ','))
  const [adet, setAdet] = useState(fatura.adet === null ? '' : String(fatura.adet))
  const [yeniTutar, setYeniTutar] = useState('')
  const [yeniTarih, setYeniTarih] = useState(bugunISO())
  const [calisiyor, setCalisiyor] = useState(false)

  const faturaTutari = Number(fatura.tutar)
  const tahsil = tahsilatlar.reduce((t, x) => t + Number(x.tutar), 0)
  const kalan = faturaTutari - tahsil
  const kapandi = faturaTutari > 0 && kalan <= 0.005

  async function calistir(is: () => Promise<FinansDurumu>) {
    setCalisiyor(true)
    try {
      const s = await is()
      if (s.hata) alert(s.hata)
      else router.refresh()
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <tr className={kapandi ? 'bg-emerald-50/70' : undefined}>
      <td className="font-medium">
        {cari?.ad ?? '—'}
        {kapandi && <span className="rozet ml-2 bg-emerald-100 text-emerald-800">tahsil edildi</span>}
      </td>
      <td className="text-right">
        <input
          value={adet}
          onChange={(e) => setAdet(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={(e) => {
            const metin = e.currentTarget.value
            const a = metin === '' ? null : Number(metin)
            if (a !== fatura.adet) calistir(() => faturaGuncelle(fatura.id, faturaTutari, a))
          }}
          inputMode="numeric"
          placeholder="—"
          className="w-16 rounded border border-cizgi px-2 py-1 text-right text-sm tabular-nums
                     outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
        />
      </td>
      <td className="text-right">
        <input
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          onBlur={(e) => {
            const t = sayiOku(e.currentTarget.value)
            if (Number.isNaN(t)) return
            if (Math.abs(t - faturaTutari) > 0.005)
              calistir(() => faturaGuncelle(fatura.id, t, adet === '' ? null : Number(adet)))
          }}
          inputMode="decimal"
          className="w-32 rounded border border-cizgi px-2 py-1 text-right text-sm font-semibold
                     tabular-nums outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
        />
      </td>
      <td className="text-right tabular-nums text-emerald-700">{para(tahsil)}</td>
      <td
        className={`text-right font-semibold tabular-nums ${
          kalan > 0.005 ? 'text-amber-700' : 'text-emerald-700'
        }`}
      >
        {para(kalan)}
      </td>
      <td>
        <div className="flex flex-wrap items-center gap-1">
          {tahsilatlar.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs
                         font-medium text-emerald-900"
              title={tarihBicim(t.tarih)}
            >
              {para(t.tutar)}
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`${para(t.tutar)} tahsilatı silinecek. Emin misiniz?`)) return
                  calistir(() => tahsilatSil(t.id))
                }}
                className="text-emerald-700 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={yeniTarih}
            onChange={(e) => setYeniTarih(e.target.value)}
            type="date"
            className="rounded border border-cizgi px-1 py-0.5 text-xs outline-none
                       focus:border-vurgu"
          />
          <input
            value={yeniTutar}
            onChange={(e) => setYeniTutar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            // Değer kutunun kendisinden okunuyor: state'e bakmak, hızlı yazıp
            // hemen çıkıldığında bir önceki değeri görme riski taşıyor.
            onBlur={(e) => {
              const metin = e.currentTarget.value
              const t = sayiOku(metin)
              if (metin.trim() === '' || Number.isNaN(t) || t <= 0) return
              calistir(() => tahsilatEkle(fatura.id, yeniTarih, t))
              setYeniTutar('')
            }}
            inputMode="decimal"
            placeholder="+ tahsilat"
            disabled={calisiyor}
            className="w-24 rounded border border-dashed border-slate-300 px-2 py-0.5 text-right
                       text-xs tabular-nums outline-none focus:border-vurgu focus:ring-2
                       focus:ring-blue-100"
          />
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            if (!confirm(`${cari?.ad ?? 'Bu'} faturası ve tahsilatları silinecek. Emin misiniz?`))
              return
            calistir(() => faturaSil(fatura.id))
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Sil
        </button>
      </td>
    </tr>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { para } from '@/lib/format'

import {
  genelGiderEkle,
  genelGiderSil,
  genelGiderTutarKaydet,
  personelYeriAta,
  type MaliyetDurumu,
} from '../actions'

export type Nokta = { id: string; ad: string; okul_id: string | null }

export type Personel = {
  id: string
  ad: string
  calistigi_yer: string | null
  hizmet_noktasi_id: string | null
  aktif: boolean
}

export type Gider = {
  id: string
  kategori: 'maas' | 'sgk' | 'kira' | 'mazot' | 'diger'
  tur: string
  tutar: number | string
  aciklama: string | null
  odeme_tarihi: string | null
}

export type GiderOzeti = {
  maas: number | string
  sgk: number | string
  kira: number | string
  mazot: number | string
  diger: number | string
  toplam: number | string
  hizmet_gunu: number
  gunluk_gider: number | string
}

const KATEGORI_ADI: Record<Gider['kategori'], string> = {
  maas: 'Maaş (ek)',
  sgk: 'Sigorta / SGK',
  kira: 'Kira',
  mazot: 'Mazot',
  diger: 'Diğer',
}

function sayiOku(metin: string): number {
  const temiz = metin.trim().replace(/\s/g, '')
  if (temiz === '') return 0
  const normal = temiz.includes(',') ? temiz.replace(/\./g, '').replace(',', '.') : temiz
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Bir hizmet yerinin aylık genel giderleri.
 *
 * Personel maaşı, o yere bağlanmış personelin kartlarından otomatik gelir;
 * kira, mazot ve diğerleri elle girilir. Toplam, o ay o yere hizmet verilen
 * gün sayısına bölünerek günlük gidere çevrilir ve malzeme maliyetinin
 * üstüne eklenir.
 */
export function GiderEkrani({
  yil,
  ay,
  aylar,
  noktalar,
  secili,
  personeller,
  giderler,
  ozet,
}: {
  yil: number
  ay: number
  aylar: string[]
  noktalar: Nokta[]
  secili: Nokta
  personeller: Personel[]
  giderler: Gider[]
  ozet: GiderOzeti | null
}) {
  const [acik, setAcik] = useState(false)
  const [personelAcik, setPersonelAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(genelGiderEkle, {} as MaliyetDurumu)

  if (durum.basari && acik) setAcik(false)

  const buradakiPersonel = personeller.filter((p) => p.hizmet_noktasi_id === secili.id)
  const yersiz = personeller.filter((p) => !p.hizmet_noktasi_id)
  const gunluk = Number(ozet?.gunluk_gider ?? 0)
  const elleToplam =
    Number(ozet?.sgk ?? 0) +
    Number(ozet?.kira ?? 0) +
    Number(ozet?.mazot ?? 0) +
    Number(ozet?.diger ?? 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {noktalar.map((n) => (
          <Link
            key={n.id}
            href={`/maliyet/giderler?nokta=${n.id}&yil=${yil}&ay=${ay}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              n.id === secili.id
                ? 'border-vurgu bg-vurgu font-semibold text-white'
                : 'border-cizgi bg-white hover:bg-slate-50'
            }`}
          >
            {n.ad}
          </Link>
        ))}
      </div>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <form className="flex items-end gap-2">
          <input type="hidden" name="nokta" value={secili.id} />
          <div>
            <label className="etiket" htmlFor="ay">
              Ay
            </label>
            <select id="ay" name="ay" defaultValue={String(ay)} className="girdi">
              {aylar.map((adi, i) => (
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
        {!acik && (
          <button
            type="button"
            onClick={() => setAcik(true)}
            className="btn-ikincil ml-auto !py-1.5"
          >
            + Gider Ekle
          </button>
        )}
      </div>

      {/* Asıl bakılacak rakam: günlük genel gider */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kutu
          baslik={`${aylar[ay - 1]} ${yil} toplam gider`}
          deger={para(ozet?.toplam ?? 0)}
          renk="bg-slate-100 text-slate-800"
        />
        <Kutu
          baslik="Hizmet günü"
          deger={String(ozet?.hizmet_gunu ?? 0)}
          renk="bg-slate-50 text-slate-700"
          alt="o ay bu yere yemek verilen gün"
        />
        <Kutu
          baslik="Günlük genel gider"
          deger={para(gunluk)}
          renk={gunluk > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}
          alt="malzeme maliyetinin üstüne eklenir"
        />
      </div>

      {acik && (
        <form action={gonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="hizmet_noktasi_id" value={secili.id} />
          <input type="hidden" name="donem_yil" value={yil} />
          <input type="hidden" name="donem_ay" value={ay} />
          <div>
            <label className="etiket text-xs">Kategori</label>
            <select name="kategori" defaultValue="kira" className="girdi !py-1.5">
              <option value="kira">Kira</option>
              <option value="mazot">Mazot</option>
              <option value="sgk">Sigorta / SGK</option>
              <option value="maas">Maaş (ek)</option>
              <option value="diger">Diğer</option>
            </select>
          </div>
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Gider adı</label>
            <input name="tur" placeholder="ör. DÜKKAN KİRASI" className="girdi !py-1.5" />
            {durum.alanlar?.tur && <p className="hata">{durum.alanlar.tur}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Tutar (₺)</label>
            <input name="tutar" inputMode="decimal" className="girdi !py-1.5 w-36" />
            {durum.alanlar?.tutar && <p className="hata">{durum.alanlar.tutar}</p>}
          </div>
          <div className="min-w-36 flex-1">
            <label className="etiket text-xs">Açıklama</label>
            <input name="aciklama" className="girdi !py-1.5" />
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
        </form>
      )}

      {/* Maaş personel kartlarından otomatik gelir */}
      <div className="kart p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-semibold">Personel maaşı — {para(ozet?.maas ?? 0)}</h2>
            <p className="text-xs text-solgun">
              {buradakiPersonel.length} kişi bu yere bağlı. Tutarlar{' '}
              <Link href="/finans/maaslar" className="text-vurgu hover:underline">
                Finans → Maaşlar
              </Link>{' '}
              ekranındaki ücretlerden gelir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPersonelAcik((a) => !a)}
            className="btn-ikincil ml-auto !py-1.5"
          >
            {personelAcik ? 'Kapat' : 'Personel ata'}
          </button>
        </div>

        {buradakiPersonel.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {buradakiPersonel.map((p) => (
              <span
                key={p.id}
                className="rounded border border-cizgi bg-slate-50 px-2 py-1 text-xs"
              >
                {p.ad}
                {p.calistigi_yer && <span className="ml-1 text-solgun">· {p.calistigi_yer}</span>}
              </span>
            ))}
          </div>
        )}

        {personelAcik && (
          <div className="mt-4 border-t border-cizgi pt-3">
            <p className="mb-2 text-xs text-solgun">
              Bu yerde çalışan personeli seçin. Yeri boş bırakılan personelin maaşı hiçbir
              yerin maliyetine girmez — yemekhane dışında çalışanlar için doğrusu budur.
            </p>
            <div className="space-y-1">
              {personeller.map((p) => (
                <PersonelSatiri key={p.id} personel={p} noktalar={noktalar} />
              ))}
            </div>
          </div>
        )}

        {yersiz.length > 0 && !personelAcik && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <strong>{yersiz.length}</strong> personelin yeri seçilmemiş; maaşları hiçbir
            yerin maliyetine girmiyor. Yemekhanede çalışanları bağlamak için{' '}
            <strong>Personel ata</strong> deyin.
          </p>
        )}
      </div>

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
          {secili.ad} — {aylar[ay - 1]} {yil} giderleri
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Gider</th>
              <th className="text-right">Tutar</th>
              <th>Açıklama</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {giderler.map((g) => (
              <GiderSatiri key={g.id} gider={g} />
            ))}
            {giderler.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-solgun">
                  Bu ay bu yere gider girilmemiş. Maaş dışındaki kalemleri buradan ekleyin.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="font-semibold">
                Elle girilen toplam
              </td>
              <td className="text-right font-semibold tabular-nums">{para(elleToplam)}</td>
              <td colSpan={2} className="text-xs text-solgun">
                + personel maaşı {para(ozet?.maas ?? 0)} = {para(ozet?.toplam ?? 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(ozet?.hizmet_gunu ?? 0) === 0 && Number(ozet?.toplam ?? 0) > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bu ay bu yere hizmet verilen gün bulunamadı, o yüzden gider güne bölünemiyor.
          Okullarda gün sonu kaydı, dış hizmet yerlerinde sabit porsiyon girilmiş olması
          gerekiyor.
        </p>
      )}
    </div>
  )
}

function Kutu({
  baslik,
  deger,
  renk,
  alt,
}: {
  baslik: string
  deger: string
  renk: string
  alt?: string
}) {
  return (
    <div className={`kart p-4 ${renk}`}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{baslik}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{deger}</p>
      {alt && <p className="mt-0.5 text-xs opacity-75">{alt}</p>}
    </div>
  )
}

function PersonelSatiri({ personel, noktalar }: { personel: Personel; noktalar: Nokta[] }) {
  const router = useRouter()
  const [calisiyor, setCalisiyor] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-cizgi py-1.5 last:border-0">
      <span className="min-w-32 text-sm font-medium">{personel.ad}</span>
      <span className="min-w-32 text-xs text-solgun">{personel.calistigi_yer ?? '—'}</span>
      <select
        value={personel.hizmet_noktasi_id ?? ''}
        disabled={calisiyor}
        onChange={async (e) => {
          setCalisiyor(true)
          try {
            const s = await personelYeriAta(personel.id, e.target.value || null)
            if (s.hata) alert(s.hata)
            else router.refresh()
          } finally {
            setCalisiyor(false)
          }
        }}
        className="girdi ml-auto !py-1 w-56 text-sm"
      >
        <option value="">— maliyete girmesin —</option>
        {noktalar.map((n) => (
          <option key={n.id} value={n.id}>
            {n.ad}
          </option>
        ))}
      </select>
    </div>
  )
}

function GiderSatiri({ gider }: { gider: Gider }) {
  const router = useRouter()
  const [tutar, setTutar] = useState(String(gider.tutar).replace('.', ','))

  return (
    <tr>
      <td>
        <span className="rozet bg-slate-100 text-slate-700">{KATEGORI_ADI[gider.kategori]}</span>
      </td>
      <td className="font-medium">{gider.tur}</td>
      <td className="text-right">
        <input
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          onBlur={async (e) => {
            const t = sayiOku(e.currentTarget.value)
            if (Number.isNaN(t) || Math.abs(t - Number(gider.tutar)) < 0.005) return
            const s = await genelGiderTutarKaydet(gider.id, t)
            if (s.hata) alert(s.hata)
            else router.refresh()
          }}
          inputMode="decimal"
          className="w-32 rounded border border-cizgi px-2 py-1 text-right text-sm font-semibold
                     tabular-nums outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
        />
      </td>
      <td className="text-solgun">{gider.aciklama ?? '—'}</td>
      <td className="text-right">
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`${gider.tur} gideri silinecek. Emin misiniz?`)) return
            const s = await genelGiderSil(gider.id)
            if (s.hata) alert(s.hata)
            else router.refresh()
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Sil
        </button>
      </td>
    </tr>
  )
}

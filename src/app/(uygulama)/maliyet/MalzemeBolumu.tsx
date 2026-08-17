'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useMemo, useState, useTransition } from 'react'

import { aramaEslesir } from '@/lib/arama'

import {
  malzemeEkle,
  malzemeFiyatiKaydet,
  malzemeGuncelle,
  malzemeSil,
  type MaliyetDurumu,
} from './actions'

export type Malzeme = {
  id: string
  ad: string
  birim: 'kg' | 'lt' | 'adet'
  birim_fiyat: number | string
  aciklama: string | null
}

const BIRIM_ADI: Record<Malzeme['birim'], string> = {
  kg: '₺ / kg',
  lt: '₺ / litre',
  adet: '₺ / adet',
}

/** "12,50" → 12.5; boş → 0 */
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
 * Malzeme listesi ve fiyat girişi.
 *
 * Fiyatlar sık değişiyor; her satır için ayrı form açtırmak yerine fiyat
 * kutusundan çıkınca kaydediliyor. Diğer alanlar (ad, birim) nadiren
 * değiştiği için ayrı düzenleme satırında.
 */
export function MalzemeBolumu({
  malzemeler,
  kullanim,
}: {
  malzemeler: Malzeme[]
  kullanim: Record<string, number>
}) {
  const [arama, setArama] = useState('')
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(malzemeEkle, {} as MaliyetDurumu)

  if (durum.basari && acik) setAcik(false)

  const gosterilen = useMemo(
    () => malzemeler.filter((m) => aramaEslesir(m.ad, arama)),
    [malzemeler, arama],
  )

  const toplamFiyatsiz = gosterilen.filter((m) => Number(m.birim_fiyat) === 0).length

  return (
    <div className="space-y-3">
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="etiket text-xs" htmlFor="malzeme-ara">
            Malzeme ara
          </label>
          <input
            id="malzeme-ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="ör. tavuk, pirinç, salça…"
            className="girdi !py-1.5"
          />
        </div>
        <span className="text-sm text-solgun">
          {gosterilen.length} malzeme
          {toplamFiyatsiz > 0 && ` · ${toplamFiyatsiz} tanesi fiyatsız`}
        </span>
        {!acik && (
          <button type="button" onClick={() => setAcik(true)} className="btn-ikincil !py-1.5">
            + Malzeme Ekle
          </button>
        )}
      </div>

      {acik && (
        <form action={gonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label className="etiket text-xs">Malzeme adı</label>
            <input name="ad" className="girdi !py-1.5" required />
            {durum.alanlar?.ad && <p className="hata">{durum.alanlar.ad}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Birim</label>
            <select name="birim" defaultValue="kg" className="girdi !py-1.5">
              <option value="kg">kg</option>
              <option value="lt">litre</option>
              <option value="adet">adet</option>
            </select>
          </div>
          <div>
            <label className="etiket text-xs">Birim fiyat (₺)</label>
            <input name="birim_fiyat" inputMode="decimal" defaultValue="0" className="girdi !py-1.5 w-32" />
            {durum.alanlar?.birim_fiyat && <p className="hata">{durum.alanlar.birim_fiyat}</p>}
          </div>
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Açıklama</label>
            <input name="aciklama" placeholder="ör. 5 kg'lık teneke" className="girdi !py-1.5" />
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

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Malzeme</th>
              <th>Birim</th>
              <th className="text-right">Birim Fiyat</th>
              <th className="text-right">Kaç yemekte</th>
              <th>Açıklama</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gosterilen.map((m) => (
              <MalzemeSatiri key={m.id} malzeme={m} kullanim={kullanim[m.id] ?? 0} />
            ))}
            {gosterilen.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  {arama ? 'Aramaya uyan malzeme yok.' : 'Henüz malzeme yok.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-solgun">
        Fiyat kutusundan çıktığınızda değişiklik kaydedilir. Fiyatları{' '}
        <strong>KDV hariç</strong> ve <strong>birim başına</strong> girin — 5 kg&apos;lık
        tenekeyi 5&apos;e bölüp kilo fiyatını yazın; reçeteler gramaj üzerinden çarpar.
      </p>
    </div>
  )
}

function MalzemeSatiri({ malzeme, kullanim }: { malzeme: Malzeme; kullanim: number }) {
  const router = useRouter()
  const [duzenle, setDuzenle] = useState(false)
  const eylem = malzemeGuncelle.bind(null, malzeme.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as MaliyetDurumu)

  const [fiyat, setFiyat] = useState(String(malzeme.birim_fiyat).replace('.', ','))
  const [kaydediliyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  if (durum.basari && duzenle) setDuzenle(false)

  function fiyatKaydet() {
    const n = sayiOku(fiyat)
    if (Number.isNaN(n) || n < 0) {
      setHata('Geçersiz fiyat')
      return
    }
    setHata(null)
    if (n === Number(malzeme.birim_fiyat)) return
    basla(async () => {
      const s = await malzemeFiyatiKaydet(malzeme.id, n)
      if (s.hata) setHata(s.hata)
      else router.refresh()
    })
  }

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={6} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="etiket text-xs">Ad</label>
              <input name="ad" defaultValue={malzeme.ad} className="girdi !py-1.5" />
            </div>
            <div>
              <label className="etiket text-xs">Birim</label>
              <select name="birim" defaultValue={malzeme.birim} className="girdi !py-1.5">
                <option value="kg">kg</option>
                <option value="lt">litre</option>
                <option value="adet">adet</option>
              </select>
            </div>
            <div>
              <label className="etiket text-xs">Birim fiyat</label>
              <input
                name="birim_fiyat"
                inputMode="decimal"
                defaultValue={String(malzeme.birim_fiyat).replace('.', ',')}
                className="girdi !py-1.5 w-28"
              />
            </div>
            <div className="min-w-40 flex-1">
              <label className="etiket text-xs">Açıklama</label>
              <input
                name="aciklama"
                defaultValue={malzeme.aciklama ?? ''}
                className="girdi !py-1.5"
              />
            </div>
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              Kaydet
            </button>
            <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className={Number(malzeme.birim_fiyat) === 0 ? 'bg-amber-50/40' : undefined}>
      <td className="font-medium">{malzeme.ad}</td>
      <td className="text-solgun">{BIRIM_ADI[malzeme.birim]}</td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            value={fiyat}
            onChange={(e) => setFiyat(e.target.value)}
            onBlur={fiyatKaydet}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            inputMode="decimal"
            className="w-24 rounded border border-cizgi px-2 py-1 text-right text-sm tabular-nums
                       outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
          />
          <span className="w-12 text-left text-xs text-solgun">
            {kaydediliyor ? '…' : hata ? '!' : ''}
          </span>
        </div>
        {hata && <p className="hata">{hata}</p>}
      </td>
      <td className="text-right tabular-nums text-solgun">{kullanim || '—'}</td>
      <td className="text-solgun">{malzeme.aciklama ?? '—'}</td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          onClick={async () => {
            if (
              !confirm(
                `${malzeme.ad} silinecek.` +
                  (kullanim > 0
                    ? `\n${kullanim} yemeğin reçetesinden de çıkarılır; o yemeklerin maliyeti düşer.`
                    : '') +
                  '\nEmin misiniz?',
              )
            )
              return
            const s = await malzemeSil(malzeme.id)
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

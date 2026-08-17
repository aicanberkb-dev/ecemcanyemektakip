'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { aramaEslesir } from '@/lib/arama'
import { para } from '@/lib/format'

import { receteSatiriKaydet, receteSil } from '../actions'
import type { Malzeme } from '../MalzemeBolumu'

export type YemekOzeti = {
  yemek_adi: string
  kullanim: number
  malzeme_sayisi: number
  maliyet: number | string
}

export type ReceteSatiri = {
  yemek_adi: string
  malzeme_id: string
  miktar: number | string
}

/** kg ve lt gram/ml olarak girilir; adet olduğu gibi. */
function ekranCarpani(birim: Malzeme['birim']) {
  return birim === 'adet' ? 1 : 1000
}

function birimEtiketi(birim: Malzeme['birim']) {
  return birim === 'kg' ? 'g' : birim === 'lt' ? 'ml' : 'adet'
}

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
 * Yemek reçetelerinin düzenlendiği ekran.
 *
 * Solda yemekler, sağda seçili yemeğin malzemeleri. Gramajlar kişi başıdır:
 * 200 kişilik hesabı sistem kişi sayısıyla çarparak yapıyor, kullanıcı tek
 * porsiyonu düşünsün diye böyle.
 */
export function ReceteEkrani({
  yemekler,
  malzemeler,
  receteler,
}: {
  yemekler: YemekOzeti[]
  malzemeler: Malzeme[]
  receteler: ReceteSatiri[]
}) {
  const [arama, setArama] = useState('')
  const [secili, setSecili] = useState<string | null>(yemekler[0]?.yemek_adi ?? null)
  const [yeniYemek, setYeniYemek] = useState('')

  const gosterilen = useMemo(
    () => yemekler.filter((y) => aramaEslesir(y.yemek_adi, arama)),
    [yemekler, arama],
  )

  const malzemeHaritasi = useMemo(() => {
    const m = new Map<string, Malzeme>()
    for (const x of malzemeler) m.set(x.id, x)
    return m
  }, [malzemeler])

  const seciliSatirlar = useMemo(
    () => receteler.filter((r) => r.yemek_adi === secili),
    [receteler, secili],
  )

  const seciliYemek = yemekler.find((y) => y.yemek_adi === secili) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      {/* Yemek listesi */}
      <aside className="kart h-fit p-4 lg:sticky lg:top-4">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Yemek ara…"
          className="girdi !py-1.5"
        />
        <p className="mt-2 text-xs text-solgun">{gosterilen.length} yemek</p>

        <div className="mt-2 max-h-[34rem] space-y-1 overflow-y-auto pr-1">
          {gosterilen.map((y) => (
            <button
              key={y.yemek_adi}
              type="button"
              onClick={() => setSecili(y.yemek_adi)}
              className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                y.yemek_adi === secili
                  ? 'border-vurgu bg-blue-50 font-semibold'
                  : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{y.yemek_adi}</span>
              <span
                className={`shrink-0 text-xs tabular-nums ${
                  y.malzeme_sayisi === 0 ? 'text-amber-700' : 'text-solgun'
                }`}
              >
                {y.malzeme_sayisi === 0 ? 'reçete yok' : para(y.maliyet)}
              </span>
            </button>
          ))}
          {gosterilen.length === 0 && (
            <p className="py-4 text-center text-xs text-solgun">Aramaya uyan yemek yok.</p>
          )}
        </div>

        <div className="mt-3 border-t border-cizgi pt-3">
          <label className="etiket text-xs">Listede olmayan yemek</label>
          <div className="flex gap-2">
            <input
              value={yeniYemek}
              onChange={(e) => setYeniYemek(e.target.value)}
              placeholder="Yemek adı"
              className="girdi !py-1.5"
            />
            <button
              type="button"
              disabled={yeniYemek.trim().length < 2}
              onClick={() => {
                setSecili(yeniYemek.trim().toLocaleUpperCase('tr'))
                setYeniYemek('')
              }}
              className="btn-ikincil !py-1.5 disabled:opacity-40"
            >
              Aç
            </button>
          </div>
          <p className="mt-1 text-xs text-solgun">
            İlk malzemeyi eklediğinizde yemek kalıcı olur.
          </p>
        </div>
      </aside>

      {/* Reçete */}
      {secili ? (
        <Recete
          key={secili}
          yemekAdi={secili}
          ozet={seciliYemek}
          satirlar={seciliSatirlar}
          malzemeler={malzemeler}
          malzemeHaritasi={malzemeHaritasi}
        />
      ) : (
        <div className="kart p-8 text-center text-solgun">Soldan bir yemek seçin.</div>
      )}
    </div>
  )
}

function Recete({
  yemekAdi,
  ozet,
  satirlar,
  malzemeler,
  malzemeHaritasi,
}: {
  yemekAdi: string
  ozet: YemekOzeti | null
  satirlar: ReceteSatiri[]
  malzemeler: Malzeme[]
  malzemeHaritasi: Map<string, Malzeme>
}) {
  const router = useRouter()
  const [calisiyor, basla] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const [yeniMalzeme, setYeniMalzeme] = useState('')
  const [yeniMiktar, setYeniMiktar] = useState('')

  const kullanilan = new Set(satirlar.map((s) => s.malzeme_id))
  const eklenebilir = malzemeler.filter((m) => !kullanilan.has(m.id))

  const toplam = satirlar.reduce((t, s) => {
    const m = malzemeHaritasi.get(s.malzeme_id)
    return t + (m ? Number(s.miktar) * Number(m.birim_fiyat) : 0)
  }, 0)

  function kaydet(malzemeId: string, ekranDegeri: number, birim: Malzeme['birim']) {
    basla(async () => {
      const s = await receteSatiriKaydet(yemekAdi, malzemeId, ekranDegeri / ekranCarpani(birim))
      if (s.hata) setHata(s.hata)
      else {
        setHata(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="kart flex flex-wrap items-center gap-3 p-4">
        <div>
          <h2 className="text-lg font-bold">{yemekAdi}</h2>
          <p className="text-xs text-solgun">
            {ozet ? `${ozet.kullanim} kez menüye girdi` : 'Henüz menüde yok'} ·{' '}
            {satirlar.length} malzeme
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-solgun">Kişi başı maliyet</p>
          <p className="text-2xl font-bold tabular-nums">{para(toplam)}</p>
        </div>
        {satirlar.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`${yemekAdi} reçetesi tümüyle silinecek. Emin misiniz?`)) return
              const s = await receteSil(yemekAdi)
              if (s.hata) setHata(s.hata)
              else router.refresh()
            }}
            className="text-xs text-red-600 hover:underline"
          >
            Reçeteyi sil
          </button>
        )}
      </div>

      {hata && <p className="hata">{hata}</p>}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Malzeme</th>
              <th className="text-right">Kişi başı</th>
              <th className="text-right">Birim fiyat</th>
              <th className="text-right">Tutar</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const m = malzemeHaritasi.get(s.malzeme_id)
              if (!m) return null
              const tutar = Number(s.miktar) * Number(m.birim_fiyat)
              return (
                <MalzemeSatiri
                  key={s.malzeme_id}
                  malzeme={m}
                  miktar={Number(s.miktar)}
                  tutar={tutar}
                  calisiyor={calisiyor}
                  kaydet={kaydet}
                />
              )
            })}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-solgun">
                  Bu yemeğin reçetesi yok. Aşağıdan malzeme ekleyin.
                </td>
              </tr>
            )}
          </tbody>
          {satirlar.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-semibold">
                  Toplam
                </td>
                <td className="text-right font-bold tabular-nums">{para(toplam)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Malzeme ekleme */}
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="etiket text-xs">Malzeme ekle</label>
          <select
            value={yeniMalzeme}
            onChange={(e) => setYeniMalzeme(e.target.value)}
            className="girdi !py-1.5"
          >
            <option value="">— seçin —</option>
            {eklenebilir.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad} ({para(m.birim_fiyat)}/{m.birim})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiket text-xs">
            Kişi başı{' '}
            {yeniMalzeme
              ? `(${birimEtiketi(malzemeler.find((m) => m.id === yeniMalzeme)!.birim)})`
              : ''}
          </label>
          <input
            value={yeniMiktar}
            onChange={(e) => setYeniMiktar(e.target.value)}
            inputMode="decimal"
            placeholder="ör. 80"
            className="girdi !py-1.5 w-28"
          />
        </div>
        <button
          type="button"
          disabled={!yeniMalzeme || calisiyor}
          onClick={() => {
            const m = malzemeler.find((x) => x.id === yeniMalzeme)
            if (!m) return
            const n = sayiOku(yeniMiktar)
            if (Number.isNaN(n) || n <= 0) {
              setHata('Geçerli bir miktar girin.')
              return
            }
            kaydet(m.id, n, m.birim)
            setYeniMalzeme('')
            setYeniMiktar('')
          }}
          className="btn-birincil !py-1.5 disabled:opacity-40"
        >
          Ekle
        </button>
        {eklenebilir.length === 0 && (
          <p className="text-xs text-solgun">
            Tüm malzemeler bu reçetede kullanılmış. Yeni malzemeyi{' '}
            <strong>Malzemeler</strong> sekmesinden ekleyin.
          </p>
        )}
      </div>

      <p className="text-xs text-solgun">
        Gramajlar <strong>bir kişilik</strong>. Kilogram/litre malzemeler gram ve
        mililitre olarak girilir; adetle satılanlar (yumurta, ekmek) adet olarak. Miktarı
        0 yapmak malzemeyi reçeteden çıkarır.
      </p>
    </div>
  )
}

function MalzemeSatiri({
  malzeme,
  miktar,
  tutar,
  calisiyor,
  kaydet,
}: {
  malzeme: Malzeme
  miktar: number
  tutar: number
  calisiyor: boolean
  kaydet: (malzemeId: string, ekranDegeri: number, birim: Malzeme['birim']) => void
}) {
  const ekran = miktar * ekranCarpani(malzeme.birim)
  const [deger, setDeger] = useState(
    String(Number(ekran.toFixed(2))).replace('.', ','),
  )

  function gonder() {
    const n = sayiOku(deger)
    if (Number.isNaN(n) || n < 0) return
    if (Math.abs(n - ekran) < 0.005) return
    kaydet(malzeme.id, n, malzeme.birim)
  }

  return (
    <tr className={Number(malzeme.birim_fiyat) === 0 ? 'bg-amber-50/40' : undefined}>
      <td className="font-medium">
        {malzeme.ad}
        {Number(malzeme.birim_fiyat) === 0 && (
          <span className="rozet ml-2 bg-amber-100 text-amber-800">fiyatı yok</span>
        )}
      </td>
      <td className="text-right">
        <span className="inline-flex items-center gap-1">
          <input
            value={deger}
            onChange={(e) => setDeger(e.target.value)}
            onBlur={gonder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            inputMode="decimal"
            disabled={calisiyor}
            className="w-24 rounded border border-cizgi px-2 py-1 text-right text-sm tabular-nums
                       outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
          />
          <span className="w-8 text-left text-xs text-solgun">
            {birimEtiketi(malzeme.birim)}
          </span>
        </span>
      </td>
      <td className="text-right tabular-nums text-solgun">
        {para(malzeme.birim_fiyat)}/{malzeme.birim}
      </td>
      <td className="text-right tabular-nums">{para(tutar)}</td>
      <td className="text-right">
        <button
          type="button"
          onClick={() => kaydet(malzeme.id, 0, malzeme.birim)}
          className="text-xs text-red-600 hover:underline"
        >
          Çıkar
        </button>
      </td>
    </tr>
  )
}

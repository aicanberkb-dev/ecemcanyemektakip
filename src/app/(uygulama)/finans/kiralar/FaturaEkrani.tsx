'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, para } from '@/lib/format'

import { abonelikKaydet, faturaKaydet, faturaOdendi } from './fatura-actions'
import { GIDER_ADLARI, GIDER_TURLERI, type GiderTuru } from './gider-turleri'

export type Abonelik = {
  yer: string
  gider_turu: GiderTuru
  sozlesme_no: string | null
  vade_gunu: number | null
}

export type FaturaSatiri = {
  yer: string
  gider_turu: GiderTuru
  donem: string
  tutar: number | string
  odeme_tarihi: string | null
  odendi: boolean
}

/**
 * Faturası tutulan yerler.
 *
 * AHMET MİTHAT burada yok: orada elektrik, su ve ısınma ayrı ayrı
 * ödenmiyor, okula aylık sabit 1.000 TL yatırılıyor. O gider kirasının
 * içinde, Kiralar sekmesindeki "Elektrik, Su ve Isınma Giderleri" kaleminde
 * duruyor.
 */
export const YERLER: { ad: string; turler: readonly GiderTuru[] }[] = [
  // Doğalgaz yalnızca yemekhanede; öbür yerlerde abonelik yok.
  // GÖKSU'da kantin ve yemekhane ayrı abone, kiralarda da ayrı birim.
  { ad: 'GÖKSU KANTİN', turler: ['elektrik', 'su'] },
  { ad: 'GÖKSU YEMEKHANE', turler: ['elektrik', 'su'] },
  { ad: 'AKBABA', turler: ['elektrik', 'su'] },
  { ad: 'YEMEKHANE', turler: GIDER_TURLERI },
  { ad: 'TORİK', turler: ['elektrik', 'su'] },
]

/** Yerin o gider türünde aboneliği var mı */
function turVar(yer: { turler: readonly GiderTuru[] }, tur: GiderTuru) {
  return yer.turler.includes(tur)
}

/**
 * Takip edilen dönem: Ekim 2026 – Haziran 2027.
 *
 * Öğretim yılı boyunca. Yıl değişince buradan uzatılır; dönemler veriden
 * değil listeden geliyor ki girilmemiş aylar da sekmede görünsün.
 */
export const DONEMLER = (() => {
  const liste: string[] = []
  for (let i = 0; i < 9; i++) {
    const ay = 10 + i
    const yil = ay <= 12 ? 2026 : 2027
    const a = ay <= 12 ? ay : ay - 12
    liste.push(`${yil}-${String(a).padStart(2, '0')}-01`)
  }
  return liste
})()

export function donemAdi(donem: string): string {
  const [yil, ay] = donem.split('-')
  return `${AY_ADLARI[Number(ay) - 1]} ${yil}`
}

function donemKisa(donem: string): string {
  const [yil, ay] = donem.split('-')
  return `${AY_ADLARI[Number(ay) - 1].slice(0, 3)} ${yil.slice(2)}`
}

const anahtar = (yer: string, tur: GiderTuru, donem: string) => `${yer}|${tur}|${donem}`

/** Bugünün dönemi listede varsa o, yoksa ilk dönem açılır */
function acilisDonemi(bugun: string): string {
  const simdiki = `${bugun.slice(0, 7)}-01`
  return DONEMLER.includes(simdiki) ? simdiki : DONEMLER[0]
}

/**
 * Faturalar: ay üstte, yerler ve gider türleri tek tabloda.
 *
 * Bir ayda kime ne ödeneceği tek bakışta görünsün diye düzen ay bazlı;
 * gider türü başına ayrı ekran gezmek gerekmiyor.
 */
export function FaturaEkrani({
  abonelikler,
  faturalar,
  bugun,
}: {
  abonelikler: Abonelik[]
  faturalar: FaturaSatiri[]
  bugun: string
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [donem, setDonem] = useState(() => acilisDonemi(bugun))
  const [abonelikAcik, setAbonelikAcik] = useState(false)
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)

  const abonelik = useMemo(() => {
    const m = new Map<string, Abonelik>()
    for (const a of abonelikler) m.set(`${a.yer}|${a.gider_turu}`, a)
    return m
  }, [abonelikler])

  const mevcut = useMemo(() => {
    const m = new Map<string, FaturaSatiri>()
    for (const f of faturalar) m.set(anahtar(f.yer, f.gider_turu, f.donem), f)
    return m
  }, [faturalar])

  function calistir(is: () => Promise<{ hata?: string; basari?: string }>) {
    baslat(async () => {
      const sonuc = await is()
      setMesaj(
        sonuc.hata
          ? { tip: 'hata', metin: sonuc.hata }
          : sonuc.basari
            ? { tip: 'ok', metin: sonuc.basari }
            : null,
      )
      router.refresh()
    })
  }

  const hucre = (yer: string, tur: GiderTuru) => mevcut.get(anahtar(yer, tur, donem))
  const yerToplami = (yer: (typeof YERLER)[number]) =>
    yer.turler.reduce((t, g) => t + Number(hucre(yer.ad, g)?.tutar ?? 0), 0)
  const turToplami = (tur: GiderTuru) =>
    YERLER.reduce((t, y) => t + (turVar(y, tur) ? Number(hucre(y.ad, tur)?.tutar ?? 0) : 0), 0)
  const ayToplami = YERLER.reduce((t, y) => t + yerToplami(y), 0)
  const ayOdenen = YERLER.reduce(
    (t, y) =>
      t +
      y.turler.reduce(
        (s, g) => s + (hucre(y.ad, g)?.odendi ? Number(hucre(y.ad, g)!.tutar) : 0),
        0,
      ),
    0,
  )

  /** Dönemde kaç fatura girilmiş, kaçı ödenmiş — sekme rozetinde */
  function donemDurumu(d: string) {
    let girilen = 0
    let odenen = 0
    for (const y of YERLER)
      for (const g of y.turler) {
        const k = mevcut.get(anahtar(y.ad, g, d))
        if (k && Number(k.tutar) > 0) girilen++
        if (k?.odendi) odenen++
      }
    return { girilen, odenen }
  }

  return (
    <div className="space-y-4">
      {/* Ay üst barda: hangi ayın faturalarına bakıldığı tek yerden seçilir */}
      <nav className="flex flex-wrap gap-1.5" aria-label="Dönem">
        {DONEMLER.map((d) => {
          const { girilen, odenen } = donemDurumu(d)
          const secili = d === donem
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDonem(d)}
              aria-current={secili ? 'page' : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs leading-tight font-semibold ${
                secili
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-cizgi bg-white hover:bg-slate-50'
              }`}
            >
              <span className="block">{donemKisa(d)}</span>
              <span
                className={`block text-[10px] font-normal ${
                  secili ? 'text-gray-300' : 'text-solgun'
                }`}
              >
                {girilen === 0 ? 'boş' : `${odenen}/${girilen} ödendi`}
              </span>
            </button>
          )
        })}
      </nav>

      {mesaj && (
        <p
          className={`rounded-md px-4 py-3 text-sm ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      <div className="kart overflow-x-auto">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-cizgi bg-slate-50 px-4 py-2.5">
          <h2 className="font-semibold">{donemAdi(donem)}</h2>
          <span className="ml-auto flex flex-wrap items-baseline gap-x-3 text-xs">
            <span className="text-solgun">toplam</span>
            <span className="font-semibold tabular-nums">{para(ayToplami)}</span>
            <span className="text-solgun">ödenen</span>
            <span className="font-semibold text-emerald-700 tabular-nums">{para(ayOdenen)}</span>
            <span className="text-solgun">kalan</span>
            <span className="font-semibold text-red-700 tabular-nums">
              {para(ayToplami - ayOdenen)}
            </span>
          </span>
        </div>

        <table className="tablo">
          <thead>
            <tr>
              <th className="w-32">Yer</th>
              {GIDER_TURLERI.map((g) => (
                <th key={g}>{GIDER_ADLARI[g]}</th>
              ))}
              <th className="text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {YERLER.map((yer) => (
              <tr key={yer.ad}>
                <td className="font-semibold">{yer.ad}</td>
                {GIDER_TURLERI.map((tur) => (
                  <td key={tur}>
                    {turVar(yer, tur) ? (
                      <Hucre
                        yer={yer.ad}
                        tur={tur}
                        donem={donem}
                        kayit={hucre(yer.ad, tur)}
                        bekliyor={bekliyor}
                        bugun={bugun}
                        calistir={calistir}
                      />
                    ) : (
                      /* Aboneliği olmayan tür: boş kutu çıkmasın, yanlışlıkla
                         tutar girilmesin */
                      <span className="text-xs text-solgun">—</span>
                    )}
                  </td>
                ))}
                <td className="text-right font-semibold tabular-nums">{para(yerToplami(yer))}</td>
              </tr>
            ))}
            <tr className="bg-slate-50">
              <td className="font-semibold">Toplam</td>
              {GIDER_TURLERI.map((g) => (
                <td key={g} className="font-semibold tabular-nums">
                  {para(turToplami(g))}
                </td>
              ))}
              <td className="text-right font-bold tabular-nums">{para(ayToplami)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Abonelik bilgisi aya bağlı değil: bir kez girilir, kapalı durur */}
      <div className="kart overflow-hidden">
        <button
          type="button"
          onClick={() => setAbonelikAcik(!abonelikAcik)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"
        >
          <span>{abonelikAcik ? '▾' : '▸'}</span>
          <span>Sözleşme Numaraları ve Vade Günleri</span>
          <span className="ml-auto text-xs font-normal text-solgun">bir kez girilir</span>
        </button>

        {abonelikAcik && (
          <div className="overflow-x-auto border-t border-cizgi">
            <table className="tablo">
              <thead>
                <tr>
                  <th className="w-32">Yer</th>
                  {GIDER_TURLERI.map((g) => (
                    <th key={g}>{GIDER_ADLARI[g]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YERLER.map((yer) => (
                  <tr key={yer.ad}>
                    <td className="font-semibold">{yer.ad}</td>
                    {GIDER_TURLERI.map((tur) => {
                      const a = abonelik.get(`${yer.ad}|${tur}`) ?? null
                      if (!turVar(yer, tur))
                        return (
                          <td key={tur}>
                            <span className="text-xs text-solgun">—</span>
                          </td>
                        )
                      return (
                        <td key={tur}>
                          <div className="flex flex-wrap gap-1.5">
                            <input
                              defaultValue={a?.sozlesme_no ?? ''}
                              placeholder="Sözleşme no"
                              onBlur={(e) => {
                                if (e.target.value.trim() !== (a?.sozlesme_no ?? ''))
                                  calistir(() =>
                                    abonelikKaydet(yer.ad, tur, 'sozlesme_no', e.target.value),
                                  )
                              }}
                              className="girdi w-36 !py-1 text-xs"
                            />
                            <input
                              inputMode="numeric"
                              defaultValue={a?.vade_gunu ?? ''}
                              placeholder="Vade"
                              title="Ayın kaçında ödeniyor"
                              onBlur={(e) => {
                                if (e.target.value.trim() !== String(a?.vade_gunu ?? ''))
                                  calistir(() =>
                                    abonelikKaydet(yer.ad, tur, 'vade_gunu', e.target.value),
                                  )
                              }}
                              className="girdi w-14 !py-1 text-center text-xs"
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-solgun">
        Ödendi işaretlenen fatura aynı tutarla günlük masraflara da yazılır; işareti
        kaldırırsanız o masraf satırı silinir. Vade günü Ödeme Takvimi&apos;nde kullanılır.
      </p>
    </div>
  )
}

/** Bir yerin bir gider türündeki o ayki faturası */
function Hucre({
  yer,
  tur,
  donem,
  kayit,
  bekliyor,
  bugun,
  calistir,
}: {
  yer: string
  tur: GiderTuru
  donem: string
  kayit: FaturaSatiri | undefined
  bekliyor: boolean
  bugun: string
  calistir: (is: () => Promise<{ hata?: string; basari?: string }>) => void
}) {
  const metin =
    kayit && Number(kayit.tutar) > 0 ? String(Number(kayit.tutar)).replace('.', ',') : ''

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded px-1 py-0.5 ${
        kayit?.odendi ? 'bg-emerald-100' : ''
      }`}
    >
      <input
        inputMode="decimal"
        defaultValue={metin}
        placeholder="Tutar"
        onBlur={(e) => {
          if (e.target.value.trim() !== metin)
            calistir(() => faturaKaydet(yer, tur, donem, 'tutar', e.target.value))
        }}
        className="girdi w-24 !py-1 text-right text-xs tabular-nums"
      />

      <button
        type="button"
        disabled={bekliyor}
        onClick={() => calistir(() => faturaOdendi(yer, tur, donem, !kayit?.odendi, bugun))}
        className={`rounded px-2 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50 ${
          kayit?.odendi
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'border border-cizgi bg-white text-solgun hover:bg-slate-50'
        }`}
      >
        {kayit?.odendi ? '✓' : 'Ödendi'}
      </button>

      {/* Ödeme tarihi yalnız ödendikten sonra: ödenmemiş hücre kalabalık olmasın */}
      {kayit?.odendi && (
        <input
          type="date"
          defaultValue={kayit.odeme_tarihi ?? bugun}
          onBlur={(e) => {
            if (e.target.value !== (kayit.odeme_tarihi ?? ''))
              calistir(() => faturaKaydet(yer, tur, donem, 'odeme_tarihi', e.target.value))
          }}
          className="girdi w-28 !py-0.5 text-[11px]"
        />
      )}
    </div>
  )
}

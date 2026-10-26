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
export const YERLER = ['GÖKSU', 'AKBABA', 'YEMEKHANE']

/**
 * Takip edilen dönem: Ekim 2026 – Haziran 2027.
 *
 * Öğretim yılı boyunca. Yıl değişince buradan uzatılır; dönemler veriden
 * değil listeden geliyor ki girilmemiş aylar da satır olarak görünsün.
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

const anahtar = (yer: string, tur: GiderTuru, donem: string) => `${yer}|${tur}|${donem}`

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
  const [tur, setTur] = useState<GiderTuru>('elektrik')
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

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Gider türü">
        {GIDER_TURLERI.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTur(t)}
            aria-current={t === tur ? 'page' : undefined}
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${
              t === tur
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-cizgi bg-white hover:bg-slate-50'
            }`}
          >
            {GIDER_ADLARI[t]}
          </button>
        ))}
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

      <div className="grid gap-4 xl:grid-cols-3">
        {YERLER.map((yer) => (
          <YerKutusu
            key={yer}
            yer={yer}
            tur={tur}
            abonelik={abonelik.get(`${yer}|${tur}`) ?? null}
            mevcut={mevcut}
            bekliyor={bekliyor}
            bugun={bugun}
            calistir={calistir}
          />
        ))}
      </div>

      <p className="text-xs text-solgun">
        Ödendi işaretlenen fatura aynı tutarla günlük masraflara da yazılır; işareti
        kaldırırsanız o masraf satırı silinir. Sözleşme numarası ve vade günü bir kez
        girilir, her ay tekrar sorulmaz.
      </p>
    </div>
  )
}

/** Bir yerin bir gider türündeki bütün dönemleri */
function YerKutusu({
  yer,
  tur,
  abonelik,
  mevcut,
  bekliyor,
  bugun,
  calistir,
}: {
  yer: string
  tur: GiderTuru
  abonelik: Abonelik | null
  mevcut: Map<string, FaturaSatiri>
  bekliyor: boolean
  bugun: string
  calistir: (is: () => Promise<{ hata?: string; basari?: string }>) => void
}) {
  const kayitlar = DONEMLER.map((d) => mevcut.get(anahtar(yer, tur, d)))
  const toplam = kayitlar.reduce((t, k) => t + Number(k?.tutar ?? 0), 0)
  const odenen = kayitlar.reduce((t, k) => t + (k?.odendi ? Number(k.tutar) : 0), 0)
  const odenenSayi = kayitlar.filter((k) => k?.odendi).length

  return (
    <section className="kart overflow-hidden">
      <h2 className="flex flex-wrap items-baseline gap-2 border-b border-cizgi bg-slate-50 px-4 py-2.5 font-semibold">
        <span>{yer}</span>
        <span className="ml-auto flex flex-wrap items-baseline gap-x-2 text-xs font-normal">
          <span className="text-solgun">
            {odenenSayi}/{DONEMLER.length} ödendi
          </span>
          <span className="tabular-nums">{para(toplam)}</span>
          <span className="text-emerald-700 tabular-nums">{para(odenen)}</span>
          <span className="text-red-700 tabular-nums">{para(toplam - odenen)}</span>
        </span>
      </h2>

      {/* Abonelik bilgisi: bir kez girilir */}
      <div className="flex flex-wrap gap-3 border-b border-cizgi bg-white px-4 py-2.5">
        <label className="text-[11px] text-solgun">
          <span className="block font-semibold">Sözleşme no</span>
          <input
            defaultValue={abonelik?.sozlesme_no ?? ''}
            placeholder="Abone / sözleşme no"
            onBlur={(e) => {
              if (e.target.value.trim() !== (abonelik?.sozlesme_no ?? ''))
                calistir(() => abonelikKaydet(yer, tur, 'sozlesme_no', e.target.value))
            }}
            className="girdi mt-0.5 w-44 !py-1 text-xs"
          />
        </label>
        <label className="text-[11px] text-solgun">
          <span className="block font-semibold">Vade günü</span>
          <input
            inputMode="numeric"
            defaultValue={abonelik?.vade_gunu ?? ''}
            placeholder="ör. 15"
            onBlur={(e) => {
              if (e.target.value.trim() !== String(abonelik?.vade_gunu ?? ''))
                calistir(() => abonelikKaydet(yer, tur, 'vade_gunu', e.target.value))
            }}
            className="girdi mt-0.5 w-20 !py-1 text-xs"
          />
        </label>
      </div>

      <div className="space-y-1 p-2">
        {DONEMLER.map((donem) => {
          const k = mevcut.get(anahtar(yer, tur, donem))
          return (
            <div
              key={donem}
              className={`flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1 ${
                k?.odendi ? 'bg-emerald-100' : ''
              }`}
            >
              <span className="w-24 shrink-0 text-xs leading-tight font-medium">
                {donemAdi(donem)}
              </span>

              <input
                inputMode="decimal"
                defaultValue={
                  k && Number(k.tutar) > 0 ? String(Number(k.tutar)).replace('.', ',') : ''
                }
                placeholder="Tutar"
                onBlur={(e) => {
                  const eski =
                    k && Number(k.tutar) > 0 ? String(Number(k.tutar)).replace('.', ',') : ''
                  if (e.target.value.trim() !== eski)
                    calistir(() => faturaKaydet(yer, tur, donem, 'tutar', e.target.value))
                }}
                className="girdi w-24 !py-1 text-right text-xs tabular-nums"
              />

              <input
                type="date"
                defaultValue={k?.odeme_tarihi ?? (k?.odendi ? '' : bugun)}
                onBlur={(e) => {
                  if (e.target.value !== (k?.odeme_tarihi ?? ''))
                    calistir(() => faturaKaydet(yer, tur, donem, 'odeme_tarihi', e.target.value))
                }}
                className="girdi w-32 !py-1 text-xs"
              />

              <button
                type="button"
                disabled={bekliyor}
                onClick={() => calistir(() => faturaOdendi(yer, tur, donem, !k?.odendi, bugun))}
                className={`ml-auto rounded px-2 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50 ${
                  k?.odendi
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-cizgi bg-white text-solgun hover:bg-slate-50'
                }`}
              >
                {k?.odendi ? '✓ Ödendi' : 'Ödendi'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

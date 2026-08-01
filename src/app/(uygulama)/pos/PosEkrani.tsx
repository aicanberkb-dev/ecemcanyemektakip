'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { para } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { GunSonu, PosSonuc, SerbestOgunTipi } from '@/lib/types'

type Mesaj = { tip: 'ok' | 'hata'; metin: string }

export function PosEkrani() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const aramaRef = useRef<HTMLInputElement>(null)

  const [terim, setTerim] = useState('')
  const [sonuclar, setSonuclar] = useState<PosSonuc[]>([])
  const [vurgulu, setVurgulu] = useState(0)
  const [secili, setSecili] = useState<PosSonuc | null>(null)
  const [mesaj, setMesaj] = useState<Mesaj | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [ozet, setOzet] = useState<GunSonu | null>(null)

  const odakla = useCallback(() => {
    aramaRef.current?.focus()
    aramaRef.current?.select()
  }, [])

  const ozetYenile = useCallback(async () => {
    const { data } = await supabase.rpc('gun_sonu')
    if (data?.[0]) setOzet(data[0] as GunSonu)
  }, [supabase])

  // İlk açılışta bugünün sayacını çek ve odağı arama kutusuna ver
  useEffect(() => {
    let iptal = false
    supabase.rpc('gun_sonu').then(({ data }) => {
      if (!iptal && data?.[0]) setOzet(data[0] as GunSonu)
    })
    aramaRef.current?.focus()
    return () => {
      iptal = true
    }
  }, [supabase])

  // --- Canlı arama (harfe göre) -------------------------------------------
  useEffect(() => {
    const t = terim.trim()
    if (secili || t === '') return

    let iptal = false
    const zamanlayici = setTimeout(async () => {
      const { data, error } = await supabase.rpc('pos_ara', { p_terim: t })
      if (iptal) return
      if (error) {
        setMesaj({ tip: 'hata', metin: error.message })
        return
      }
      const liste = (data ?? []) as PosSonuc[]

      // Kart okutuldu: numara/kimlik tam eşleşti ve tek sonuç var → otomatik seç
      if (liste.length === 1 && liste[0].tam_eslesme) {
        setSecili(liste[0])
        setSonuclar([])
        setVurgulu(0)
        return
      }

      setSonuclar(liste)
      setVurgulu(0)
    }, 140)

    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [terim, secili, supabase])

  // Öğrenci seçiliyse ya da kutu boşsa liste kapalı — türetilmiş, effect gerekmez
  const gosterilen = secili || terim.trim() === '' ? [] : sonuclar

  function sec(ogrenci: PosSonuc) {
    setSecili(ogrenci)
    setSonuclar([])
    setTerim('')
  }

  function vazgec() {
    setSecili(null)
    setTerim('')
    setSonuclar([])
    setVurgulu(0)
    setMesaj(null)
    odakla()
  }

  function tusla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      vazgec()
      return
    }
    if (gosterilen.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setVurgulu((i) => (i + 1) % gosterilen.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setVurgulu((i) => (i - 1 + gosterilen.length) % gosterilen.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      sec(gosterilen[vurgulu])
    }
  }

  // --- Kayıt ---------------------------------------------------------------
  async function yemekKaydet() {
    if (!secili || kaydediliyor) return
    setKaydediliyor(true)
    const ad = secili.ad_soyad

    const { error } = await supabase.rpc('yemek_kaydet', { p_student_id: secili.student_id })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    setMesaj({
      tip: 'ok',
      metin:
        secili.abone_tipi === 'aylik'
          ? `${ad} — devam kaydı alındı.`
          : `${ad} — ${para(secili.gunluk_ucret)} düşüldü.`,
    })
    vazgec()
    ozetYenile()
  }

  async function serbestKaydet(tip: SerbestOgunTipi) {
    if (kaydediliyor) return
    setKaydediliyor(true)

    const { data, error } = await supabase.rpc('serbest_ogun_kaydet', { p_tip: tip })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    const tutar = Number((data as { tutar?: number } | null)?.tutar ?? 0)
    setMesaj({
      tip: 'ok',
      metin:
        tip === 'ucretli'
          ? `Ücretli öğün kaydedildi — ${para(tutar)}`
          : `Misafir öğün kaydedildi${tutar > 0 ? ` — ${para(tutar)}` : ''}.`,
    })
    vazgec()
    ozetYenile()
  }

  const yemekKilitli = !secili || secili.bugun_yedi || kaydediliyor

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {/* Arama */}
        <div className="kart relative p-4">
          <label className="etiket" htmlFor="arama">
            Öğrenci no, kimlik no veya isim
          </label>
          <input
            id="arama"
            ref={aramaRef}
            value={secili ? '' : terim}
            onChange={(e) => setTerim(e.target.value)}
            onKeyDown={tusla}
            disabled={!!secili}
            autoComplete="off"
            placeholder="Yazın ya da kart okutun…"
            className="girdi !py-3 !text-lg"
          />

          {gosterilen.length > 0 && (
            <ul className="absolute inset-x-4 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border border-cizgi bg-white shadow-lg">
              {gosterilen.map((o, i) => (
                <li key={o.student_id}>
                  <button
                    type="button"
                    onMouseEnter={() => setVurgulu(i)}
                    onClick={() => sec(o)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                      i === vurgulu ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex-1">
                      <span className="font-medium">{o.ad_soyad}</span>
                      <span className="ml-2 text-xs text-solgun">
                        {o.ogrenci_no}
                        {o.sinif ? ` · ${o.sinif}` : ''}
                      </span>
                    </span>
                    {o.bugun_yedi && (
                      <span className="rozet bg-slate-100 text-slate-600">bugün yedi</span>
                    )}
                    <span
                      className={`font-semibold tabular-nums ${
                        o.kalan < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {para(o.kalan)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seçili öğrenci */}
        <div className="kart flex min-h-44 flex-col items-center justify-center p-6 text-center">
          {secili ? (
            <>
              <p className="text-3xl font-bold">{secili.ad_soyad}</p>
              <p className="mt-1 text-sm text-solgun">
                {secili.ogrenci_no}
                {secili.sinif ? ` · ${secili.sinif}` : ''} ·{' '}
                {secili.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'}
              </p>
              <p
                className={`mt-4 text-6xl font-bold tabular-nums ${
                  secili.kalan < 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {para(secili.kalan)}
              </p>
              {secili.bugun_yedi ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                  Bugün zaten yemek kaydı var.
                </p>
              ) : (
                <p className="mt-3 text-sm text-solgun">
                  {secili.abone_tipi === 'aylik'
                    ? 'Aylıkçı — devam kaydı düşer, ücret alınmaz.'
                    : `Düşülecek: ${para(secili.gunluk_ucret)}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg text-slate-400">Öğrenci seçilmedi</p>
          )}
        </div>

        {/* Butonlar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <OgunButonu
            renk="bg-blue-600 hover:bg-blue-700"
            etkin={!yemekKilitli}
            vurgulu={secili?.abone_tipi === 'gunluk'}
            onClick={yemekKaydet}
          >
            Günlükçü
          </OgunButonu>
          <OgunButonu
            renk="bg-amber-500 hover:bg-amber-600"
            etkin={!yemekKilitli}
            vurgulu={secili?.abone_tipi === 'aylik'}
            onClick={yemekKaydet}
          >
            Aylıkçı
          </OgunButonu>
          <OgunButonu
            renk="bg-emerald-600 hover:bg-emerald-700"
            etkin={!kaydediliyor}
            onClick={() => serbestKaydet('ucretli')}
          >
            Ücretli
          </OgunButonu>
          <OgunButonu
            renk="bg-purple-600 hover:bg-purple-700"
            etkin={!kaydediliyor}
            onClick={() => serbestKaydet('misafir')}
          >
            Misafir
          </OgunButonu>
          <OgunButonu renk="bg-slate-500 hover:bg-slate-600" etkin onClick={vazgec}>
            Vazgeç
          </OgunButonu>
        </div>

        {mesaj && (
          <p
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              mesaj.tip === 'ok'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {mesaj.metin}
          </p>
        )}
      </div>

      {/* Bugünün sayacı */}
      <aside className="kart h-fit p-4">
        <h2 className="mb-3 text-sm font-semibold text-solgun uppercase">Bugün</h2>
        <dl className="space-y-2 text-sm">
          <Satir ad="Günlükçü" deger={ozet?.gunlukcu ?? 0} />
          <Satir ad="Aylıkçı" deger={ozet?.aylikci ?? 0} />
          <Satir ad="Ücretli" deger={ozet?.ucretli ?? 0} />
          <Satir ad="Misafir" deger={ozet?.misafir ?? 0} />
          <div className="border-t border-cizgi pt-2">
            <Satir ad="Toplam" deger={ozet?.toplam ?? 0} kalin />
          </div>
          <div className="border-t border-cizgi pt-2 text-xs text-solgun">
            Kasaya giren (ücretli): {para(ozet?.ucretli_tutar ?? 0)}
          </div>
        </dl>
      </aside>
    </div>
  )
}

function OgunButonu({
  children,
  renk,
  etkin,
  vurgulu,
  onClick,
}: {
  children: React.ReactNode
  renk: string
  etkin: boolean
  vurgulu?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!etkin}
      onClick={onClick}
      className={`rounded-lg px-3 py-6 text-base font-semibold text-white transition
        disabled:cursor-not-allowed disabled:bg-slate-300 ${renk}
        ${vurgulu && etkin ? 'ring-4 ring-offset-2 ring-blue-200' : ''}`}
    >
      {children}
    </button>
  )
}

function Satir({ ad, deger, kalin }: { ad: string; deger: number; kalin?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={kalin ? 'font-semibold' : 'text-solgun'}>{ad}</dt>
      <dd className={`tabular-nums ${kalin ? 'text-xl font-bold' : 'font-medium'}`}>
        {deger}
      </dd>
    </div>
  )
}

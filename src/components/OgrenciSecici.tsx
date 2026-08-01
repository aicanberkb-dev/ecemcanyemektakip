'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { para } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { PosSonuc } from '@/lib/types'

export type SeciliOgrenci = {
  student_id: string
  ad_soyad: string
  ogrenci_no: string
  sinif: string | null
  kalan: number
  gunluk_ucret: number
  abone_tipi: 'gunluk' | 'aylik'
}

type Props = {
  ad?: string
  baslangic?: SeciliOgrenci | null
  onSecim?: (ogrenci: SeciliOgrenci | null) => void
}

/** Öğrenci no / kimlik / isim ile canlı arayan autocomplete. */
export function OgrenciSecici({ ad = 'student_id', baslangic, onSecim }: Props) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [terim, setTerim] = useState('')
  const [sonuclar, setSonuclar] = useState<PosSonuc[]>([])
  const [vurgulu, setVurgulu] = useState(0)
  const [secili, setSecili] = useState<SeciliOgrenci | null>(baslangic ?? null)
  const sarmalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = terim.trim()
    if (secili || t === '') return

    let iptal = false
    const zamanlayici = setTimeout(async () => {
      const { data } = await supabase.rpc('pos_ara', { p_terim: t })
      if (!iptal) {
        setSonuclar((data ?? []) as PosSonuc[])
        setVurgulu(0)
      }
    }, 160)
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [terim, secili, supabase])

  // Kutu boşsa liste kapalı — türetilmiş, effect gerekmez
  const gosterilen = terim.trim() === '' ? [] : sonuclar

  function sec(o: PosSonuc) {
    const yeni: SeciliOgrenci = {
      student_id: o.student_id,
      ad_soyad: o.ad_soyad,
      ogrenci_no: o.ogrenci_no,
      sinif: o.sinif,
      kalan: Number(o.kalan),
      gunluk_ucret: Number(o.gunluk_ucret),
      abone_tipi: o.abone_tipi,
    }
    setSecili(yeni)
    setSonuclar([])
    setTerim('')
    onSecim?.(yeni)
  }

  function temizle() {
    setSecili(null)
    setTerim('')
    setSonuclar([])
    onSecim?.(null)
  }

  if (secili) {
    return (
      <div>
        <input type="hidden" name={ad} value={secili.student_id} />
        <div className="flex items-center gap-3 rounded-md border border-cizgi bg-slate-50 px-3 py-2">
          <div className="flex-1">
            <p className="font-medium">{secili.ad_soyad}</p>
            <p className="text-xs text-solgun">
              {secili.ogrenci_no}
              {secili.sinif ? ` · ${secili.sinif}` : ''} ·{' '}
              {secili.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'}
            </p>
          </div>
          <span
            className={`font-semibold tabular-nums ${
              secili.kalan < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {para(secili.kalan)}
          </span>
          <button
            type="button"
            onClick={temizle}
            className="text-xs text-vurgu hover:underline"
          >
            Değiştir
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={sarmalRef} className="relative">
      <input
        value={terim}
        onChange={(e) => setTerim(e.target.value)}
        onKeyDown={(e) => {
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
        }}
        autoComplete="off"
        placeholder="Öğrenci no, kimlik no veya isim…"
        className="girdi"
      />
      {gosterilen.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-cizgi bg-white shadow-lg">
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
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    Number(o.kalan) < 0 ? 'text-red-600' : 'text-emerald-700'
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
  )
}

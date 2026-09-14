'use client'

import { useId, useMemo, useState } from 'react'

import { aramaEslesir } from '@/lib/arama'

export type AramaOgrencisi = {
  id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
}

/** Listenin başında gösterilecek öğrenci ve neden önerildiği */
export type AramaOnerisi = { id: string; not: string }

const SONUC_SINIRI = 40

const etiket = (o: AramaOgrencisi) =>
  `${o.ogrenci_no} · ${o.ad_soyad}${o.sinif ? ` (${o.sinif})` : ''}`

const aranacak = (o: AramaOgrencisi) => `${o.ogrenci_no} ${o.ad_soyad} ${o.sinif ?? ''}`

/**
 * Aranabilir öğrenci seçici.
 *
 * Önce uzun bir açılır listeydi; 60+ öğrenci arasında kaydırarak aramak
 * yavaştı. Yazdıkça ada, numaraya ve sınıfa göre süzülür ("ömer", "omer",
 * "4-b" hepsi çalışır). Önerilenler (veli / öğrenci adı tutanlar, kardeşler)
 * her zaman en üstte. Klavye: ↑ ↓ gez, Enter seç, Esc kapat.
 */
export function OgrenciArama({
  secili,
  ogrenciler,
  oneriler,
  onSec,
}: {
  secili: string
  ogrenciler: AramaOgrencisi[]
  oneriler: AramaOnerisi[]
  onSec: (id: string) => void
}) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [etkin, setEtkin] = useState(0)
  const listeId = useId()

  const harita = useMemo(() => new Map(ogrenciler.map((o) => [o.id, o])), [ogrenciler])
  const seciliOgrenci = secili ? harita.get(secili) : undefined

  const { sonuclar, oneriSayisi } = useMemo(() => {
    const oneriIdleri = new Set(oneriler.map((x) => x.id))
    const onerilen = oneriler
      .map((x) => ({ o: harita.get(x.id), not: x.not }))
      .filter((x): x is { o: AramaOgrencisi; not: string } => !!x.o)
      .filter((x) => aramaEslesir(aranacak(x.o), arama))
    const digerleri = ogrenciler
      .filter((o) => !oneriIdleri.has(o.id) && aramaEslesir(aranacak(o), arama))
      .slice(0, SONUC_SINIRI)
      .map((o) => ({ o, not: '' }))
    return { sonuclar: [...onerilen, ...digerleri], oneriSayisi: onerilen.length }
  }, [arama, harita, ogrenciler, oneriler])

  function sec(id: string) {
    onSec(id)
    setAcik(false)
    setArama('')
  }

  function gez(yeni: number) {
    if (sonuclar.length === 0) return
    const i = (yeni + sonuclar.length) % sonuclar.length
    setEtkin(i)
    requestAnimationFrame(() =>
      document.getElementById(`${listeId}-${i}`)?.scrollIntoView({ block: 'nearest' }),
    )
  }

  return (
    <div className="relative min-w-64 grow">
      <div className="flex items-center gap-1">
        <input
          role="combobox"
          aria-expanded={acik}
          aria-controls={listeId}
          aria-autocomplete="list"
          value={acik ? arama : seciliOgrenci ? etiket(seciliOgrenci) : ''}
          placeholder="Öğrenci ara: ad, numara ya da sınıf"
          onFocus={() => {
            setAcik(true)
            setArama('')
            setEtkin(0)
          }}
          // Seçimden sonra kutu odakta kalıyor; odak olayı tekrar gelmediği için
          // tıklayınca ya da yazmaya başlayınca liste yeniden açılır.
          onClick={() => {
            if (acik) return
            setAcik(true)
            setArama('')
            setEtkin(0)
          }}
          onBlur={() => setAcik(false)}
          onChange={(e) => {
            // Liste kapalıyken kutuda seçili öğrencinin etiketi durur; yazılan
            // karakter o etiketin sonuna eklenmiş gelir, yalnız yeni harfi al.
            const deger = acik ? e.target.value : e.target.value.slice(-1)
            setAcik(true)
            setArama(deger)
            setEtkin(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!acik) setAcik(true)
              gez(etkin + 1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              gez(etkin - 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const s = sonuclar[etkin]
              if (acik && s) sec(s.o.id)
            } else if (e.key === 'Escape') {
              setAcik(false)
              setArama('')
            }
          }}
          className={`girdi !py-1 ${seciliOgrenci ? 'font-medium' : ''}`}
        />
        {seciliOgrenci && !acik && (
          <button
            type="button"
            onClick={() => onSec('')}
            className="rounded px-1.5 text-xs text-solgun hover:bg-slate-100"
            aria-label="Seçimi temizle"
            title="Seçimi temizle"
          >
            ✕
          </button>
        )}
      </div>

      {acik && (
        <ul
          id={listeId}
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 max-h-72 w-full min-w-72 overflow-y-auto rounded-md border border-cizgi bg-white py-1 shadow-lg"
        >
          {sonuclar.length === 0 && (
            <li className="px-3 py-2 text-sm text-solgun">Eşleşen öğrenci yok</li>
          )}
          {sonuclar.map((s, i) => (
            <li
              key={s.o.id}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={s.o.id === secili}
              // mousedown: input'un blur'u listeyi kapatmadan seçim yapılsın
              onMouseDown={(e) => {
                e.preventDefault()
                sec(s.o.id)
              }}
              onMouseEnter={() => setEtkin(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === etkin ? 'bg-blue-50' : ''
              } ${i === oneriSayisi && oneriSayisi > 0 ? 'border-t border-cizgi' : ''}`}
            >
              <span className={s.o.id === secili ? 'font-semibold' : ''}>{etiket(s.o)}</span>
              {s.not && <span className="ml-2 text-xs text-violet-700">{s.not}</span>}
            </li>
          ))}
          {!arama && ogrenciler.length > SONUC_SINIRI + oneriSayisi && (
            <li className="px-3 py-1.5 text-xs text-solgun">
              Tümünü görmek için ad ya da numara yazın
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

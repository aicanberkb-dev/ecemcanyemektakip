'use client'

import { useState } from 'react'

export const SINIFLAR = ['1', '2', '3', '4', '5', '6', '7', '8']
export const SUBELER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** "1-A" → { sinif: '1', sube: 'A' }; tanınmayan biçim boş döner. */
export function sinifCozumle(deger: string | null | undefined): {
  sinif: string
  sube: string
} {
  const m = /^\s*(\d)\s*[-/]\s*([A-Za-zÇĞİÖŞÜçğıöşü])\s*$/.exec(deger ?? '')
  if (!m) return { sinif: '', sube: '' }
  return { sinif: m[1], sube: m[2].toLocaleUpperCase('tr') }
}

/**
 * Sınıf ve şube seçimi.
 *
 * Elle yazıldığında "1-a", "1/A", "1 A" gibi farklı biçimler oluşuyor ve
 * sınıf bazlı listeler bölünüyordu. İki açılır liste tek bir `sinif` değeri
 * üretir: her zaman "1-A" biçiminde.
 */
export function SinifSecici({ baslangic }: { baslangic?: string | null }) {
  const ilk = sinifCozumle(baslangic)
  const [sinif, setSinif] = useState(ilk.sinif)
  const [sube, setSube] = useState(ilk.sube)

  // Yalnızca ikisi de doluysa değer üretilir; biri eksikse sınıf atanmamış sayılır.
  const deger = sinif && sube ? `${sinif}-${sube}` : ''

  return (
    <>
      <input type="hidden" name="sinif" value={deger} />
      <div className="flex gap-2">
        <select
          value={sinif}
          onChange={(e) => setSinif(e.target.value)}
          className="girdi"
          aria-label="Sınıf"
        >
          <option value="">Sınıf</option>
          {SINIFLAR.map((s) => (
            <option key={s} value={s}>
              {s}. sınıf
            </option>
          ))}
        </select>
        <select
          value={sube}
          onChange={(e) => setSube(e.target.value)}
          className="girdi"
          aria-label="Şube"
        >
          <option value="">Şube</option>
          {SUBELER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {deger && (
          <span className="self-center text-sm font-medium text-solgun">= {deger}</span>
        )}
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'

/** Anasınıfı da bir "sınıf" kademesi; değer içinde bu adla saklanır. */
export const ANASINIFI = 'Anasınıfı'

export const SINIFLAR = ['1', '2', '3', '4', '5', '6', '7', '8']
export const SUBELER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/**
 * Anasınıfının üç şubesi var ve ikisinin okulda kullanılan bir adı var.
 * Listede adıyla görünmesi, kaydı alan kişinin doğru şubeyi seçmesini
 * kolaylaştırıyor; saklanan değer yine tek harf.
 */
export const ANASINIFI_SUBELERI = [
  { kod: 'A', ad: 'A' },
  { kod: 'B', ad: 'B - Masal Sınıfı' },
  { kod: 'C', ad: 'C - Uğur Böcekleri Sınıfı' },
]

/** "1-A" → { sinif: '1', sube: 'A' }; tanınmayan biçim boş döner. */
export function sinifCozumle(deger: string | null | undefined): {
  sinif: string
  sube: string
} {
  const ham = (deger ?? '').trim()

  const anasinifi = new RegExp(
    `^\\s*${ANASINIFI}\\s*[-/]\\s*([A-Za-zÇĞİÖŞÜçğıöşü])\\s*$`,
    'i',
  ).exec(ham)
  if (anasinifi) return { sinif: ANASINIFI, sube: anasinifi[1].toLocaleUpperCase('tr') }

  const m = /^\s*(\d)\s*[-/]\s*([A-Za-zÇĞİÖŞÜçğıöşü])\s*$/.exec(ham)
  if (!m) return { sinif: '', sube: '' }
  return { sinif: m[1], sube: m[2].toLocaleUpperCase('tr') }
}

/**
 * Sınıf ve şube seçimi.
 *
 * Elle yazıldığında "1-a", "1/A", "1 A" gibi farklı biçimler oluşuyor ve
 * sınıf bazlı listeler bölünüyordu. İki açılır liste tek bir `sinif` değeri
 * üretir: her zaman "1-A" ya da "Anasınıfı-C" biçiminde.
 */
export function SinifSecici({ baslangic }: { baslangic?: string | null }) {
  const ilk = sinifCozumle(baslangic)
  const [sinif, setSinif] = useState(ilk.sinif)
  const [sube, setSube] = useState(ilk.sube)

  const anasinifiMi = sinif === ANASINIFI
  const subeler = anasinifiMi
    ? ANASINIFI_SUBELERI
    : SUBELER.map((s) => ({ kod: s, ad: s }))

  // Yalnızca ikisi de doluysa değer üretilir; biri eksikse sınıf atanmamış sayılır.
  const deger = sinif && sube ? `${sinif}-${sube}` : ''

  function sinifDegistir(yeni: string) {
    setSinif(yeni)
    // Anasınıfında D-H şubesi yok; seçili kalırsa geçersiz bir değer üretirdi.
    if (yeni === ANASINIFI && !ANASINIFI_SUBELERI.some((s) => s.kod === sube)) {
      setSube('')
    }
  }

  return (
    <>
      <input type="hidden" name="sinif" value={deger} />
      <div className="flex gap-2">
        <select
          value={sinif}
          onChange={(e) => sinifDegistir(e.target.value)}
          className="girdi"
          aria-label="Sınıf"
        >
          <option value="">Sınıf</option>
          <option value={ANASINIFI}>{ANASINIFI}</option>
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
          {subeler.map((s) => (
            <option key={s.kod} value={s.kod}>
              {s.ad}
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

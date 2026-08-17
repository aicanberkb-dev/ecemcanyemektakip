'use client'

import { useId, useRef, useState } from 'react'

export type AramaOnerisi = {
  /** Seçilince arama kutusuna yazılacak metin */
  deger: string
  /** Listede görünen ad */
  etiket: string
  /** Sağda küçük punto ile görünen ek bilgi (sınıf, no, tutar…) */
  alt?: string
  /**
   * Kaydın kimliği. Verilirse seçim "şu kaydı göster" anlamına gelir; aynı
   * adı taşıyan başka kayıtlar listeye karışmaz. Yoksa metin araması olarak
   * çalışır.
   */
  id?: string
}

/**
 * Yazdıkça süzen arama kutusu; altında eşleşen kayıtları öneri olarak listeler.
 *
 * Sunucuya gitmez: liste zaten yüklü olduğu için süzme anında yapılır.
 * Eşleşme Türkçe karakterden bağımsızdır (bkz. lib/arama).
 */
export function AramaKutusu({
  deger,
  degistir,
  etiket = 'Ara',
  ipucu,
  sonuc,
  oneriler = [],
  oneriSec,
  genislik = 'min-w-56 flex-1',
}: {
  deger: string
  degistir: (yeni: string) => void
  etiket?: string
  ipucu?: string
  /** Kaç kayıt kaldığını gösterir; boş bırakılırsa yazılmaz. */
  sonuc?: string
  /** Kutunun altında listelenecek eşleşmeler. Boşsa öneri gösterilmez. */
  oneriler?: AramaOnerisi[]
  /**
   * Listeden bir öneri seçildiğinde çağrılır. Kimlikli önerilerde çağıran
   * taraf o kayda kilitlenebilir; aksi halde yalnızca metin araması yapılır.
   */
  oneriSec?: (o: AramaOnerisi) => void
  genislik?: string
}) {
  const id = useId()
  const [acik, setAcik] = useState(false)
  const [vurgulu, setVurgulu] = useState(-1)
  const kapatmaZamani = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tek eşleşme kaldıysa ve zaten o seçilmişse liste anlamsız
  const gosterilecek = oneriler.slice(0, 8)
  const listeAcik = acik && deger.trim() !== '' && gosterilecek.length > 0

  function sec(o: AramaOnerisi) {
    if (oneriSec) oneriSec(o)
    else degistir(o.deger)
    setAcik(false)
    setVurgulu(-1)
  }

  function tusa(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setAcik(false)
      return
    }
    if (!listeAcik) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setVurgulu((v) => (v + 1) % gosterilecek.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setVurgulu((v) => (v <= 0 ? gosterilecek.length - 1 : v - 1))
    } else if (e.key === 'Enter' && vurgulu >= 0) {
      e.preventDefault()
      sec(gosterilecek[vurgulu])
    }
  }

  return (
    <div className={`${genislik} relative`}>
      <label className="etiket" htmlFor={id}>
        {etiket}
      </label>
      <div className="relative">
        <input
          id={id}
          type="search"
          value={deger}
          onChange={(e) => {
            degistir(e.target.value)
            setAcik(true)
            setVurgulu(-1)
          }}
          onFocus={() => setAcik(true)}
          onBlur={() => {
            // Öneriye tıklamaya fırsat kalsın diye kapanış geciktirilir.
            kapatmaZamani.current = setTimeout(() => setAcik(false), 150)
          }}
          onKeyDown={tusa}
          placeholder={ipucu}
          className="girdi pr-16"
          autoComplete="off"
          role="combobox"
          aria-expanded={listeAcik}
          aria-controls={`${id}-liste`}
        />
        {deger && (
          <button
            type="button"
            onClick={() => {
              degistir('')
              setAcik(false)
            }}
            className="absolute inset-y-0 right-2 my-auto h-6 rounded px-2 text-xs text-solgun hover:bg-gray-100"
            aria-label="Aramayı temizle"
          >
            temizle
          </button>
        )}

        {listeAcik && (
          <ul
            id={`${id}-liste`}
            role="listbox"
            className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-cizgi bg-white py-1 shadow-lg"
            onMouseDown={(e) => {
              // Tıklamadan önce blur olup listeyi kapatmasın
              e.preventDefault()
              if (kapatmaZamani.current) clearTimeout(kapatmaZamani.current)
            }}
          >
            {gosterilecek.map((o, i) => (
              <li key={o.deger + i}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === vurgulu}
                  onClick={() => sec(o)}
                  onMouseEnter={() => setVurgulu(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                    i === vurgulu ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{o.etiket}</span>
                  {o.alt && <span className="text-xs text-solgun">{o.alt}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {deger && sonuc && <p className="mt-1 text-xs text-solgun">{sonuc}</p>}
    </div>
  )
}

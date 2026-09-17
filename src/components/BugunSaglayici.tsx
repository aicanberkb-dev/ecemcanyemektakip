'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

import { gercekBugun } from '@/lib/simulasyon'

/**
 * İstemci tarafında "bugün".
 *
 * Değer sunucudan (kök düzenden) geliyor. Çerezi doğrudan istemcide okumak
 * daha kısa olurdu ama sunucu çıktısıyla istemci çıktısı farklı olacağı için
 * hidrasyon uyuşmazlığı doğardı; ilk değer sunucudan.
 *
 * Sonra canlı tutulur: sekme gece boyunca açık kaldığında ertesi sabah
 * tahsilat dünün tarihiyle girilmişti. Simülasyon kapalıysa tarih yarım
 * dakikada bir ve sekmeye dönüldüğünde yeniden okunur; gün değiştiyse sayfa
 * verisi de tazelenir.
 */
const BugunBaglami = createContext<string | null>(null)

export function BugunSaglayici({
  bugun,
  simulasyon,
  children,
}: {
  bugun: string
  /** Simülasyon açıksa tarih sabit kalır, gerçek saate bakılmaz */
  simulasyon: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const [canli, setCanli] = useState(bugun)

  // Sunucu yeni bir tarih gönderirse (simülasyon açıldı/kapandı) o geçerli
  const [sunucudan, setSunucudan] = useState(bugun)
  if (bugun !== sunucudan) {
    setSunucudan(bugun)
    setCanli(bugun)
  }

  const sonDeger = useRef(canli)
  useEffect(() => {
    sonDeger.current = canli
  }, [canli])

  useEffect(() => {
    if (simulasyon) return

    const kontrol = (acilis: boolean) => {
      const gercek = gercekBugun()
      if (gercek === sonDeger.current) return
      sonDeger.current = gercek
      setCanli(gercek)
      // Açılıştaki düzeltme (sunucu saati UTC, gece yarısından sonra farklı
      // gün verebilir) için sayfayı yeniden çekmeye gerek yok; gün sonradan
      // döndüyse tatil, taksit gibi sunucu verisi de tazelensin.
      if (!acilis) router.refresh()
    }
    const odak = () => kontrol(false)

    kontrol(true)
    const zamanlayici = setInterval(odak, 30_000)
    window.addEventListener('focus', odak)
    document.addEventListener('visibilitychange', odak)
    return () => {
      clearInterval(zamanlayici)
      window.removeEventListener('focus', odak)
      document.removeEventListener('visibilitychange', odak)
    }
  }, [simulasyon, router])

  return <BugunBaglami.Provider value={canli}>{children}</BugunBaglami.Provider>
}

/** Uygulamanın "bugün"ü — simülasyon açıksa o tarih. Gün dönünce güncellenir. */
export function useBugun(): string {
  return useContext(BugunBaglami) ?? gercekBugun()
}

/**
 * Tarih kutusu için durum: bugünle başlar, gün dönünce kutu da bugüne geçer.
 * Elle başka bir tarih seçildiyse ona dokunulmaz.
 */
export function useBugunTarihi(): [string, (t: string) => void] {
  const bugun = useBugun()
  const [tarih, setTarih] = useState(bugun)
  const [izlenen, setIzlenen] = useState(bugun)
  if (bugun !== izlenen) {
    setIzlenen(bugun)
    if (tarih === izlenen) setTarih(bugun)
  }
  return [tarih, setTarih]
}

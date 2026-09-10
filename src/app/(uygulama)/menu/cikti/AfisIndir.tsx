'use client'

import { toBlob } from 'html-to-image'
import { useEffect, useRef, useState } from 'react'

/** Görselin genişliği (px, ölçek öncesi). Telefonda da masaüstünde de aynı çıksın. */
const GENISLIK = 794
const OLCEK = 3

/**
 * Afişi PNG olarak indirir ya da telefonun paylaşım menüsüne (WhatsApp) verir.
 *
 * `children` afişin kendisi: ekran dışında sabit 794 px genişlikte bir kopyası
 * çizilir, görsel ondan alınır — ekrandaki afiş telefonda dar olsa da görsel
 * her yerde aynı çıkar.
 *
 * Görsel sayfa açılınca hazırlanır, tıklamada değil: iPhone'da paylaşım menüsü
 * yalnızca dokunuşun hemen ardından açılabiliyor; görseli o anda üretmek
 * birkaç saniye sürdüğü için menü açılmıyordu.
 */
export function AfisIndir({ dosyaAdi, children }: { dosyaAdi: string; children: React.ReactNode }) {
  const kaynak = useRef<HTMLDivElement>(null)
  const [dosya, setDosya] = useState<File | null>(null)
  const [hata, setHata] = useState(false)
  const [paylasilir, setPaylasilir] = useState(false)

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        await document.fonts.ready
        const dugum = kaynak.current?.firstElementChild as HTMLElement | null
        if (!dugum) return
        // Safari ilk çağrıda görselleri (logo) boş çiziyor; ilki ısınma turu.
        await toBlob(dugum, { pixelRatio: 1 })
        // backgroundColor verilmemeli: kök elemanın zeminini ezip siyah afişi beyaz yapıyor.
        const blob = await toBlob(dugum, { pixelRatio: OLCEK })
        if (!blob || iptal) return
        const f = new File([blob], dosyaAdi, { type: 'image/png' })
        setDosya(f)
        setPaylasilir(typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] }))
      } catch {
        if (!iptal) setHata(true)
      }
    })()
    return () => {
      iptal = true
    }
  }, [dosyaAdi])

  function indir() {
    if (!dosya) return
    const url = URL.createObjectURL(dosya)
    const a = document.createElement('a')
    a.href = url
    a.download = dosyaAdi
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function paylas() {
    if (!dosya) return
    try {
      await navigator.share({ files: [dosya] })
    } catch {
      // Kullanıcı paylaşım menüsünü kapattı — yapılacak bir şey yok.
    }
  }

  return (
    <>
      {hata ? (
        <span className="text-sm text-red-700">
          Görsel hazırlanamadı. Sayfayı yenileyip tekrar deneyin.
        </span>
      ) : !dosya ? (
        <span className="text-sm text-solgun">Görsel hazırlanıyor…</span>
      ) : (
        <>
          {paylasilir && (
            <button type="button" onClick={paylas} className="btn-birincil">
              Paylaş
            </button>
          )}
          <button
            type="button"
            onClick={indir}
            className={paylasilir ? 'btn-ikincil' : 'btn-birincil'}
          >
            Görseli indir (PNG)
          </button>
        </>
      )}

      <div
        ref={kaynak}
        aria-hidden
        inert
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: GENISLIK,
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </>
  )
}

import type { OkulTema } from '@/lib/okul-tema'

/**
 * Geniş ekranda içerik alanının (1280 px) iki yanında kalan boşluğa okulun
 * renginde birer şerit ve logo. Yalnız 1600 px ve üstünde görünür: daha dar
 * ekranda yanlarda logo sığacak yer kalmıyor. Yazdırmada basılmaz.
 */
export function YanSeritler({ tema, okulAdi }: { tema: OkulTema | null; okulAdi: string }) {
  if (!tema) return null

  const serit = (taraf: 'left-0' | 'right-0') => (
    <aside
      aria-hidden
      className={`yan-serit yazdirma-gizle pointer-events-none fixed inset-y-0 ${taraf} z-0 hidden flex-col items-center justify-center gap-5 min-[1600px]:flex`}
      style={{ width: 'calc((100% - 80rem) / 2)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo */}
      <img src="/logo/logo-kirmizi-beyaz.svg" alt="" className="yan-serit-logo w-[78%] max-w-[260px]" />
      <span className="font-serif text-lg font-bold tracking-[0.18em]">ECEM CAN GIDA</span>
      <span className="text-xs font-semibold tracking-[0.3em] uppercase opacity-80">{okulAdi}</span>
    </aside>
  )

  return (
    <>
      {/* Bütün ekranın arkası: seçilen görünüme göre boyanır ([data-orta]) */}
      <div aria-hidden className="orta-zemin yazdirma-gizle pointer-events-none fixed inset-0 -z-10" />
      {serit('left-0')}
      {serit('right-0')}
    </>
  )
}

'use client'

import { usePathname } from 'next/navigation'

import { genelYolMu } from '@/lib/okul-sabitler'
import type { OkulTema } from '@/lib/okul-tema'

import { YanSeritler } from './YanSeritler'

/**
 * Ekranın teması: menü rengi, okul düğmesi ve geniş ekrandaki yan şeritler.
 *
 * Tema okul seçicisine bakar ama yönetim sayfalarında (maaşlar, kiralar,
 * günlük ciro, menü, maliyet) okul seçimi geçerli değil: o ekranlar bütün
 * birimleri birden gösteriyor. Okul modundayken açıldıklarında çerçeve o
 * okulun rengine boyanıyordu — temanın amacı tam tersiydi, hangi okulda
 * çalışıldığı belli olsun diye konmuştu. Bu yüzden yönetim yollarında tema
 * seçimden bağımsız olarak "genel" oluyor.
 */
export function TemaKabi({
  tema,
  okulAdi,
  gorunum,
  children,
}: {
  tema: OkulTema | null
  okulAdi: string
  gorunum: string
  children: React.ReactNode
}) {
  const yol = usePathname() ?? ''
  const yonetim = genelYolMu(yol)

  const etkinTema = yonetim ? 'genel' : tema
  const etkinAd = yonetim ? 'YÖNETİM' : okulAdi

  return (
    <div data-tema={etkinTema ?? undefined} data-orta={gorunum} className="contents">
      <YanSeritler tema={etkinTema} okulAdi={etkinAd} />
      {children}
    </div>
  )
}

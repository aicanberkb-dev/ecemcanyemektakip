import { aktifOkul } from '@/lib/okul'

import { PosEkrani } from './PosEkrani'

export const metadata = { title: 'Yemekhane — Yemek Takip' }

export default async function PosPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  // key: okul değişince ekran tamamen sıfırlanır, önceki okulun öğrencisi kalmaz
  return <PosEkrani key={okul.id} okulId={okul.id} okulAdi={okul.ad} />
}

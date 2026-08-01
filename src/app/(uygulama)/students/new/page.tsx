import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'

import { ogrenciEkle } from '../actions'
import { OgrenciFormu } from '../OgrenciFormu'

export const metadata = { title: 'Yeni Öğrenci — Yemek Takip' }

export default async function YeniOgrenciPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/students" className="text-sm text-vurgu hover:underline">
        ← Öğrenciler
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Yeni Öğrenci</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <p className="text-sm text-solgun">
        Öğrenci <strong>{okul.ad}</strong> kaydına eklenecek. Farklı okula eklemek için
        üst bardan okulu değiştirin.
      </p>
      <OgrenciFormu eylem={ogrenciEkle} iptalYolu="/students" />
    </div>
  )
}

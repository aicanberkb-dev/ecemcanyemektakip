import Link from 'next/link'

import { ogrenciEkle } from '../actions'
import { OgrenciFormu } from '../OgrenciFormu'

export const metadata = { title: 'Yeni Öğrenci — Yemek Takip' }

export default function YeniOgrenciPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/students" className="text-sm text-vurgu hover:underline">
          ← Öğrenciler
        </Link>
      </div>
      <h1 className="baslik">Yeni Öğrenci</h1>
      <OgrenciFormu eylem={ogrenciEkle} iptalYolu="/students" />
    </div>
  )
}

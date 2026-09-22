import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { anasinifiVarMi } from '@/lib/sinif'
import { supabaseServer } from '@/lib/supabase/server'

import { ogrenciEkle } from '../actions'
import { OgrenciFormu } from '../OgrenciFormu'

export const metadata = { title: 'Yeni Öğrenci — Yemek Takip' }

export default async function YeniOgrenciPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  // Önizleme: kesin numara kayıt anında sunucuda atanır
  const supabase = await supabaseServer()
  const { data: sonrakiNo } = await supabase.rpc('sonraki_ogrenci_no', {
    p_okul_id: okul.id,
  })

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
        Öğrenci <strong>{okul.ad}</strong> kaydına eklenecek. Sıradaki numara şu an{' '}
        <strong className="tabular-nums">{sonrakiNo ?? '—'}</strong>; kesin numara
        kaydedince verilir ve öğrenci sayfasında yazar. Farklı okula eklemek için üst
        bardan okulu değiştirin.
      </p>
      <OgrenciFormu
        eylem={ogrenciEkle}
        iptalYolu="/students"
        sonrakiNo={(sonrakiNo as string) ?? undefined}
        anasinifiVar={anasinifiVarMi(okul.ad)}
      />
    </div>
  )
}

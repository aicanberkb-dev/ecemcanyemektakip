import type { SeciliOgrenci } from '@/components/OgrenciSecici'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { IslemFormu } from './IslemFormu'

export const metadata = { title: 'İşlem Girişi — Yemek Takip' }

export default async function YeniIslemPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { student } = await searchParams
  const okul = await aktifOkul()
  if (!okul) return null

  let baslangic: SeciliOgrenci | null = null
  if (student) {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from('student_balances')
      .select('*')
      .eq('student_id', student)
      .eq('okul_id', okul.id)
      .maybeSingle()

    if (data) {
      const b = data as StudentBalance
      baslangic = {
        student_id: b.student_id,
        ad_soyad: b.ad_soyad,
        ogrenci_no: b.ogrenci_no,
        sinif: b.sinif,
        kalan: Number(b.kalan),
        gunluk_ucret: Number(b.gunluk_ucret),
        abone_tipi: b.abone_tipi,
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">İşlem Girişi</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      {/* key: okul değişince form ve seçili öğrenci sıfırlanır */}
      <IslemFormu key={okul.id} okulId={okul.id} baslangic={baslangic} />
    </div>
  )
}

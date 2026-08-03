import { bugunISO } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { TopluEkran, type TopluOgrenci } from './TopluEkran'

export const metadata = { title: 'Toplu Yemek Yedir — Yemek Takip' }

export default async function TopluPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>
}) {
  const { gun: gunQ } = await searchParams
  const gun = gunQ || bugunISO()

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  const [{ data: ogrenciVeri }, { data: kayitliVeri }] = await Promise.all([
    supabase
      .from('student_balances')
      .select('*')
      .eq('okul_id', okul.id)
      .eq('aktif', true)
      .order('ogrenci_no'),
    // O gün zaten yemek kaydı olanlar — tekrar eklenmeyecek
    supabase
      .from('transactions')
      .select('student_id, students!inner(okul_id)')
      .eq('students.okul_id', okul.id)
      .eq('tarih', gun)
      .not('ogun_abone_tipi', 'is', null),
  ])

  const kayitli = new Set(
    ((kayitliVeri ?? []) as { student_id: string }[]).map((k) => k.student_id),
  )

  const ogrenciler: TopluOgrenci[] = ((ogrenciVeri ?? []) as StudentBalance[]).map((o) => ({
    student_id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    abone_tipi: o.abone_tipi,
    kalan: Number(o.kalan),
    gunluk_ucret: Number(o.gunluk_ucret),
    zaten_kayitli: kayitli.has(o.student_id),
  }))

  const siniflar = [...new Set(ogrenciler.map((o) => o.sinif).filter(Boolean))].sort() as string[]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Toplu Yemek Yedir</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <p className="text-sm text-solgun">
        Kesinti sırasında kâğıda yazılan listeyi toplu girmek için. O gün zaten kaydı
        olan öğrenciler işaretli gelir ve tekrar eklenmez.
      </p>

      {/* key: okul veya gün değişince seçimler sıfırlansın */}
      <TopluEkran
        key={`${okul.id}-${gun}`}
        gun={gun}
        ogrenciler={ogrenciler}
        siniflar={siniflar}
      />
    </div>
  )
}

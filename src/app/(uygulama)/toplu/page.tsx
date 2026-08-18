import { bugunISO } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { TopluEkran, type TopluOgrenci } from './TopluEkran'

export const metadata = { title: 'Toplu Yemek Yedir — Yemek Takip' }

/** Hafta sonuysa bir önceki cumaya çeker; iş gününü olduğu gibi bırakır. */
function isGunuYap(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const h = d.getDay()
  if (h === 6) d.setDate(d.getDate() - 1) // Cumartesi → Cuma
  else if (h === 0) d.setDate(d.getDate() - 2) // Pazar → Cuma
  else return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export default async function TopluPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>
}) {
  const { gun: gunQ } = await searchParams
  // Hafta sonu okul yok: hafta sonuna denk gelen bir gün istenirse (bugün
  // cumartesiyse ya da adres çubuğuna elle yazıldıysa) en yakın önceki iş
  // gününe düşülür.
  const gun = isGunuYap(gunQ || bugunISO())

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
    ogrenci_tipi: o.ogrenci_tipi,
    kalan: Number(o.kalan),
    gunluk_ucret: Number(o.gunluk_ucret),
    zaten_kayitli: kayitli.has(o.student_id),
  }))

  // Seçili günün tarifesi: geçmişe dönük giriş o günün fiyatından yapılsın
  const { data: tarifeVeri } = await supabase
    .rpc('ucretler', { p_okul_id: okul.id, p_tarih: gun })
    .maybeSingle()

  const tarife = tarifeVeri as { taban_gunluk_ucret: number } | null
  const ucretliVarsayilan = Number(tarife?.taban_gunluk_ucret ?? 0)

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
        okulId={okul.id}
        ogrenciler={ogrenciler}
        siniflar={siniflar}
        ucretliVarsayilan={ucretliVarsayilan}
      />
    </div>
  )
}

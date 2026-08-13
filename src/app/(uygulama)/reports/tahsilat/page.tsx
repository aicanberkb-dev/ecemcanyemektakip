import { TarihAraligi } from '@/components/TarihAraligi'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { OdemeYontemi } from '@/lib/types'

import { TahsilatListesi, type TahsilatSatiri } from './TahsilatListesi'

export const metadata = { title: 'Tahsilat Geçmişi — Yemek Takip' }

type Ham = {
  id: string
  student_id: string
  tarih: string
  tutar: number | string
  aciklama: string | null
  odeme_yontemi: OdemeYontemi | null
  students: { ad_soyad: string; ogrenci_no: string; sinif: string | null } | null
}

export default async function TahsilatPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const q = await searchParams
  const yil = new Date().getFullYear()
  const bas = q.bas || `${yil}-01-01`
  const bit = q.bit || `${yil}-12-31`

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const { data, error } = await supabase
    .from('transactions')
    .select('id, student_id, tarih, tutar, aciklama, odeme_yontemi, students!inner(ad_soyad, ogrenci_no, sinif, okul_id)')
    .eq('students.okul_id', okul.id)
    .eq('tip', 'tahsilat')
    .gte('tarih', bas)
    .lte('tarih', bit)
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  // Arama sunucuda değil listede yapılır: kullanıcı yazdıkça süzülsün ve
  // özet kartları da anında güncellensin.
  const kayitlar: TahsilatSatiri[] = ((data ?? []) as unknown as Ham[]).map((k) => ({
    id: k.id,
    student_id: k.student_id,
    tarih: k.tarih,
    tutar: Number(k.tutar),
    aciklama: k.aciklama,
    odeme_yontemi: k.odeme_yontemi,
    ad_soyad: k.students?.ad_soyad ?? '—',
    ogrenci_no: k.students?.ogrenci_no ?? '',
    sinif: k.students?.sinif ?? null,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Tahsilat Geçmişi</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/tahsilat" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <TahsilatListesi kayitlar={kayitlar} />
    </div>
  )
}

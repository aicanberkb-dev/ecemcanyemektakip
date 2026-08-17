import Link from 'next/link'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { OgrenciListesi, type OgrenciSatiri } from './OgrenciListesi'

export const metadata = { title: 'Öğrenciler — Yemek Takip' }

export default async function StudentsPage() {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  // Okulun tüm öğrencileri tek seferde gelir; arama ve süzgeçler listede,
  // yazdıkça çalışır. Okul başına öğrenci sayısı bunun için fazlasıyla küçük.
  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase.from('student_balances').select('*').eq('okul_id', okulId).order('ad_soyad'),
    supabase.from('students').select('sinif').eq('okul_id', okulId).not('sinif', 'is', null),
  ])

  const ogrenciler: OgrenciSatiri[] = ((data ?? []) as StudentBalance[]).map((o) => ({
    student_id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    kimlik_no: o.kimlik_no,
    veli_adi: o.veli_adi,
    veli_telefon: o.veli_telefon,
    veli2_adi: o.veli2_adi,
    veli2_telefon: o.veli2_telefon,
    iskonto_orani: Number(o.iskonto_orani),
    iskonto_tutar: Number(o.iskonto_tutar),
    devir: Number(o.devir),
    ogun_sayisi: Number(o.ogun_sayisi),
    kardes_grup_id: o.kardes_grup_id,
    abone_tipi: o.abone_tipi,
    ogrenci_tipi: o.ogrenci_tipi,
    aktif: o.aktif,
    alinan_para: Number(o.alinan_para),
    harcanan: Number(o.harcanan),
    kalan: Number(o.kalan),
  }))

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">Öğrenciler</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/students/kayit-formu" className="btn-ikincil">
            Kayıt Formu Yazdır
          </Link>
          <Link href="/students/new" className="btn-birincil">
            + Yeni Öğrenci
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <OgrenciListesi ogrenciler={ogrenciler} siniflar={siniflar} />
    </div>
  )
}

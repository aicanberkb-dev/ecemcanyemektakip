import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

import { EkstreEkrani, type OgrenciSecenegi } from './EkstreEkrani'

export const metadata = { title: 'Ekstre Aktarımı — Yemek Takip' }

export default async function EkstrePage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  // kalan: bölüştürme yaparken hangi kardeşin ne kadar borcu olduğu görünsün
  const { data } = await supabase
    .from('student_balances')
    .select('student_id, ogrenci_no, ad_soyad, sinif, kardes_grup_id, kalan')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .order('ogrenci_no')

  const ogrenciler: OgrenciSecenegi[] = (
    (data ?? []) as {
      student_id: string
      ogrenci_no: string
      ad_soyad: string
      sinif: string | null
      kardes_grup_id: string | null
      kalan: number | string
    }[]
  ).map((o) => ({
    id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    kardes_grup_id: o.kardes_grup_id,
    kalan: Number(o.kalan),
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Ekstre Aktarımı</h1>
          <p className="text-sm text-solgun">
            Bankadan indirdiğiniz hesap hareketlerini yükleyin; gelen ödemeler veli adına
            göre öğrencilerle eşleştirilir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
          <Link href="/payments/new" className="text-sm text-vurgu hover:underline">
            Tek tahsilat gir →
          </Link>
        </div>
      </div>

      {ogrenciler.length === 0 ? (
        <p className="kart p-6 text-center text-solgun">
          Bu okulda kayıtlı öğrenci yok. Önce{' '}
          <Link href="/students/new" className="text-vurgu hover:underline">
            öğrenci ekleyin
          </Link>
          .
        </p>
      ) : (
        // key: okul değişince yüklenen dosya ve seçimler sıfırlanır
        <EkstreEkrani key={okul.id} ogrenciler={ogrenciler} />
      )}
    </div>
  )
}

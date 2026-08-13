import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { YazdirButonu } from '@/components/Yazdir'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { BorcluListesi, type BorcluSatiri } from './BorcluListesi'

export const metadata = { title: 'Borçlu Öğrenciler — Yemek Takip' }

export default async function BorcluPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  // Sadece günlükçüler: aylıkçıların ücreti taksit planından takip edilir,
  // yemek başına borçlanmadıkları için bu raporda yerleri yok.
  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase
      .from('student_balances')
      .select('*')
      .eq('okul_id', okul.id)
      .eq('abone_tipi', 'gunluk')
      .eq('aktif', true)
      .lt('kalan', 0)
      .order('kalan'),
    supabase
      .from('students')
      .select('sinif')
      .eq('okul_id', okul.id)
      .eq('abone_tipi', 'gunluk')
      .not('sinif', 'is', null),
  ])

  // Arama ve sınıf süzgeci listede yapılır: yazdıkça süzülsün, özet kartları
  // ve CSV bağlantısı da anında güncellensin.
  const borclular: BorcluSatiri[] = ((data ?? []) as StudentBalance[]).map((o) => ({
    student_id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    veli_adi: o.veli_adi,
    veli2_adi: o.veli2_adi,
    veli_telefon: o.veli_telefon,
    gunluk_ucret: Number(o.gunluk_ucret),
    borc: Math.abs(Number(o.kalan)),
  }))

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  return (
    <div className="space-y-4">
      <CiktiBasligi baslik="Borçlu Öğrenciler" okul={okul.ad} />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="baslik">Borçlu Öğrenciler</h1>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>
        <YazdirButonu />
      </div>

      <p className="yazdirma-gizle text-sm text-solgun">
        Bakiyesi eksiye düşmüş <strong>günlükçü</strong> öğrenciler. Bakiyesi sıfır veya
        artıda olanlar listede görünmez. Aylıkçılar bu raporda yer almaz — onların takibi{' '}
        <Link href="/reports/taksit" className="text-vurgu hover:underline">
          Taksit Takibi
        </Link>{' '}
        sayfasındadır.
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <BorcluListesi borclular={borclular} siniflar={siniflar} />
    </div>
  )
}

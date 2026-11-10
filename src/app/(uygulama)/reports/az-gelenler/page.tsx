import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { YazdirButonu } from '@/components/Yazdir'
import { aktifOkul } from '@/lib/okul'
import { anasinifiVarMi } from '@/lib/sinif'
import { supabaseServer } from '@/lib/supabase/server'
import type { AzGelenSatiri } from '@/lib/types'

import { AzGelenlerListesi } from './AzGelenlerListesi'

export const metadata = { title: 'Az Gelenler — Yemek Takip' }

/**
 * Sezon boyunca devam oranı düşük aylıkçı öğrenciler — taksit dönemi
 * başlarken veliyle konuşulacak liste.
 *
 * Devam Çizelgesi tek bir ayı gün gün gösterir; buradaki soru "sezon
 * boyunca kim neredeyse hiç gelmedi". Hesap `az_gelenler` fonksiyonunda:
 * payda okulun gerçekten yemek verdiği günler, ölçüm öğrencinin aylık
 * aboneliğinin başladığı günden itibaren.
 */
export default async function AzGelenlerPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('az_gelenler', { p_okul_id: okul.id })
  const satirlar = (data ?? []) as AzGelenSatiri[]

  return (
    <div className="space-y-4">
      <CiktiBasligi baslik="Az Gelenler" okul={okul.ad} />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="baslik">Az Gelenler</h1>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>
        <YazdirButonu />
      </div>

      <p className="yazdirma-gizle text-sm text-solgun">
        Sezon başından bugüne devam oranı eşiğin altında kalan{' '}
        <strong>aylıkçı</strong> öğrenciler. Günlükçüler listede yok: gelmedikleri
        gün ücret de işlemiyor, onların takibi{' '}
        <Link href="/reports/borclu" className="text-vurgu hover:underline">
          Borçlu Öğrenciler
        </Link>{' '}
        sayfasında. Oranın paydası okulun gerçekten yemek verdiği günler — hafta
        sonu, tatil ve servis başlamadan önceki günler sayılmaz. Her öğrenci
        kendi aylık aboneliğinin başladığı günden ölçülür.
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <AzGelenlerListesi satirlar={satirlar} anasinifiVar={anasinifiVarMi(okul.ad)} />
    </div>
  )
}

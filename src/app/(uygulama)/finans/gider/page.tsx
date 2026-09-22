import { supabaseServer } from '@/lib/supabase/server'

import { GiderEkrani, type GiderSatiri } from './GiderEkrani'

export const metadata = { title: 'Günlük Gider — Yemek Takip' }

export default async function GunlukGiderPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('gunluk_gider')
    .select('id, tarih, tutar, aciklama')
    .order('tarih', { ascending: false })
    .order('created_at')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Günlük Gider</h1>
        <p className="text-sm text-solgun">
          O gün ne harcandıysa satır satır buraya. Tarih bugünle gelir, tutarı ve ne
          olduğunu yaz, ekle. Satırlar güne göre gruplanır; her günün ve seçili aralığın
          toplamı altta görünür.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <GiderEkrani satirlar={(data ?? []) as GiderSatiri[]} />
    </div>
  )
}

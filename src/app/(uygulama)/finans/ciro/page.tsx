import { supabaseServer } from '@/lib/supabase/server'

import { CiroEkrani, type CiroSatiri } from './CiroEkrani'

export const metadata = { title: 'Günlük Ciro — Yemek Takip' }

/** Hiç kayıt yokken ekranda duran yerler */
const VARSAYILAN_YERLER = ['GÖKSU', 'AKBABA', 'TORİK']

export default async function CiroPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('gunluk_ciro')
    .select('id, tarih, yer, tutar, aciklama')
    .order('tarih', { ascending: false })

  const satirlar = (data ?? []) as CiroSatiri[]
  const yerler = [...new Set([...VARSAYILAN_YERLER, ...satirlar.map((s) => s.yer)])]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Günlük Ciro</h1>
        <p className="text-sm text-solgun">
          Yerlerin gün gün hasılatı. Bir günü girip kaydet; aynı günü tekrar girersen
          eskisinin üstüne yazar, toplam şişmez. Yeni bir yer eklemek için kutuya adını
          yaz, listeye kendiliğinden girer.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <CiroEkrani satirlar={satirlar} yerler={yerler} />
    </div>
  )
}

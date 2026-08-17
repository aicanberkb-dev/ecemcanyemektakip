import { supabaseServer } from '@/lib/supabase/server'

import type { Malzeme } from '../MalzemeBolumu'
import { Sekmeler } from '../Sekmeler'

import { ReceteEkrani, type ReceteSatiri, type YemekOzeti } from './ReceteEkrani'

export const metadata = { title: 'Reçeteler — Yemek Takip' }

export default async function ReceteterPage() {
  const supabase = await supabaseServer()

  const [{ data: yemekVeri }, { data: malzemeVeri }, { data: receteVeri }] =
    await Promise.all([
      supabase.rpc('yemek_maliyet_listesi'),
      supabase.from('malzemeler').select('*').order('ad'),
      supabase.from('yemek_receteleri').select('yemek_adi, malzeme_id, miktar'),
    ])

  const yemekler = (yemekVeri ?? []) as YemekOzeti[]
  const malzemeler = (malzemeVeri ?? []) as Malzeme[]
  const receteler = (receteVeri ?? []) as ReceteSatiri[]

  const eksik = yemekler.filter((y) => y.malzeme_sayisi === 0).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Reçeteler</h1>
        <p className="text-sm text-solgun">
          Her yemeğin <strong>bir kişilik</strong> malzemeleri ve gramajları. Maliyet
          buradan çıkar: gramaj × malzeme birim fiyatı.
        </p>
      </div>

      <Sekmeler />

      {eksik > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{eksik}</strong> yemeğin reçetesi yok. Reçetesiz yemek o günün
          maliyetine 0 ₺ katkı yapar — menü maliyeti olduğundan düşük görünür.
        </p>
      )}

      <ReceteEkrani yemekler={yemekler} malzemeler={malzemeler} receteler={receteler} />
    </div>
  )
}

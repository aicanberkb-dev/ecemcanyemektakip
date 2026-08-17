import { supabaseServer } from '@/lib/supabase/server'

import { Sekmeler } from '../Sekmeler'

import { YerlerEkrani, type HizmetFiyati, type HizmetNoktasi, type ListeSecenegi } from './YerlerEkrani'

export const metadata = { title: 'Hizmet Yerleri — Yemek Takip' }

export default async function YerlerPage() {
  const supabase = await supabaseServer()

  const [{ data: noktaVeri }, { data: fiyatVeri }, { data: listeVeri }] = await Promise.all([
    supabase.from('hizmet_noktalari').select('*').order('sira'),
    supabase
      .from('hizmet_fiyatlari')
      .select('*')
      .order('gecerli_baslangic', { ascending: false }),
    supabase.from('menu_listeleri').select('id, ad').eq('aktif', true).order('sira'),
  ])

  const noktalar = (noktaVeri ?? []) as HizmetNoktasi[]
  const fiyatlar = (fiyatVeri ?? []) as HizmetFiyati[]
  const listeler = (listeVeri ?? []) as ListeSecenegi[]

  const listesiz = noktalar.filter((n) => !n.liste_id).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Hizmet Yerleri</h1>
        <p className="text-sm text-solgun">
          Yemek verdiğiniz yerler, her birinin hangi menüyü yediği ve kişi başı satış
          fiyatı.
        </p>
      </div>

      <Sekmeler />

      {listesiz > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{listesiz}</strong> yerin menü listesi seçilmemiş. Menüsü olmayan yerin
          maliyeti hesaplanamaz; kâr/zarar tablosunda maliyeti 0 ₺ çıkar ve kâr olduğundan
          yüksek görünür.
        </p>
      )}

      <YerlerEkrani noktalar={noktalar} fiyatlar={fiyatlar} listeler={listeler} />
    </div>
  )
}

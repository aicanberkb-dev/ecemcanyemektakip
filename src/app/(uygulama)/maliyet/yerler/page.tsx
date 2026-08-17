import { bugunISO } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

import { YerlerEkrani, type HizmetFiyati, type HizmetNoktasi, type ListeSecenegi } from './YerlerEkrani'

export const metadata = { title: 'Hizmet Yerleri — Yemek Takip' }

export default async function YerlerPage() {
  const supabase = await supabaseServer()
  const bugun = bugunISO()

  const [{ data: noktaVeri }, { data: fiyatVeri }, { data: listeVeri }, { data: tarifeVeri }] =
    await Promise.all([
      supabase.from('hizmet_noktalari').select('*').order('sira'),
      supabase
        .from('hizmet_fiyatlari')
        .select('*')
        .order('gecerli_baslangic', { ascending: false }),
      supabase.from('menu_listeleri').select('id, ad').eq('aktif', true).order('sira'),
      // Okula bağlı noktaların fiyatı ayarlardaki tarifeden gelir
      supabase
        .from('ucret_gecmisi')
        .select('okul_id, gecerli_baslangic, taban_gunluk_ucret')
        .lte('gecerli_baslangic', bugun)
        .order('gecerli_baslangic', { ascending: false }),
    ])

  const noktalar = (noktaVeri ?? []) as HizmetNoktasi[]
  const fiyatlar = (fiyatVeri ?? []) as HizmetFiyati[]
  const listeler = (listeVeri ?? []) as ListeSecenegi[]

  // Her okul için en güncel taban günlük ücret
  const okulTarifesi: Record<string, number> = {}
  for (const t of (tarifeVeri ?? []) as {
    okul_id: string
    taban_gunluk_ucret: number | string
  }[]) {
    if (!(t.okul_id in okulTarifesi)) okulTarifesi[t.okul_id] = Number(t.taban_gunluk_ucret)
  }

  const listesiz = noktalar.filter((n) => !n.liste_id).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Hizmet Yerleri</h1>
        <p className="text-sm text-solgun">
          Yemek verdiğiniz yerler ve her birinin hangi menüyü yediği. Okullarımızın satış
          fiyatı ve günlük kişi sayısı sistemin kendi içinden gelir; dışarıdaki yerlerin
          fiyatı ve sabit kişi sayısı burada girilir.
        </p>
      </div>

      {listesiz > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{listesiz}</strong> yerin menü listesi seçilmemiş. Menüsü olmayan yerin
          maliyeti hesaplanamaz; kâr/zarar tablosunda maliyeti 0 ₺ çıkar ve kâr olduğundan
          yüksek görünür.
        </p>
      )}

      <YerlerEkrani
        noktalar={noktalar}
        fiyatlar={fiyatlar}
        listeler={listeler}
        okulTarifesi={okulTarifesi}
      />
    </div>
  )
}

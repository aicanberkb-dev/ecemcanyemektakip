import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

import { afisGunleri, MenuAfisi, type AfisGunu } from './MenuAfisi'

export const metadata = { title: 'Yemek Listesi Çıktısı — Yemek Takip' }

/**
 * Aylık yemek listesi afişi — veri buradan çekilir, çizim MenuAfisi'nde.
 *
 * Ekrandaki düzenleme tablosu veri girişi için; bu sayfa okunmak için.
 */
export default async function MenuCiktiPage({
  searchParams,
}: {
  searchParams: Promise<{ liste?: string; yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()

  const { data: listeler } = await supabase
    .from('menu_listeleri')
    .select('id, ad, havuz_grubu, satir_sayisi')
    .eq('aktif', true)
    .order('sira')

  const liste = (listeler ?? []).find((l) => l.id === q.liste) ?? (listeler ?? [])[0]
  if (!liste) return null

  const bas = `${yil}-${String(ay).padStart(2, '0')}-01`
  const bit = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`

  const [{ data }, { data: okulsuzVeri }] = await Promise.all([
    supabase
      .from('menu_gunleri')
      .select('tarih, corba, ana_yemek, yardimci, ek')
      .eq('liste_id', liste.id)
      .gte('tarih', bas)
      .lte('tarih', bit)
      .order('tarih'),
    supabase
      .from('okulsuz_gunler')
      .select('tarih')
      .is('hizmet_noktasi_id', null)
      .gte('tarih', bas)
      .lte('tarih', bit),
  ])

  const kapali = new Set(((okulsuzVeri ?? []) as { tarih: string }[]).map((o) => o.tarih))
  const gunler = afisGunleri((data ?? []) as AfisGunu[], kapali)

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/menu?liste=${liste.id}&yil=${yil}&ay=${ay}`}
          className="text-sm text-vurgu hover:underline"
        >
          ← Yemek listesine dön
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-solgun">
            {liste.ad} · {gunler.length} gün
          </span>
          <YazdirButonu etiket="Yazdır / PDF kaydet" />
        </div>
      </div>

      {gunler.length === 0 && (
        <p className="yazdirma-gizle rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {AY_ADLARI[ay - 1]} {yil} için <strong>{liste.ad}</strong> listesinde menü yok.
        </p>
      )}

      <MenuAfisi
        yil={yil}
        ay={ay}
        gunler={gunler}
        kapali={kapali}
        dortSatir={(liste.satir_sayisi ?? 4) >= 4}
      />
    </div>
  )
}

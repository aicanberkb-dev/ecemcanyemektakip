import Link from 'next/link'

import { AY_ADLARI } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

import { GiderEkrani, type Gider, type GiderOzeti, type Nokta, type Personel } from './GiderEkrani'

export const metadata = { title: 'Genel Giderler — Yemek Takip' }

export default async function GiderlerPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; nokta?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()

  const [{ data: noktaVeri }, { data: personelVeri }] = await Promise.all([
    supabase
      .from('hizmet_noktalari')
      .select('id, ad, okul_id')
      .eq('aktif', true)
      .order('sira'),
    supabase
      .from('personeller')
      .select('id, ad, calistigi_yer, hizmet_noktasi_id, aktif')
      .eq('aktif', true)
      .order('sira'),
  ])

  const noktalar = (noktaVeri ?? []) as Nokta[]
  const personeller = (personelVeri ?? []) as Personel[]
  const secili = noktalar.find((n) => n.id === q.nokta) ?? noktalar[0] ?? null

  const [{ data: giderVeri }, { data: ozetVeri }] = await Promise.all([
    secili
      ? supabase
          .from('donemsel_giderler')
          .select('*')
          .eq('hizmet_noktasi_id', secili.id)
          .eq('donem_yil', yil)
          .eq('donem_ay', ay)
          .order('kategori')
      : Promise.resolve({ data: null }),
    secili
      ? supabase.rpc('aylik_gider_ozeti', {
          p_nokta_id: secili.id,
          p_yil: yil,
          p_ay: ay,
        })
      : Promise.resolve({ data: null }),
  ])

  const giderler = (giderVeri ?? []) as Gider[]
  const ozet = ((ozetVeri ?? [])[0] ?? null) as GiderOzeti | null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Genel Giderler</h1>
        <p className="text-sm text-solgun">
          Maaş, sigorta, kira, mazot ve diğer giderler. Her yerin gideri kendine yazılır;
          aylık toplam o ay o yere hizmet verilen gün sayısına bölünüp{' '}
          <Link href="/maliyet/kar-zarar" className="text-vurgu hover:underline">
            kâr/zararda
          </Link>{' '}
          malzeme maliyetinin üstüne eklenir.
        </p>
      </div>

      {noktalar.length === 0 ? (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hizmet yeri tanımlı değil.{' '}
          <Link href="/maliyet/yerler" className="underline">
            Hizmet Yerleri
          </Link>{' '}
          sekmesinden ekleyin.
        </p>
      ) : (
        secili && (
          <GiderEkrani
            yil={yil}
            ay={ay}
            aylar={AY_ADLARI}
            noktalar={noktalar}
            secili={secili}
            personeller={personeller}
            giderler={giderler}
            ozet={ozet}
          />
        )
      )}
    </div>
  )
}

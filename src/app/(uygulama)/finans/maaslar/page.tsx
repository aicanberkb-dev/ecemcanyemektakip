import { supabaseServer } from '@/lib/supabase/server'

import {
  MaasEkrani,
  type Gider,
  type MaasOdemesi,
  type Personel,
  type Ucret,
} from './MaasEkrani'

export const metadata = { title: 'Maaşlar — Yemek Takip' }

export default async function MaaslarPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()

  const [
    { data: personelVeri },
    { data: ucretVeri },
    { data: odemeVeri },
    { data: giderVeri },
    { data: gizliVeri },
  ] = await Promise.all([
      supabase.from('personeller').select('*').order('sira'),
      supabase
        .from('personel_ucretleri')
        .select('*')
        .order('gecerli_baslangic', { ascending: false }),
      supabase
        .from('maas_odemeleri')
        .select('*')
        .eq('donem_yil', yil)
        .eq('donem_ay', ay),
      supabase
        .from('donemsel_giderler')
        .select('*')
        .eq('donem_yil', yil)
        .eq('donem_ay', ay)
        .order('tur'),
      // Bu ay listeden elle çıkarılan personel (yaz döneminde çıkanlar)
      supabase
        .from('personel_gizli')
        .select('personel_id')
        .eq('donem_yil', yil)
        .eq('donem_ay', ay),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Maaşlar</h1>
        <p className="text-sm text-solgun">
          Ay ay maaş takibi. Maaş günü geçmiş ve ödenmemiş olanlar kırmızı işaretlenir.
          Sigorta yeri, çalıştığı yerden farklı olabilir — ikisi ayrı tutulur.
        </p>
      </div>

      <MaasEkrani
        yil={yil}
        ay={ay}
        personeller={(personelVeri ?? []) as Personel[]}
        ucretler={(ucretVeri ?? []) as Ucret[]}
        odemeler={(odemeVeri ?? []) as MaasOdemesi[]}
        giderler={(giderVeri ?? []) as Gider[]}
        gizliler={((gizliVeri ?? []) as { personel_id: string }[]).map((g) => g.personel_id)}
      />
    </div>
  )
}

import { supabaseServer } from '@/lib/supabase/server'

import { SenetEkrani, type Senet } from './SenetEkrani'

export const metadata = { title: 'Senetler — Yemek Takip' }

export default async function SenetlerPage() {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('senetler').select('*').order('vade_tarihi')

  const senetler = (data ?? []) as Senet[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Tekel Senetleri</h1>
        <p className="text-sm text-solgun">
          Ödenecek senetler — vade, kime, tutar, banka. <strong>Son ödeme günü</strong>
          senet tarihinden 2 iş günü sonrasıdır ve hafta sonunu atlar: pazartesi senedi
          çarşamba, cuma senedi salı ödenir; hafta sonuna denk gelen senet çarşamba.
          Günü geçenler kırmızı, bu hafta gelenler sarı işaretlenir.
        </p>
      </div>

      <SenetEkrani senetler={senetler} />
    </div>
  )
}

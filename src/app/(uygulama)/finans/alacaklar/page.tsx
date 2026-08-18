import { supabaseServer } from '@/lib/supabase/server'

import { AlacakEkrani, type Cari, type Fatura, type Tahsilat } from './AlacakEkrani'

export const metadata = { title: 'Alacaklar — Yemek Takip' }

export default async function AlacaklarPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()

  const [{ data: cariVeri }, { data: faturaVeri }] = await Promise.all([
    supabase.from('cariler').select('*').eq('aktif', true).order('sira'),
    supabase
      .from('faturalar')
      .select('*')
      .eq('donem_yil', yil)
      .eq('donem_ay', ay),
  ])

  const cariler = (cariVeri ?? []) as Cari[]
  const faturalar = (faturaVeri ?? []) as Fatura[]

  // Tahsilatlar yalnızca bu ayın faturaları için
  const { data: tahsilatVeri } = faturalar.length
    ? await supabase
        .from('fatura_tahsilatlari')
        .select('*')
        .in(
          'fatura_id',
          faturalar.map((f) => f.id),
        )
        .order('tarih')
    : { data: null }

  const tahsilatlar = (tahsilatVeri ?? []) as Tahsilat[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Alacaklar</h1>
        <p className="text-sm text-solgun">
          Dış hizmetlerin aylık fatura tutarları ve gelen ödemeler. Ödeme parça parça
          gelebilir; tutar tamamlanınca satır yeşile döner.
        </p>
      </div>

      <AlacakEkrani
        yil={yil}
        ay={ay}
        cariler={cariler}
        faturalar={faturalar}
        tahsilatlar={tahsilatlar}
      />
    </div>
  )
}

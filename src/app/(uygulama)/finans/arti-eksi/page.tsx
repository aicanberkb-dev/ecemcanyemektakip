import { supabaseServer } from '@/lib/supabase/server'

import { ArtiEksiEkrani, type ArtiEksiSatiri } from './ArtiEksiEkrani'

export const metadata = { title: 'Artı / Eksi — Yemek Takip' }

export default async function ArtiEksiPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('arti_eksi')
    .select('id, yon, tarih, tutar, yontem, aciklama')
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Artı / Eksi</h1>
        <p className="text-sm text-solgun">
          Gelen ve giden paraları elle yazdığın defter. Artılardan eksiler çıkarılır,
          fark en üstte görünür. Tarih kutusu bugünle gelir, istersen değiştir.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <ArtiEksiEkrani satirlar={(data ?? []) as ArtiEksiSatiri[]} />
    </div>
  )
}

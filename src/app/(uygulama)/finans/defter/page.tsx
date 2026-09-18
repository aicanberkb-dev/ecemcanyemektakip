import { supabaseServer } from '@/lib/supabase/server'

import { DefterEkrani, type DefterSatiri } from './DefterEkrani'

export const metadata = { title: 'Günlük Defter — Yemek Takip' }

export default async function DefterPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('gunluk_defter')
    .select('id, yon, tarih, tutar, firma, aciklama')
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Günlük Defter</h1>
        <p className="text-sm text-solgun">
          Alışverişler, günlük gelen nakit… Her satıra firma yazabilirsin; bir kez
          yazılan firma sonra listeden seçilir. Firma özetinde her firmaya ne kadar
          artı ve eksi yazıldığı görünür; firmaya tıklayınca yalnız onun satırları kalır.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <DefterEkrani satirlar={(data ?? []) as DefterSatiri[]} />
    </div>
  )
}

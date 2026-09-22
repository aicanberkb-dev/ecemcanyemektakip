import { supabaseServer } from '@/lib/supabase/server'

import { GiderEkrani, type GiderSatiri } from './GiderEkrani'

export const metadata = { title: 'Ekrem Günlük Masraf — Yemek Takip' }

export default async function GunlukGiderPage() {
  const supabase = await supabaseServer()
  // Görünüm iki defteri birleştirir: buraya yazılan masraflar ve Tedarikçi
  // Girdi-Çıktı ekranındaki ödemeler
  const { data, error } = await supabase
    .from('masraf_defteri')
    .select('id, kaynak, tarih, tutar, masraf_noktasi, aciklama')
    .order('tarih', { ascending: false })
    .order('created_at')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Ekrem Günlük Masraf</h1>
        <p className="text-sm text-solgun">
          O gün ne harcandıysa satır satır buraya: masraf noktasını yaz (daha önce
          yazdıkların listeden gelir), tutarı gir, gerekirse açıklama ekle. Tedarikçi
          Girdi-Çıktı defterindeki <strong>ödenen</strong> satırları da bu listede
          görünür; onlar kendi ekranından düzenlenir.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <GiderEkrani satirlar={(data ?? []) as GiderSatiri[]} />
    </div>
  )
}

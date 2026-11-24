import { supabaseServer } from '@/lib/supabase/server'

import { ArtiEksiSatiri } from '../arti-eksi/ArtiEksiEkrani'

import { CumhuriyetEkrani } from './CumhuriyetEkrani'

export const metadata = { title: 'Cumhuriyet — Yemek Takip' }

/**
 * Cumhuriyet defteri: Artı/Eksi ekranının birebir aynısı, ayrı hesap.
 *
 * Aynı bileşen kullanılıyor; değişen yalnız hangi tabloya yazdığı.
 */
export default async function CumhuriyetPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('cumhuriyet')
    .select('id, yon, tarih, tutar, yontem, aciklama, created_at')
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Cumhuriyet</h1>
        <p className="text-sm text-solgun">
          Gelen ve giden paraları elle yazdığın defter. Artılardan eksiler çıkarılır,
          fark en üstte görünür. Her satırın sonundaki <strong>Kalan</strong>, o
          giriş ya da çıkış yapıldığı anda elinde kalan paradır. Eksi satırları
          günlük masrafa da yazılır. Tarih kutusu bugünle gelir, istersen değiştir.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <CumhuriyetEkrani satirlar={(data ?? []) as ArtiEksiSatiri[]} />
    </div>
  )
}

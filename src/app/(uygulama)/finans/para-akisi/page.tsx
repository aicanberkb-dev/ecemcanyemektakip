import { supabaseServer } from '@/lib/supabase/server'

import { ParaAkisiEkrani, type GunSatiri } from './ParaAkisiEkrani'

export const metadata = { title: 'Para Akışı — Yemek Takip' }

/** Takibin başladığı gün; öncesi eksik veriyle yanıltıcı olurdu */
const BASLANGIC = '2026-10-22'

/**
 * Para Akışı: giren, çıkan, birikim ve aradaki fark tek ekranda.
 *
 * Giren günlük cirodan, çıkan günlük masraftan, birikim Artı/Eksi
 * defterinden okunuyor. Üçünü çıkardıktan sonra kalan, hiçbir deftere
 * yazılmamış para demek.
 */
export default async function ParaAkisiPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('para_akisi_gunluk', { bas: BASLANGIC })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Para Akışı</h1>
        <p className="text-sm text-solgun">
          Giren para günlük cirodan, çıkan günlük masraftan, birikim Artı/Eksi
          defterinden gelir. Üçü birbirini götürdükten sonra kalan tutar hiçbir
          deftere yazılmamış paradır — küçükse yuvarlama, büyükse eksik kayıt
          demektir. Takip {BASLANGIC.split('-').reverse().join('.')} tarihinde
          başlıyor, öncesi gösterilmez.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <ParaAkisiEkrani gunler={(data ?? []) as GunSatiri[]} />
    </div>
  )
}

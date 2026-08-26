'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { GENEL, genelYolMu, OKUL_CEREZI } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Aktif okulu değiştirir. Seçim çerezde tutulur; sayfalar arası ve
 * oturumlar arası korunur. `genel` özel bir değer: okul yerine yönetim
 * ekranlarını açar.
 *
 * Geçiş sonrası sayfa da değişir. Aksi hâlde GENEL'den okula geçince URL
 * yönetim ekranında kalıyor, üst menü okul bağlantılarına dönerken alt menü
 * hâlâ maliyet sekmelerini gösteriyordu; ancak elle yenileyince düzeliyordu.
 */
export async function okulDegistir(okulId: string, mevcutYol: string) {
  if (okulId !== GENEL) {
    // Var olmayan bir okul id'si çereze yazılmasın
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from('okullar')
      .select('id')
      .eq('id', okulId)
      .maybeSingle()

    if (!data) throw new Error('Okul bulunamadı.')
  }

  const cerezler = await cookies()
  cerezler.set(OKUL_CEREZI, okulId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  revalidatePath('/', 'layout')

  // Yeni modun kapsamadığı bir sayfadaysak modun ana ekranına git.
  const genelSayfa = genelYolMu(mevcutYol)
  if (okulId === GENEL && !genelSayfa) redirect('/menu')
  if (okulId !== GENEL && genelSayfa) redirect('/pos')
}

'use server'

import { revalidatePath } from 'next/cache'

import { aktifOkulId } from '@/lib/okul'
import { telefonNormalize } from '@/lib/rehber'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Eşleşen numaraları öğrenci kayıtlarına yazar.
 *
 * Yalnızca veli telefonu **boş** olan kayıtlar doldurulur. Dolu bir numaranın
 * üzerine yazmak, rehberdeki eski bir kaydın sistemdeki doğru numarayı
 * silmesi demek olurdu; o yüzden sunucuda da kontrol ediliyor, ekrandaki
 * listeye güvenilmiyor.
 */
export async function telefonlariYaz(
  girdiler: { student_id: string; telefon: string }[],
): Promise<{ yazilan: number; atlanan: number }> {
  if (girdiler.length === 0) return { yazilan: 0, atlanan: 0 }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { data, error } = await supabase
    .from('students')
    .select('id, veli_telefon, veli2_telefon')
    .eq('okul_id', okulId)
    .in(
      'id',
      girdiler.map((g) => g.student_id),
    )

  if (error) throw new Error(error.message)

  const mevcut = new Map(
    ((data ?? []) as { id: string; veli_telefon: string | null; veli2_telefon: string | null }[])
      .map((o) => [o.id, o]),
  )

  let yazilan = 0
  let atlanan = 0

  for (const g of girdiler) {
    const o = mevcut.get(g.student_id)
    const telefon = telefonNormalize(g.telefon)
    const doluMu = Boolean(o?.veli_telefon?.trim() || o?.veli2_telefon?.trim())

    if (!o || !telefon || doluMu) {
      atlanan++
      continue
    }

    const { error: yazmaHatasi } = await supabase
      .from('students')
      .update({ veli_telefon: telefon })
      .eq('id', g.student_id)
      .eq('okul_id', okulId)

    if (yazmaHatasi) throw new Error(yazmaHatasi.message)
    yazilan++
  }

  revalidatePath('/students')
  revalidatePath('/reports/mesaj')
  return { yazilan, atlanan }
}

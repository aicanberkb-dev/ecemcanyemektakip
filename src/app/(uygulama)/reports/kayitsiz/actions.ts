'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

/**
 * Takip işaretleri.
 *
 * Yemekhane ekranını etkilemez, öğün kaydını değiştirmez: çocuk yemeği
 * yedi, o kayıt duruyor. Burada tutulan tek şey "velisiyle görüşüldü mü,
 * ücreti alındı mı" bilgisi.
 */
export async function isaretle(
  id: string,
  alan: 'veli_arandi' | 'ucret_alindi',
  deger: boolean,
) {
  const supabase = await supabaseServer()

  const { error } = await supabase.rpc('kayitsiz_ogun_isaretle', {
    p_id: id,
    p_veli_arandi: alan === 'veli_arandi' ? deger : null,
    p_ucret_alindi: alan === 'ucret_alindi' ? deger : null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/reports/kayitsiz')
}

export type AktarimSonucu = {
  hata?: string
  basari?: string
}

/**
 * Kayıtsız gelişleri öğrencinin kaydına aktarır.
 *
 * Çocuğun kaydı sonradan açılınca geldiği günler hesabına geçsin diye.
 * Öğünler o günün tarifesinden fiyatlanır; öğrencinin o gün zaten yemek
 * kaydı varsa o gün atlanır, satır yine de aktarılmış sayılır.
 */
export async function kayitsizAktar(
  studentId: string,
  ids: string[],
): Promise<AktarimSonucu> {
  if (ids.length === 0) return { hata: 'Aktarılacak gün yok.' }

  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .rpc('kayitsiz_ogun_aktar', { p_student_id: studentId, p_ids: ids })
    .maybeSingle()

  if (error) return { hata: error.message }

  const sonuc = (data ?? { eklenen: 0, atlanan: 0, aktarilan: 0 }) as {
    eklenen: number
    atlanan: number
    aktarilan: number
  }

  revalidatePath('/reports/kayitsiz')
  return {
    basari:
      `${sonuc.eklenen} güne yemek kaydı atıldı.` +
      (sonuc.atlanan > 0 ? ` ${sonuc.atlanan} günde zaten kayıt vardı.` : ''),
  }
}

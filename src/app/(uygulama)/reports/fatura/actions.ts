'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type FaturaDurumu = { hata?: string; basari?: string }

/**
 * "Bu dönem için fatura kesildi" işaretini açar ya da kaldırır.
 *
 * Tutar kesildiği anda kopyalanır: sonradan gelen tahsilat kesilmiş faturanın
 * rakamını değiştirmesin.
 */
export async function faturaKesildiDegistir(
  studentId: string,
  donemBas: string,
  donemBit: string,
  tutar: number,
  kesildi: boolean,
): Promise<FaturaDurumu> {
  const supabase = await supabaseServer()

  if (kesildi) {
    const { error } = await supabase
      .from('ogrenci_faturalari')
      .upsert(
        { student_id: studentId, donem_bas: donemBas, donem_bit: donemBit, tutar },
        { onConflict: 'student_id,donem_bas,donem_bit' },
      )
    if (error) return { hata: error.message }
  } else {
    const { error } = await supabase
      .from('ogrenci_faturalari')
      .delete()
      .eq('student_id', studentId)
      .eq('donem_bas', donemBas)
      .eq('donem_bit', donemBit)
    if (error) return { hata: error.message }
  }

  revalidatePath('/reports/fatura')
  return { basari: kesildi ? 'Kesildi olarak işaretlendi.' : 'İşaret kaldırıldı.' }
}

'use server'

import { revalidatePath } from 'next/cache'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Günün nakiti okuldan teslim alındı olarak işaretlenir.
 *
 * Tutar o anki hesaplanan nakit toplamıyla dondurulur: sonradan o güne
 * kayıt eklenirse teslim edilen para geçmişe dönük değişmesin, fark
 * raporda görünsün.
 */
export async function teslimAl(tarih: string, tutar: number) {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { error } = await supabase
    .from('kasa_teslim')
    .insert({ okul_id: okulId, tarih, tutar })

  if (error) throw new Error(error.message)
  revalidatePath('/reports/kasa')
}

/** Yanlış basılan teslim işaretini kaldırır. */
export async function teslimGeriAl(tarih: string) {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { error } = await supabase
    .from('kasa_teslim')
    .delete()
    .eq('okul_id', okulId)
    .eq('tarih', tarih)

  if (error) throw new Error(error.message)
  revalidatePath('/reports/kasa')
}

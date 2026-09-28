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

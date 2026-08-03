import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import type { Sezon } from '@/lib/types'

/** Okulun sezonları, en yenisi başta. */
export async function sezonlar(okulId: string): Promise<Sezon[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('sezonlar')
    .select('*')
    .eq('okul_id', okulId)
    .order('baslangic', { ascending: false })
  return (data ?? []) as Sezon[]
}

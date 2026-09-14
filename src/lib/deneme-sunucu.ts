import { supabaseServer } from '@/lib/supabase/server'

/**
 * Bir okulun deneme öğrencilerinin id'leri.
 *
 * Raporların çoğu veriyi özel sorgulardan (taksit durumu, devam çizelgesi,
 * gelen–giden) alıyor; o sorgulara alan eklemek yerine rapor sayfası bu
 * listeyi ayrıca çekip "Deneme" rozetini adın yanına koyuyor.
 */
export async function denemeIdleri(okulId: string): Promise<string[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('students')
    .select('id')
    .eq('okul_id', okulId)
    .eq('deneme', true)
  return ((data ?? []) as { id: string }[]).map((o) => o.id)
}

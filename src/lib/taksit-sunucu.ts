import type { TaksitBilgisi } from '@/components/TaksitRozeti'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { TaksitDurumu } from '@/lib/types'

/**
 * Bir okulun aylıkçılarının taksit durumu, öğrenci id'siyle.
 *
 * Aylıkçının bakiyesi ödeme durumunu göstermiyor; ölçü taksit planı. Bu
 * eşleme yemekhanede, öğrenci listesinde ve raporlarda aynı cevabı verebilmek
 * için tek yerde hesaplanıyor. Sezon ya da plan yoksa boş döner — çağıran
 * ekranlar bunu "taksit planı yok" olarak gösterir.
 */
export async function taksitHaritasi(
  okulId: string,
): Promise<Map<string, TaksitBilgisi>> {
  const liste = await sezonlariGetir(okulId)
  const sezon = sezonSec(liste)
  if (!sezon) return new Map()

  const supabase = await supabaseServer()
  const { data } = await supabase.rpc('taksit_durumu', { p_sezon_id: sezon.id })

  return new Map(
    ((data ?? []) as TaksitDurumu[]).map((t) => [
      t.student_id,
      {
        yillik_toplam: Number(t.yillik_toplam),
        vadesi_gelen: Number(t.vadesi_gelen),
        odenen: Number(t.odenen),
        eksik: Number(t.eksik),
        odeme_alinmali: t.odeme_alinmali,
        son_vade: t.son_vade,
        ozel_plan: t.ozel_plan,
      },
    ]),
  )
}

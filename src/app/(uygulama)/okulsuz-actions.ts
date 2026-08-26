'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type OkulsuzGun = {
  id: string
  tarih: string
  hizmet_noktasi_id: string | null
  sebep: string | null
}

export type OkulsuzDurumu = { hata?: string; basari?: string }

/**
 * Bir günü "okul yok" olarak işaretler.
 *
 * Nokta verilmezse gün tüm hizmet yerlerinde kapalı sayılır — resmi tatil
 * böyledir. Tek bir yerde gezi varsa o yerin id'si verilir. Kapalı gün ne
 * kâr/zarar tablosunda görünür ne de genel giderin bölenine girer.
 */
export async function okulYokIsaretle(
  tarih: string,
  hizmetNoktasiId: string | null,
  sebep: string | null,
): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()

  const { error } = await supabase.from('okulsuz_gunler').insert({
    tarih,
    hizmet_noktasi_id: hizmetNoktasiId,
    sebep: sebep?.trim() || null,
  })

  // Aynı gün iki kez işaretlenirse benzersiz indeks engeller; kullanıcı
  // açısından sonuç zaten istediği durum olduğu için hata gösterilmez.
  if (error && error.code !== '23505') return { hata: error.message }

  revalidatePath('/maliyet/kar-zarar')
  revalidatePath('/menu')
  return { basari: 'Gün okulsuz olarak işaretlendi.' }
}

/** İşareti kaldırır: gün yeniden normal iş günü sayılır. */
export async function okulYokKaldir(id: string): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()

  const { error } = await supabase.from('okulsuz_gunler').delete().eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/maliyet/kar-zarar')
  revalidatePath('/menu')
  return { basari: 'Gün yeniden açıldı.' }
}

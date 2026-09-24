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

/**
 * Son teslimden bu güne kadar bekleyen bütün günleri tek seferde işaretler.
 *
 * İki hafta sonra gelip biriken kasayı alınca gün gün tıklamak gerekmesin.
 * Her gün kendi tutarıyla ayrı satır olarak kaydedilir: hangi günün parası
 * ne kadardı sorusu sonradan da cevaplanabilsin.
 */
export async function teslimAlToplu(bas: string, bit: string) {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { data, error: okumaHatasi } = await supabase.rpc('kasa_raporu', {
    p_okul_id: okulId,
    p_bas: bas,
    p_bit: bit,
  })
  if (okumaHatasi) throw new Error(okumaHatasi.message)

  const satirlar = (data ?? []) as { tarih: string; nakit_toplam: number; teslim_alindi: boolean }[]
  const bekleyen = satirlar
    .filter((s) => !s.teslim_alindi && Number(s.nakit_toplam) !== 0)
    .map((s) => ({ okul_id: okulId, tarih: s.tarih, tutar: Number(s.nakit_toplam) }))

  if (bekleyen.length === 0) return 0

  const { error } = await supabase.from('kasa_teslim').insert(bekleyen)
  if (error) throw new Error(error.message)

  revalidatePath('/reports/kasa')
  return bekleyen.length
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

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { oturumZorunlu } from '@/lib/yetki'
import { trSayi } from '@/lib/zod-tr'

export type HakedisDurumu = { hata?: string; basari?: string }

/**
 * Aylıkçının aboneliğini bir tarihte kapatır.
 *
 * Kapanış gerçek tarihe yazılır — öğrencinin fiilen bıraktığı güne. Geçmişi
 * geriye çekmiyoruz: 6-20. günler arası abone olduğu doğru, o günlerin cirosu
 * yerinde kalmalı. Para iadesi ayrı bir işlem; ikisini karıştırmak "ne kadar
 * taviz verdik" bilgisini kaybettirirdi.
 */
export async function abonelikKapat(
  studentId: string,
  bitis: string,
  sebep: string | null,
): Promise<HakedisDurumu> {
  const sema = z.object({
    bitis: z.string().min(10, 'Kapanış tarihi gerekli.'),
  })
  if (!sema.safeParse({ bitis }).success) return { hata: 'Geçerli bir tarih girin.' }

  const supabase = await supabaseServer()

  const { data: donem } = await supabase
    .from('abonelik_donemleri')
    .select('id, baslangic, bitis')
    .eq('student_id', studentId)
    .eq('tip', 'aylik')
    .order('baslangic', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!donem) return { hata: 'Bu öğrencinin açık bir aylık aboneliği yok.' }
  if (bitis < donem.baslangic) {
    return { hata: 'Kapanış tarihi abonelik başlangıcından önce olamaz.' }
  }

  const { error } = await supabase
    .from('abonelik_donemleri')
    .update({ bitis, sebep: sebep?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', donem.id)

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/maliyet/kar-zarar')
  return { basari: 'Abonelik kapatıldı; bu tarihten sonra tahakkuk işlemez.' }
}

/** Kapatılan aboneliği yeniden açar — yanlışlıkla kapatıldıysa. */
export async function abonelikAc(studentId: string): Promise<HakedisDurumu> {
  const supabase = await supabaseServer()

  const { data: sezon } = await supabase
    .from('abonelik_donemleri')
    .select('id, sezon_id, sezonlar(bitis)')
    .eq('student_id', studentId)
    .eq('tip', 'aylik')
    .order('baslangic', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sezon) return { hata: 'Abonelik kaydı bulunamadı.' }

  const sezonBitis = (sezon.sezonlar as unknown as { bitis: string | null } | null)?.bitis
  const { error } = await supabase
    .from('abonelik_donemleri')
    .update({ bitis: sezonBitis, sebep: null, updated_at: new Date().toISOString() })
    .eq('id', sezon.id)

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/maliyet/kar-zarar')
  return { basari: 'Abonelik yeniden açıldı.' }
}

/**
 * Veliye para iadesi.
 *
 * Kasadan çıkan gerçek para; öğrencinin ödediğinden düşer. Ayrı bir işlem
 * tipi olarak duruyor ki "sezon boyunca ne kadar iade verdik" sorusu
 * cevaplanabilsin — negatif tahsilat yazsaydık bu bilgi kaybolurdu.
 */
export async function iadeIsle(
  studentId: string,
  _onceki: HakedisDurumu,
  formData: FormData,
): Promise<HakedisDurumu> {
  const sema = z.object({
    tutar: trSayi({ min: 0.01 }),
    tarih: z.string().min(10, 'Tarih gerekli.'),
    aciklama: z.string().trim().optional(),
  })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { hata: 'Geçerli bir tutar ve tarih girin.' }

  const oturum = await oturumZorunlu()
  const supabase = await supabaseServer()

  const { error } = await supabase.from('transactions').insert({
    student_id: studentId,
    tarih: sonuc.data.tarih,
    tip: 'iade',
    tutar: sonuc.data.tutar,
    aciklama: sonuc.data.aciklama?.trim() || 'Abonelik iadesi',
    islemi_yapan_user_id: oturum.userId,
  })

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/iadeler')
  return { basari: 'İade kaydedildi.' }
}

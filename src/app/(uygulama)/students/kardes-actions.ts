'use server'

import { revalidatePath } from 'next/cache'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

export type KardesDurumu = { hata?: string; basari?: string }

/**
 * İki öğrenciyi kardeş olarak bağlar.
 *
 * Kardeşlik ortak bir grup kimliğiyle tutulur; taraflardan biri zaten bir
 * gruptaysa diğeri o gruba katılır, ikisi de gruptaysa gruplar birleşir.
 * Böylece üç ve daha fazla kardeş de tek grupta toplanır.
 */
export async function kardesEkle(
  studentId: string,
  _onceki: KardesDurumu,
  formData: FormData,
): Promise<KardesDurumu> {
  const kardesId = String(formData.get('kardes_id') ?? '')
  if (!kardesId) return { hata: 'Kardeş olarak bağlanacak öğrenciyi seçin.' }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  // Her iki öğrenci de aktif okula ait olmalı
  const { data: ogrenciler, error: okumaHatasi } = await supabase
    .from('students')
    .select('id')
    .eq('okul_id', okulId)
    .in('id', [studentId, kardesId])

  if (okumaHatasi) return { hata: okumaHatasi.message }
  if ((ogrenciler ?? []).length !== 2) {
    return { hata: 'Öğrenciler aynı okulda değil.' }
  }

  const { error } = await supabase.rpc('kardes_bagla', {
    p_student_id: studentId,
    p_kardes_id: kardesId,
  })
  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath(`/students/${kardesId}`)
  return { basari: 'Kardeş bağlandı.' }
}

/** Öğrenciyi kardeş grubundan çıkarır. Grupta tek kişi kalırsa o da çözülür. */
export async function kardesCikar(studentId: string): Promise<KardesDurumu> {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { data: ogrenci } = await supabase
    .from('students')
    .select('id')
    .eq('okul_id', okulId)
    .eq('id', studentId)
    .maybeSingle()

  if (!ogrenci) return { hata: 'Öğrenci bulunamadı.' }

  const { error } = await supabase.rpc('kardes_ayir', { p_student_id: studentId })
  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/students')
  return { basari: 'Kardeş bağı kaldırıldı.' }
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type IslemDurumu = {
  hata?: string
  basari?: string
  alanlar?: Record<string, string>
  /** Her başarılı kayıtta değişir; geçmiş listesinin tazelenmesini tetikler */
  zaman?: number
  /**
   * Kayıt sonrası öğrencinin yeni bakiyesi.
   *
   * Ekrandaki bakiye satırı bununla güncelleniyor. Sayfayı tazelemek de
   * çalışırdı ama seçili öğrenci kayboluyor ve baştan aranması gerekiyordu.
   */
  yeniBakiye?: number
}

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {}
  for (const sorun of hata.issues) {
    const alan = String(sorun.path[0] ?? '')
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/**
 * Öğrencinin aktif okula ait olduğunu doğrular. İşlem kayıtlarında okul_id
 * yok — okul öğrenci üzerinden belirlenir, bu yüzden yazma öncesi kontrol şart.
 */
async function ogrenciOkuldaMi(studentId: string): Promise<boolean> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('okul_id', await aktifOkulId())
    .maybeSingle()
  return !!data
}

/**
 * Elle tahsilat girişi. Tahsilatın tutarı bir fiyat değil, alınan paradır —
 * bu yüzden elle girilir. islemi_yapan_user_id RLS gereği auth.uid() olmalı.
 */
export async function tahsilatEkle(
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const sema = z.object({
    student_id: z.uuid('Öğrenci seçin.'),
    tarih: z.string().min(1, 'Tarih gerekli.'),
    tutar: trSayi({ min: 0.01 }),
    aciklama: bosNull,
    // Zorunlu: tahsilatın nasıl alındığı seçilmeden kayıt açılamaz
    odeme_yontemi: z.enum(['nakit', 'havale', 'kredi_karti'], {
      error: 'Ödeme yöntemi seçin.',
    }),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  if (!(await ogrenciOkuldaMi(sonuc.data.student_id))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { hata: 'Oturum bulunamadı.' }

  const { error } = await supabase.from('transactions').insert({
    ...sonuc.data,
    tip: 'tahsilat',
    islemi_yapan_user_id: user.id,
  })

  if (error) return { hata: error.message }

  // Kayıt sonrası bakiyeyi hemen okuyup geri veriyoruz: ekrandaki "güncel
  // bakiye" satırı eski değeri göstermesin.
  const { data: bakiye } = await supabase
    .from('student_balances')
    .select('kalan')
    .eq('student_id', sonuc.data.student_id)
    .maybeSingle()

  revalidatePath('/students')
  revalidatePath(`/students/${sonuc.data.student_id}`)
  revalidatePath('/reports/tahsilat')
  revalidatePath('/dashboard')
  return {
    basari: 'Tahsilat kaydedildi.',
    zaman: Date.now(),
    yeniBakiye: bakiye ? Number(bakiye.kalan) : undefined,
  }
}

/**
 * Geçmiş işlem düzeltme. Tahsilatlarda ödeme yöntemi de değiştirilebilir.
 * Yapılan her düzeltme audit_log'a eski/yeni değeriyle yazılır.
 */
export async function islemGuncelle(
  id: string,
  studentId: string,
  _onceki: IslemDurumu,
  formData: FormData,
): Promise<IslemDurumu> {
  const sema = z.object({
    tarih: z.string().min(1, 'Tarih gerekli.'),
    tutar: trSayi({ min: 0 }),
    aciklama: bosNull,
    // Tahsilatlarda zorunlu, harcamalarda gönderilmez
    odeme_yontemi: z.enum(['nakit', 'havale', 'kredi_karti']).optional(),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  if (!(await ogrenciOkuldaMi(studentId))) {
    return { hata: 'Bu işlem seçili okula ait değil.' }
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { hata: 'Oturum bulunamadı.' }

  const { odeme_yontemi, ...alanlar } = sonuc.data

  // Kaydın tipi değişmez; ödeme yöntemi yalnızca tahsilatlarda güncellenir
  const { data: mevcut } = await supabase
    .from('transactions')
    .select('tip')
    .eq('id', id)
    .maybeSingle()

  if (!mevcut) return { hata: 'İşlem bulunamadı.' }

  const tahsilatMi = mevcut.tip === 'tahsilat'
  if (tahsilatMi && !odeme_yontemi) {
    return { alanlar: { odeme_yontemi: 'Ödeme yöntemi seçin.' } }
  }

  // RLS: düzeltmede islemi_yapan_user_id düzelten kişi olur
  const { error } = await supabase
    .from('transactions')
    .update({
      ...alanlar,
      ...(tahsilatMi ? { odeme_yontemi } : {}),
      islemi_yapan_user_id: user.id,
    })
    .eq('id', id)
    .eq('student_id', studentId)

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/tahsilat')
  revalidatePath('/reports/nakit')
  revalidatePath('/dashboard')
  return { basari: 'İşlem güncellendi.' }
}

export async function islemSil(id: string, studentId: string) {
  if (!(await ogrenciOkuldaMi(studentId))) {
    throw new Error('Bu işlem seçili okula ait değil.')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('student_id', studentId)
  if (error) throw new Error(error.message)

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/students')
  revalidatePath('/dashboard')
}

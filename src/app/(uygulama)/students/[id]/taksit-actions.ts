'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type TaksitIstisnaDurumu = {
  hata?: string
  basari?: string
  alanlar?: Record<string, string>
}

/** Öğrencinin aktif okula ait olduğunu doğrular. */
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
 * Bir taksit satırını bu öğrenciye özel hale getirir.
 * Okul planındaki değerle aynı gönderilen alan istisna sayılmaz (null bırakılır),
 * böylece o alan okul planını izlemeye devam eder.
 */
export async function ogrenciTaksitGuncelle(
  studentId: string,
  taksitPlaniId: string,
  _onceki: TaksitIstisnaDurumu,
  formData: FormData,
): Promise<TaksitIstisnaDurumu> {
  const sema = z.object({
    tutar: trSayi({ min: 0 }),
    vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
    aciklama: bosNull,
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) {
    const alanlar: Record<string, string> = {}
    for (const s of sonuc.error.issues) {
      const alan = String(s.path[0] ?? '')
      if (alan && !alanlar[alan]) alanlar[alan] = s.message
    }
    return { alanlar }
  }

  if (!(await ogrenciOkuldaMi(studentId))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()

  const { data: plan } = await supabase
    .from('taksit_plani')
    .select('tutar, vade_tarihi')
    .eq('id', taksitPlaniId)
    .maybeSingle()

  if (!plan) return { hata: 'Taksit bulunamadı.' }

  const tutarFarkli = Number(sonuc.data.tutar) !== Number(plan.tutar)
  const vadeFarkli = sonuc.data.vade_tarihi !== plan.vade_tarihi

  // İkisi de okul planıyla aynıysa istisna kaydına gerek yok
  if (!tutarFarkli && !vadeFarkli) {
    await supabase
      .from('ogrenci_taksit')
      .delete()
      .eq('student_id', studentId)
      .eq('taksit_plani_id', taksitPlaniId)

    revalidatePath(`/students/${studentId}`)
    revalidatePath('/reports/taksit')
    return { basari: 'Okul planına döndürüldü.' }
  }

  const { error } = await supabase.from('ogrenci_taksit').upsert(
    {
      student_id: studentId,
      taksit_plani_id: taksitPlaniId,
      tutar: tutarFarkli ? sonuc.data.tutar : null,
      vade_tarihi: vadeFarkli ? sonuc.data.vade_tarihi : null,
      aciklama: sonuc.data.aciklama,
    },
    { onConflict: 'student_id,taksit_plani_id' },
  )

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
  return { basari: 'Bu öğrenciye özel kaydedildi.' }
}

/** İstisnayı kaldırır; satır yeniden okul planını izler. */
export async function ogrenciTaksitVarsayilana(studentId: string, taksitPlaniId: string) {
  if (!(await ogrenciOkuldaMi(studentId))) {
    throw new Error('Öğrenci seçili okulda bulunamadı.')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('ogrenci_taksit')
    .delete()
    .eq('student_id', studentId)
    .eq('taksit_plani_id', taksitPlaniId)

  if (error) throw new Error(error.message)

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
}

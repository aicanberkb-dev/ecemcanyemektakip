'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trBoolean, trSayi } from '@/lib/zod-tr'

export type FormDurumu = {
  hata?: string
  alanlar?: Record<string, string>
}

const ogrenciSemasi = z.object({
  ogrenci_no: z.string().trim().min(1, 'Öğrenci no gerekli.'),
  ad_soyad: z.string().trim().min(2, 'Ad soyad gerekli.'),
  sinif: bosNull,
  kimlik_no: bosNull,
  veli_adi: bosNull,
  veli_telefon: bosNull,
  iskonto_orani: trSayi({ min: 0, max: 100 }),
  iskonto_tutar: trSayi({ min: 0 }),
  devir: trSayi(),
  abone_tipi: z.enum(['gunluk', 'aylik']),
  aktif: trBoolean,
})

function formuOku(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {}
  for (const sorun of hata.issues) {
    const alan = String(sorun.path[0] ?? '')
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

/** Postgres hatasını kullanıcıya gösterilebilir Türkçe mesaja çevirir. */
function hataMesaji(mesaj: string): string {
  if (mesaj.includes('students_ogrenci_no_key')) return 'Bu öğrenci numarası zaten kayıtlı.'
  if (mesaj.includes('students_kimlik_no_uniq')) return 'Bu kimlik numarası zaten kayıtlı.'
  return mesaj
}

export async function ogrenciEkle(
  _onceki: FormDurumu,
  formData: FormData,
): Promise<FormDurumu> {
  const sonuc = ogrenciSemasi.safeParse(formuOku(formData))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('students')
    .insert(sonuc.data)
    .select('id')
    .single()

  if (error) return { hata: hataMesaji(error.message) }

  revalidatePath('/students')
  redirect(`/students/${data.id}`)
}

export async function ogrenciGuncelle(
  id: string,
  _onceki: FormDurumu,
  formData: FormData,
): Promise<FormDurumu> {
  const sonuc = ogrenciSemasi.safeParse(formuOku(formData))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('students').update(sonuc.data).eq('id', id)

  if (error) return { hata: hataMesaji(error.message) }

  revalidatePath('/students')
  revalidatePath(`/students/${id}`)
  redirect(`/students/${id}`)
}

/** Öğrenci detayındaki hızlı iskonto + devir düzenlemesi */
export async function iskontoDevirGuncelle(
  id: string,
  _onceki: FormDurumu,
  formData: FormData,
): Promise<FormDurumu> {
  const sema = z.object({
    iskonto_orani: trSayi({ min: 0, max: 100 }),
    iskonto_tutar: trSayi({ min: 0 }),
    devir: trSayi(),
  })
  const sonuc = sema.safeParse(formuOku(formData))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('students').update(sonuc.data).eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath(`/students/${id}`)
  return {}
}

export async function ogrenciSil(id: string) {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/students')
  redirect('/students')
}

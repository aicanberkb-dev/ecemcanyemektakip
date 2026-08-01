'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { trSayi } from '@/lib/zod-tr'

export type AyarDurumu = {
  hata?: string
  basari?: string
  alanlar?: Record<string, string>
}

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {}
  for (const sorun of hata.issues) {
    const alan = String(sorun.path[0] ?? '')
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

export async function ucretleriGuncelle(
  id: string,
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({
    taban_gunluk_ucret: trSayi({ min: 0 }),
    ucretli_ogun_ucreti: trSayi({ min: 0 }),
    misafir_ogun_ucreti: trSayi({ min: 0 }),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('app_settings').update(sonuc.data).eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/pos')
  return { basari: 'Ücretler güncellendi.' }
}

export async function taksitEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({
    yil: trSayi({ min: 2000, max: 2100 }),
    ad: z.string().trim().min(1, 'Taksit adı gerekli.'),
    vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
    tutar: trSayi({ min: 0 }),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('taksit_plani').insert(sonuc.data)

  if (error) {
    return {
      hata: error.message.includes('taksit_plani_yil_ad_key')
        ? 'Bu yıl için aynı adda bir taksit zaten var.'
        : error.message,
    }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
  return { basari: 'Taksit eklendi.' }
}

export async function taksitGuncelle(
  id: string,
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({
    ad: z.string().trim().min(1, 'Taksit adı gerekli.'),
    vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
    tutar: trSayi({ min: 0 }),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('taksit_plani').update(sonuc.data).eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
  return { basari: 'Taksit güncellendi.' }
}

export async function taksitSil(id: string) {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('taksit_plani').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
}

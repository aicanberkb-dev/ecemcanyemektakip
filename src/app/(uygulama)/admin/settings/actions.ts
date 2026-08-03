'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
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
  // okul_id filtresi: yalnızca seçili okulun ücretleri değişebilir
  const { error } = await supabase
    .from('app_settings')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) return { hata: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/pos')
  return { basari: 'Ücretler güncellendi.' }
}

/** Okulun görünen adını değiştirir. */
export async function okulAdiGuncelle(
  okulId: string,
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({ ad: z.string().trim().min(2, 'Okul adı gerekli.') })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('okullar').update(sonuc.data).eq('id', okulId)

  if (error) {
    return {
      hata: error.message.includes('okullar_ad_key')
        ? 'Bu isimde başka bir okul var.'
        : error.message,
    }
  }

  revalidatePath('/', 'layout')
  return { basari: 'Okul adı güncellendi.' }
}

export async function taksitEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({
    sezon_id: z.uuid('Sezon seçin.'),
    ad: z.string().trim().min(1, 'Taksit adı gerekli.'),
    vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
    tutar: trSayi({ min: 0 }),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('taksit_plani')
    .insert({ ...sonuc.data, okul_id: await aktifOkulId() })

  if (error) {
    return {
      hata: error.message.includes('taksit_plani_sezon_ad_uniq')
        ? 'Bu sezonda aynı adda bir taksit zaten var.'
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
  const { error } = await supabase
    .from('taksit_plani')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) return { hata: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
  return { basari: 'Taksit güncellendi.' }
}

export async function taksitSil(id: string) {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('taksit_plani')
    .delete()
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
}

/**
 * Sezon ekler. Okul yılı takvim yılıyla örtüşmediği için taksitler yıla değil
 * sezona bağlanır; tahsilat da sezonun tarih aralığında sayılır.
 */
export async function sezonEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z
    .object({
      ad: z.string().trim().min(1, 'Sezon adı gerekli.'),
      baslangic: z.string().min(1, 'Başlangıç tarihi gerekli.'),
      bitis: z.string().min(1, 'Bitiş tarihi gerekli.'),
    })
    .refine((d) => d.bitis > d.baslangic, {
      message: 'Bitiş, başlangıçtan sonra olmalı.',
      path: ['bitis'],
    })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sezonlar')
    .insert({ ...sonuc.data, okul_id: await aktifOkulId() })

  if (error) {
    return {
      hata: error.message.includes('sezonlar_okul_ad_key')
        ? 'Bu okulda aynı adda bir sezon zaten var.'
        : error.message,
    }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
  return { basari: 'Sezon eklendi.' }
}

export async function sezonGuncelle(
  id: string,
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z
    .object({
      ad: z.string().trim().min(1, 'Sezon adı gerekli.'),
      baslangic: z.string().min(1, 'Başlangıç tarihi gerekli.'),
      bitis: z.string().min(1, 'Bitiş tarihi gerekli.'),
    })
    .refine((d) => d.bitis > d.baslangic, {
      message: 'Bitiş, başlangıçtan sonra olmalı.',
      path: ['bitis'],
    })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sezonlar')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())

  if (error) return { hata: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
  return { basari: 'Sezon güncellendi.' }
}

/** Sezonu siler; bağlı taksitler de silinir (cascade). */
export async function sezonSil(id: string) {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sezonlar')
    .delete()
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
  revalidatePath('/reports/taksit')
}

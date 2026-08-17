'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

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

/**
 * Ücret tarifeleri.
 *
 * Yeni tarife eklemek geçmişi değiştirmez: her öğün kendi tarihindeki
 * tarifeden fiyatlanır. app_settings'teki alanlar "şu an geçerli" değer
 * olarak ayrıca güncellenir; ekranlar oradan okuyor.
 */
const tarifeSemasi = z.object({
  gecerli_baslangic: z.string().min(1, 'Geçerlilik başlangıcı gerekli.'),
  taban_gunluk_ucret: trSayi({ min: 0 }),
  ucretli_ogun_ucreti: trSayi({ min: 0 }),
  misafir_ogun_ucreti: trSayi({ min: 0 }),
  aciklama: bosNull,
})

/** Bugün geçerli tarifeyi app_settings'e yansıtır (ekranlar oradan okuyor). */
async function guncelTarifeyiYansit(okulId: string) {
  const supabase = await supabaseServer()
  const bugun = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('ucret_gecmisi')
    .select('taban_gunluk_ucret, ucretli_ogun_ucreti, misafir_ogun_ucreti')
    .eq('okul_id', okulId)
    .lte('gecerli_baslangic', bugun)
    .order('gecerli_baslangic', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    await supabase.from('app_settings').update(data).eq('okul_id', okulId)
  }
}

export async function tarifeEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sonuc = tarifeSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()
  const { error } = await supabase
    .from('ucret_gecmisi')
    .insert({ ...sonuc.data, okul_id: okulId })

  if (error) {
    return {
      hata: error.message.includes('ucret_gecmisi_okul_id_gecerli_baslangic_key')
        ? 'Bu tarihte başlayan bir tarife zaten var. Mevcut satırı düzeltin.'
        : error.message,
    }
  }

  await guncelTarifeyiYansit(okulId)
  revalidatePath('/admin/settings')
  revalidatePath('/pos')
  return { basari: 'Tarife eklendi.' }
}

export async function tarifeGuncelle(
  id: string,
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sonuc = tarifeSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()
  const { error } = await supabase
    .from('ucret_gecmisi')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', okulId)

  if (error) return { hata: error.message }

  await guncelTarifeyiYansit(okulId)
  revalidatePath('/admin/settings')
  revalidatePath('/pos')
  return { basari: 'Tarife güncellendi.' }
}

export async function tarifeSil(id: string) {
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()
  const { error } = await supabase
    .from('ucret_gecmisi')
    .delete()
    .eq('id', id)
    .eq('okul_id', okulId)
  if (error) throw new Error(error.message)

  await guncelTarifeyiYansit(okulId)
  revalidatePath('/admin/settings')
  revalidatePath('/pos')
}

export async function taksitEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sema = z.object({
    sezon_id: z.uuid('Sezon seçin.'),
    ogrenci_tipi: z.enum(['standart', 'anasinifi', 'anasinifi_etut']),
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
      hata: error.message.includes('taksit_plani_sezon_tip_ad_uniq')
        ? 'Bu sezonda ve bu öğrenci tipinde aynı adda bir taksit zaten var.'
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
 * Sezon tarihleri isteğe bağlıdır. Boş bırakılırsa tahsilata hiçbir tarih
 * filtresi uygulanmaz — sezon başında veri sıfırlanarak yeniden başlandığı
 * için varsayılan kullanım budur.
 */
const sezonSemasi = z
  .object({
    ad: z.string().trim().min(1, 'Sezon adı gerekli.'),
    baslangic: bosNull,
    bitis: bosNull,
  })
  .refine((d) => !d.baslangic || !d.bitis || d.bitis > d.baslangic, {
    message: 'Bitiş, başlangıçtan sonra olmalı.',
    path: ['bitis'],
  })

export async function sezonEkle(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  const sonuc = sezonSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const { ad, baslangic, bitis } = sonuc.data

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sezonlar')
    .insert({ ad, baslangic, bitis, okul_id: await aktifOkulId() })

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
  const sonuc = sezonSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const { ad, baslangic, bitis } = sonuc.data

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sezonlar')
    .update({ ad, baslangic, bitis })
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

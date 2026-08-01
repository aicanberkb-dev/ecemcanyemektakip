'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { adminMi, oturumBilgisi } from '@/lib/yetki'

export type KullaniciDurumu = {
  hata?: string
  basari?: string
  alanlar?: Record<string, string>
}

/**
 * service_role kullanmadan önce çağıranın yetkisini doğrular.
 * Bu anahtar RLS'i tamamen atladığı için kontrol burada zorunlu.
 */
async function yetkiDogrula(): Promise<string | null> {
  const oturum = await oturumBilgisi()
  if (!oturum) return 'Oturum bulunamadı.'
  if (!adminMi(oturum)) return 'Bu işlem için yetkiniz yok.'
  return null
}

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {}
  for (const sorun of hata.issues) {
    const alan = String(sorun.path[0] ?? '')
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message
  }
  return sonuc
}

export async function kullaniciEkle(
  _onceki: KullaniciDurumu,
  formData: FormData,
): Promise<KullaniciDurumu> {
  const yetkiHatasi = await yetkiDogrula()
  if (yetkiHatasi) return { hata: yetkiHatasi }

  const sema = z.object({
    email: z.email('Geçerli bir e-posta girin.'),
    sifre: z.string().min(8, 'Şifre en az 8 karakter olmalı.'),
    ad_soyad: z.string().trim().min(2, 'Ad soyad gerekli.'),
    rol: z.enum(['admin', 'personel']),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const { email, sifre, ad_soyad, rol } = sonuc.data
  const admin = supabaseAdmin()

  const { error } = await admin.auth.admin.createUser({
    email,
    password: sifre,
    email_confirm: true,
    user_metadata: { ad_soyad, rol },
  })

  if (error) {
    return {
      hata: error.message.includes('already been registered')
        ? 'Bu e-posta zaten kayıtlı.'
        : error.message,
    }
  }

  revalidatePath('/admin/users')
  return { basari: `${ad_soyad} eklendi.` }
}

export async function rolGuncelle(
  userId: string,
  _onceki: KullaniciDurumu,
  formData: FormData,
): Promise<KullaniciDurumu> {
  const yetkiHatasi = await yetkiDogrula()
  if (yetkiHatasi) return { hata: yetkiHatasi }

  const sema = z.object({
    rol: z.enum(['admin', 'personel']),
    ad_soyad: z.string().trim().min(2, 'Ad soyad gerekli.'),
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  // profiles RLS üzerinden güncellenir; böylece audit trigger da çalışır
  const supabase = await supabaseServer()
  const { error } = await supabase.from('profiles').update(sonuc.data).eq('id', userId)
  if (error) return { hata: error.message }

  // auth metadata'yı da eşitle
  const admin = supabaseAdmin()
  await admin.auth.admin.updateUserById(userId, { user_metadata: sonuc.data })

  revalidatePath('/admin/users')
  return { basari: 'Kullanıcı güncellendi.' }
}

export async function sifreSifirla(
  userId: string,
  _onceki: KullaniciDurumu,
  formData: FormData,
): Promise<KullaniciDurumu> {
  const yetkiHatasi = await yetkiDogrula()
  if (yetkiHatasi) return { hata: yetkiHatasi }

  const sema = z.object({ sifre: z.string().min(8, 'Şifre en az 8 karakter olmalı.') })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const admin = supabaseAdmin()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: sonuc.data.sifre,
  })
  if (error) return { hata: error.message }

  return { basari: 'Şifre güncellendi.' }
}

export async function kullaniciSil(userId: string) {
  const yetkiHatasi = await yetkiDogrula()
  if (yetkiHatasi) throw new Error(yetkiHatasi)

  const oturum = await oturumBilgisi()
  if (oturum?.userId === userId) throw new Error('Kendi hesabınızı silemezsiniz.')

  const admin = supabaseAdmin()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

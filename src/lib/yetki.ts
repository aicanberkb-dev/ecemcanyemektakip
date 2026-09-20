import { cache } from 'react'

import { supabaseServer } from '@/lib/supabase/server'
import type { KullaniciRolu } from '@/lib/types'

/**
 * Rol ayrımı bayrağı. Şu an kapalı: giriş yapan herkes her şeyi yapabilir.
 * true yapıldığında admin/personel ayrımı devreye girer (RLS tarafında da
 * karşılık gelen politikalar açılmalı).
 */
export const ROL_AYRIMI_AKTIF = false

export type OturumBilgisi = {
  userId: string
  email: string | null
  adSoyad: string | null
  rol: KullaniciRolu
  /** Kullanıcı tek bir okula bağlıysa o okulun id'si, değilse null */
  okulId: string | null
}

/**
 * Kullanıcının bağlı olduğu okul — yoksa null.
 *
 * Veritabanındaki `yetkili_okul()` ile aynı kaynak: kurallar orada da aynı
 * değere bakıyor, ekranla veri katmanı ayrışmasın. `cache` sayesinde bir
 * isteğin içinde bir kez sorulur.
 */
export const kisitliOkulId = cache(async (): Promise<string | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.rpc('yetkili_okul')
  return (data as string | null) ?? null
})

/** Okula bağlı kullanıcı mı? Finans, maliyet ve ayarlar ekranları ona kapalı. */
export async function okulaBagliMi(): Promise<boolean> {
  return (await kisitliOkulId()) !== null
}

/** Oturumu ve profil bilgisini döner; oturum yoksa null. */
export async function oturumBilgisi(): Promise<OturumBilgisi | null> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profil } = await supabase
    .from('profiles')
    .select('rol, ad_soyad, okul_id')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: user.email ?? null,
    adSoyad: profil?.ad_soyad ?? null,
    rol: (profil?.rol as KullaniciRolu) ?? 'personel',
    okulId: (profil?.okul_id as string | null) ?? null,
  }
}

/** Oturum zorunlu; yoksa hata fırlatır (proxy zaten /login'e yönlendirir). */
export async function oturumZorunlu(): Promise<OturumBilgisi> {
  const oturum = await oturumBilgisi()
  if (!oturum) throw new Error('Oturum bulunamadı.')
  return oturum
}

/** Rol ayrımı kapalıyken herkes yetkilidir. */
export function adminMi(oturum: OturumBilgisi | null): boolean {
  if (!ROL_AYRIMI_AKTIF) return oturum !== null
  return oturum?.rol === 'admin'
}

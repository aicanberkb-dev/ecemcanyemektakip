'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type KartDurumu = { hata?: string; basari?: string; yazilan?: number; atlanan?: number }

/** Ekrandan gelen, aktarılacak bir harcama satırı */
export type AktarilacakSatir = {
  tarih: string
  /** `tarih/fiş/mutabakat` — mükerrer aktarımı engelleyen anahtar */
  anahtar: string
  isyeri: string
  hamAd: string
  tutar: number
}

/**
 * Ekstredeki anahtarlardan hangileri deftere girmiş?
 *
 * Aynı ekstre iki kez yüklenince satırlar ikilenmesin diye ekran bunları
 * işaretli gösteriyor ve aktarımın dışında bırakıyor.
 */
export async function girilmisAnahtarlar(anahtarlar: string[]): Promise<string[]> {
  if (anahtarlar.length === 0) return []

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('gunluk_gider')
    .select('banka_fis_no')
    .in('banka_fis_no', anahtarlar)

  return ((data ?? []) as { banka_fis_no: string | null }[])
    .map((r) => r.banka_fis_no)
    .filter((a): a is string => !!a)
}

/**
 * Kart harcamalarını günlük masraf defterine yazar.
 *
 * Masraf noktası sade ad ("HAKMAR"); açıklamaya bankanın yazdığı ham ad
 * düşüyor, hem kaynağı belli olsun hem de sonradan denetlenebilsin.
 *
 * Anahtardaki benzersiz kısıt mükerrer kaydı veritabanı seviyesinde de
 * engelliyor; ekranın kontrolü ile arada kayan bir satır olursa burada durur.
 */
export async function kartHarcamalariniAktar(
  satirlar: AktarilacakSatir[],
): Promise<KartDurumu> {
  if (satirlar.length === 0) return { hata: 'Aktarılacak satır seçilmedi.' }

  const supabase = await supabaseServer()

  const zaten = new Set(await girilmisAnahtarlar(satirlar.map((s) => s.anahtar)))
  const yazilacak = satirlar.filter((s) => !zaten.has(s.anahtar))
  const atlanan = satirlar.length - yazilacak.length

  if (yazilacak.length === 0) {
    return { basari: 'Hepsi zaten girilmişti, yeni satır yazılmadı.', yazilan: 0, atlanan }
  }

  const { error } = await supabase.from('gunluk_gider').insert(
    yazilacak.map((s) => ({
      tarih: s.tarih,
      tutar: s.tutar,
      masraf_noktasi: s.isyeri,
      aciklama: `Kredi kartı · ${s.hamAd}`,
      banka_fis_no: s.anahtar,
    })),
  )

  if (error) return { hata: error.message }

  revalidatePath('/finans/kart')
  revalidatePath('/finans/gider')

  return {
    basari:
      `${yazilacak.length} harcama günlük masrafa yazıldı` +
      (atlanan > 0 ? ` — ${atlanan} satır zaten girilmişti, atlandı.` : '.'),
    yazilan: yazilacak.length,
    atlanan,
  }
}

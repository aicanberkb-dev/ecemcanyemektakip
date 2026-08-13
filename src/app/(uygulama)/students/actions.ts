'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trBoolean, trSayi } from '@/lib/zod-tr'

export type FormDurumu = {
  hata?: string
  alanlar?: Record<string, string>
}

// ogrenci_no burada yok: numarayı sunucu atar (bkz. sonraki_ogrenci_no).
const ogrenciSemasi = z.object({
  ad_soyad: z.string().trim().min(2, 'Ad soyad gerekli.'),
  sinif: bosNull,
  kimlik_no: bosNull,
  veli_adi: bosNull,
  veli_telefon: bosNull,
  veli2_adi: bosNull,
  veli2_telefon: bosNull,
  iskonto_orani: trSayi({ min: 0, max: 100 }),
  iskonto_tutar: trSayi({ min: 0 }),
  devir: trSayi(),
  abone_tipi: z.enum(['gunluk', 'aylik']),
  // Ücretlendirme tipi: aylıkçının hangi taksit planına tabi olduğunu belirler
  ogrenci_tipi: z.enum(['standart', 'birinci_sinif', 'anasinifi', 'anasinifi_etut']),
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
  // Benzersizlik okul bazındadır: aynı numara diğer okulda kullanılabilir.
  if (mesaj.includes('students_okul_ogrenci_no_uniq'))
    return 'Bu öğrenci numarası bu okulda zaten kayıtlı.'
  if (mesaj.includes('students_okul_kimlik_no_uniq'))
    return 'Bu kimlik numarası bu okulda zaten kayıtlı.'
  return mesaj
}

export async function ogrenciEkle(
  _onceki: FormDurumu,
  formData: FormData,
): Promise<FormDurumu> {
  const sonuc = ogrenciSemasi.safeParse(formuOku(formData))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()
  const g = sonuc.data

  // Numarayı ogrenci_ekle atar: boşluk varsa doldurur, aynı anda iki kayıt
  // açılırsa çakışmayı kendi içinde çözer.
  const { data, error } = await supabase.rpc('ogrenci_ekle', {
    p_okul_id: okulId,
    p_ad_soyad: g.ad_soyad,
    p_sinif: g.sinif,
    p_kimlik_no: g.kimlik_no,
    p_veli_adi: g.veli_adi,
    p_veli_telefon: g.veli_telefon,
    p_iskonto_orani: g.iskonto_orani,
    p_iskonto_tutar: g.iskonto_tutar,
    p_devir: g.devir,
    p_abone_tipi: g.abone_tipi,
    p_aktif: g.aktif,
    p_veli2_adi: g.veli2_adi,
    p_veli2_telefon: g.veli2_telefon,
    p_ogrenci_tipi: g.ogrenci_tipi,
  })

  if (error) return { hata: hataMesaji(error.message) }

  revalidatePath('/students')
  redirect(`/students/${(data as { id: string }).id}`)
}

export async function ogrenciGuncelle(
  id: string,
  _onceki: FormDurumu,
  formData: FormData,
): Promise<FormDurumu> {
  const sonuc = ogrenciSemasi.safeParse(formuOku(formData))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  // Abone tipi değiştiyse geçmiş öğünler yeniden fiyatlandırılmalı; önce
  // eski tipi öğreniyoruz.
  const { data: onceki } = await supabase
    .from('students')
    .select('abone_tipi')
    .eq('id', id)
    .eq('okul_id', okulId)
    .maybeSingle()

  // okul_id filtresi: başka okulun kaydı elle girilen bir id ile değiştirilemesin
  const { error } = await supabase
    .from('students')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', okulId)

  if (error) return { hata: hataMesaji(error.message) }

  // Günlükçü ↔ aylıkçı geçişinde geçmiş öğün kayıtları yeni tipe göre
  // yeniden hesaplanır: aylıkçıda 0 ₺, günlükçüde güncel günlük ücret.
  // Bakiye tahsilat − harcama olduğu için borç kendiliğinden düzelir.
  if (onceki && onceki.abone_tipi !== sonuc.data.abone_tipi) {
    const { error: yenilemeHatasi } = await supabase.rpc('ogun_tutarlarini_yenile', {
      p_student_id: id,
    })
    if (yenilemeHatasi) return { hata: yenilemeHatasi.message }
  }

  revalidatePath('/students')
  revalidatePath(`/students/${id}`)
  revalidatePath('/reports')
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
  const { error } = await supabase
    .from('students')
    .update(sonuc.data)
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) return { hata: error.message }

  revalidatePath(`/students/${id}`)
  return {}
}

export async function ogrenciSil(id: string) {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)
    .eq('okul_id', await aktifOkulId())
  if (error) throw new Error(error.message)

  revalidatePath('/students')
  redirect('/students')
}

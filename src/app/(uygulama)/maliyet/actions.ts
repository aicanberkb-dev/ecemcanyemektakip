'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type MaliyetDurumu = {
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

function tazele() {
  revalidatePath('/maliyet')
  revalidatePath('/maliyet/receteler')
  revalidatePath('/maliyet/kar-zarar')
}

// ---------------------------------------------------------------------------
// Malzemeler
// ---------------------------------------------------------------------------

const malzemeSemasi = z.object({
  ad: z.string().trim().min(2, 'Malzeme adı gerekli.'),
  birim: z.enum(['kg', 'lt', 'adet']),
  birim_fiyat: trSayi({ min: 0 }),
  aciklama: bosNull,
})

export async function malzemeEkle(
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sonuc = malzemeSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('malzemeler').insert({
    ...sonuc.data,
    ad: sonuc.data.ad.toLocaleUpperCase('tr'),
  })
  if (error) {
    return {
      hata: error.code === '23505' ? 'Bu malzeme zaten var.' : error.message,
    }
  }

  tazele()
  return { basari: 'Malzeme eklendi.' }
}

export async function malzemeGuncelle(
  id: string,
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sonuc = malzemeSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('malzemeler')
    .update({ ...sonuc.data, ad: sonuc.data.ad.toLocaleUpperCase('tr') })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/** Yalnızca fiyat alanı — liste üzerinde hızlı fiyat girişi için. */
export async function malzemeFiyatiKaydet(
  id: string,
  fiyat: number,
): Promise<MaliyetDurumu> {
  if (!Number.isFinite(fiyat) || fiyat < 0) return { hata: 'Geçerli bir fiyat girin.' }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('malzemeler')
    .update({ birim_fiyat: fiyat })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fiyat güncellendi.' }
}

export async function malzemeSil(id: string): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('malzemeler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Malzeme silindi.' }
}

// ---------------------------------------------------------------------------
// Reçeteler
// ---------------------------------------------------------------------------

/**
 * Bir yemeğin bir malzemesini yazar.
 *
 * Miktar malzemenin kendi biriminde saklanır (0,08 kg = 80 g); ekran gram
 * gösterip böldüğü için burada dönüşüm yapılmaz. Sıfır miktar satırı silmek
 * demek — kullanıcı gramajı boşaltarak malzemeyi çıkarabilsin.
 */
export async function receteSatiriKaydet(
  yemekAdi: string,
  malzemeId: string,
  miktar: number,
): Promise<MaliyetDurumu> {
  const ad = yemekAdi.trim().toLocaleUpperCase('tr')
  if (!ad) return { hata: 'Yemek adı gerekli.' }
  if (!Number.isFinite(miktar) || miktar < 0) return { hata: 'Geçerli bir miktar girin.' }

  const supabase = await supabaseServer()

  if (miktar === 0) {
    const { error } = await supabase
      .from('yemek_receteleri')
      .delete()
      .eq('yemek_adi', ad)
      .eq('malzeme_id', malzemeId)
    if (error) return { hata: error.message }
    tazele()
    return { basari: 'Malzeme çıkarıldı.' }
  }

  const { error } = await supabase
    .from('yemek_receteleri')
    .upsert({ yemek_adi: ad, malzeme_id: malzemeId, miktar }, { onConflict: 'yemek_adi,malzeme_id' })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/** Bir yemeğin reçetesini tümüyle siler. */
export async function receteSil(yemekAdi: string): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('yemek_receteleri')
    .delete()
    .eq('yemek_adi', yemekAdi.trim().toLocaleUpperCase('tr'))
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Reçete silindi.' }
}

// ---------------------------------------------------------------------------
// Hizmet noktaları
// ---------------------------------------------------------------------------

const noktaSemasi = z.object({
  ad: z.string().trim().min(2, 'Yer adı gerekli.'),
  liste_id: bosNull,
  varsayilan_kisi_sayisi: trSayi({ min: 0 }),
})

export async function hizmetNoktasiEkle(
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sonuc = noktaSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { data: enBuyuk } = await supabase
    .from('hizmet_noktalari')
    .select('sira')
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('hizmet_noktalari').insert({
    ad: sonuc.data.ad.toLocaleUpperCase('tr'),
    liste_id: sonuc.data.liste_id,
    varsayilan_kisi_sayisi: Math.round(sonuc.data.varsayilan_kisi_sayisi),
    sira: (enBuyuk?.sira ?? 0) + 1,
  })
  if (error) {
    return { hata: error.code === '23505' ? 'Bu yer zaten kayıtlı.' : error.message }
  }

  tazele()
  return { basari: 'Yer eklendi.' }
}

export async function hizmetNoktasiGuncelle(
  id: string,
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sonuc = noktaSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('hizmet_noktalari')
    .update({
      ad: sonuc.data.ad.toLocaleUpperCase('tr'),
      liste_id: sonuc.data.liste_id,
      varsayilan_kisi_sayisi: Math.round(sonuc.data.varsayilan_kisi_sayisi),
    })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

export async function hizmetNoktasiSil(id: string): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('hizmet_noktalari').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Yer silindi.' }
}

// ---------------------------------------------------------------------------
// Satış fiyatları
// ---------------------------------------------------------------------------

export async function hizmetFiyatiEkle(
  noktaId: string,
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sema = z.object({
    gecerli_baslangic: z.string().min(10, 'Tarih gerekli.'),
    kisi_basi_fiyat: trSayi({ min: 0 }),
  })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('hizmet_fiyatlari')
    .upsert(
      { hizmet_noktasi_id: noktaId, ...sonuc.data },
      { onConflict: 'hizmet_noktasi_id,gecerli_baslangic' },
    )
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fiyat kaydedildi.' }
}

export async function hizmetFiyatiSil(id: string): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('hizmet_fiyatlari').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fiyat silindi.' }
}

// ---------------------------------------------------------------------------
// Günlük kişi sayıları
// ---------------------------------------------------------------------------

/**
 * Bir ayın kişi sayılarını topluca yazar.
 *
 * `null` o gün için kayıt olmadığı anlamına gelir; kâr/zarar o günü yerin
 * varsayılan kişi sayısıyla hesaplar. Açıkça yazılan 0 ise “o gün hizmet
 * verilmedi” demek — bu ikisi farklı, o yüzden boş bırakmak satırı siler,
 * 0 yazmak satırı 0 olarak kaydeder.
 */
export async function gunlukHizmetKaydet(
  noktaId: string,
  gunler: { tarih: string; kisi_sayisi: number | null }[],
): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()

  const dolu = gunler
    .filter((g) => g.kisi_sayisi !== null && Number.isFinite(g.kisi_sayisi) && g.kisi_sayisi >= 0)
    .map((g) => ({
      hizmet_noktasi_id: noktaId,
      tarih: g.tarih,
      kisi_sayisi: Math.round(g.kisi_sayisi as number),
    }))
  const bos = gunler.filter((g) => g.kisi_sayisi === null).map((g) => g.tarih)

  if (dolu.length > 0) {
    const { error } = await supabase
      .from('gunluk_hizmet')
      .upsert(dolu, { onConflict: 'hizmet_noktasi_id,tarih' })
    if (error) return { hata: error.message }
  }

  if (bos.length > 0) {
    const { error } = await supabase
      .from('gunluk_hizmet')
      .delete()
      .eq('hizmet_noktasi_id', noktaId)
      .in('tarih', bos)
    if (error) return { hata: error.message }
  }

  tazele()
  return {
    basari:
      `${dolu.length} gün kaydedildi` +
      (bos.length > 0 ? ` · ${bos.length} gün varsayılana döndü.` : '.'),
  }
}

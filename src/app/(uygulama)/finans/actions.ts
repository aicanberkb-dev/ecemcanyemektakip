'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type FinansDurumu = {
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
  revalidatePath('/finans')
  revalidatePath('/finans/alacaklar')
  revalidatePath('/finans/maaslar')
}

// ---------------------------------------------------------------------------
// Senetler
// ---------------------------------------------------------------------------

const senetSemasi = z.object({
  vade_tarihi: z.string().min(10, 'Vade tarihi gerekli.'),
  kime: z.string().trim().min(2, 'Kime ödeneceği gerekli.'),
  tutar: trSayi({ min: 0 }),
  banka: bosNull,
  senet_no: bosNull,
  aciklama: bosNull,
})

export async function senetEkle(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = senetSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('senetler').insert({
    ...sonuc.data,
    kime: sonuc.data.kime.toLocaleUpperCase('tr'),
  })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Senet eklendi.' }
}

export async function senetGuncelle(
  id: string,
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = senetSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('senetler')
    .update({ ...sonuc.data, kime: sonuc.data.kime.toLocaleUpperCase('tr') })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/** Ödendi işaretler ya da geri alır — tek düğmeyle. */
export async function senetOdemeDegistir(
  id: string,
  odemeTarihi: string | null,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('senetler')
    .update({ odeme_tarihi: odemeTarihi })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: odemeTarihi ? 'Ödendi olarak işaretlendi.' : 'Ödeme geri alındı.' }
}

export async function senetSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('senetler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Senet silindi.' }
}

// ---------------------------------------------------------------------------
// Cariler ve faturalar
// ---------------------------------------------------------------------------

export async function cariEkle(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sema = z.object({ ad: z.string().trim().min(2, 'Cari adı gerekli.') })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { data: enBuyuk } = await supabase
    .from('cariler')
    .select('sira')
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('cariler').insert({
    ad: sonuc.data.ad.toLocaleUpperCase('tr'),
    sira: (enBuyuk?.sira ?? 0) + 1,
  })
  if (error) {
    return { hata: error.code === '23505' ? 'Bu cari zaten var.' : error.message }
  }

  tazele()
  return { basari: 'Cari eklendi.' }
}

export async function cariSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('cariler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Cari silindi.' }
}

const faturaSemasi = z.object({
  cari_id: z.uuid('Cari seçin.'),
  donem_yil: trSayi({ min: 2000, max: 2100 }),
  donem_ay: trSayi({ min: 1, max: 12 }),
  adet: trSayi({ min: 0 }),
  tutar: trSayi({ min: 0 }),
  fatura_no: bosNull,
  aciklama: bosNull,
})

export async function faturaEkle(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = faturaSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('faturalar').insert({
    ...sonuc.data,
    donem_yil: Math.round(sonuc.data.donem_yil),
    donem_ay: Math.round(sonuc.data.donem_ay),
    adet: sonuc.data.adet > 0 ? Math.round(sonuc.data.adet) : null,
  })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fatura eklendi.' }
}

export async function faturaGuncelle(
  id: string,
  tutar: number,
  adet: number | null,
): Promise<FinansDurumu> {
  if (!Number.isFinite(tutar) || tutar < 0) return { hata: 'Geçerli bir tutar girin.' }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('faturalar')
    .update({ tutar, adet: adet !== null && adet > 0 ? Math.round(adet) : null })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fatura güncellendi.' }
}

export async function faturaSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('faturalar').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Fatura silindi.' }
}

/**
 * Faturaya tahsilat ekler.
 *
 * Ödeme parça parça gelebiliyor; her parça ayrı satır. Fatura tutarı dolunca
 * satır yeşile döner, eksik kalırsa ne kadar kaldığı görünür.
 */
export async function tahsilatEkle(
  faturaId: string,
  tarih: string,
  tutar: number,
): Promise<FinansDurumu> {
  if (!Number.isFinite(tutar) || tutar <= 0) return { hata: 'Geçerli bir tutar girin.' }
  if (!tarih) return { hata: 'Tahsilat tarihi gerekli.' }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('fatura_tahsilatlari')
    .insert({ fatura_id: faturaId, tarih, tutar })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Tahsilat işlendi.' }
}

export async function tahsilatSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('fatura_tahsilatlari').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Tahsilat silindi.' }
}

// ---------------------------------------------------------------------------
// Personel ve maaşlar
// ---------------------------------------------------------------------------

const personelSemasi = z.object({
  ad: z.string().trim().min(2, 'Ad gerekli.'),
  calistigi_yer: bosNull,
  sigorta_yeri: bosNull,
  maas_gunu: trSayi({ min: 1, max: 31 }),
})

export async function personelEkle(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = personelSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { data: enBuyuk } = await supabase
    .from('personeller')
    .select('sira')
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('personeller').insert({
    ...sonuc.data,
    ad: sonuc.data.ad.toLocaleUpperCase('tr'),
    maas_gunu: Math.round(sonuc.data.maas_gunu),
    sira: (enBuyuk?.sira ?? 0) + 1,
  })
  if (error) {
    return { hata: error.code === '23505' ? 'Bu isimde personel var.' : error.message }
  }

  tazele()
  return { basari: 'Personel eklendi.' }
}

export async function personelGuncelle(
  id: string,
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = personelSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('personeller')
    .update({
      ...sonuc.data,
      ad: sonuc.data.ad.toLocaleUpperCase('tr'),
      maas_gunu: Math.round(sonuc.data.maas_gunu),
    })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

export async function personelCikar(id: string, aktif: boolean): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('personeller').update({ aktif }).eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: aktif ? 'Personel aktifleştirildi.' : 'Personel listeden çıkarıldı.' }
}

/** Zam: yeni tarihten itibaren geçerli ücret. Geçmiş aylar bozulmaz. */
export async function ucretEkle(
  personelId: string,
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sema = z.object({
    gecerli_baslangic: z.string().min(10, 'Başlangıç tarihi gerekli.'),
    tutar: trSayi({ min: 0 }),
    aciklama: bosNull,
  })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('personel_ucretleri')
    .upsert(
      { personel_id: personelId, ...sonuc.data },
      { onConflict: 'personel_id,gecerli_baslangic' },
    )
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Ücret kaydedildi.' }
}

export async function ucretSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('personel_ucretleri').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Ücret satırı silindi.' }
}

/**
 * Maaşı ödendi işaretler ya da geri alır.
 *
 * Kayıt varsa ödenmiş sayılır; geri alma satırı siler. Tutar o dönemde
 * geçerli ücretten gelir ama elle değiştirilebilir (avans, eksik ödeme).
 */
export async function maasOde(
  personelId: string,
  yil: number,
  ay: number,
  tutar: number,
  odemeTarihi: string,
): Promise<FinansDurumu> {
  if (!Number.isFinite(tutar) || tutar < 0) return { hata: 'Geçerli bir tutar girin.' }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('maas_odemeleri').upsert(
    {
      personel_id: personelId,
      donem_yil: yil,
      donem_ay: ay,
      tutar,
      odeme_tarihi: odemeTarihi,
    },
    { onConflict: 'personel_id,donem_yil,donem_ay' },
  )
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Maaş ödendi olarak işaretlendi.' }
}

export async function maasGeriAl(
  personelId: string,
  yil: number,
  ay: number,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('maas_odemeleri')
    .delete()
    .eq('personel_id', personelId)
    .eq('donem_yil', yil)
    .eq('donem_ay', ay)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Ödeme geri alındı.' }
}

// ---------------------------------------------------------------------------
// SSK, vergi gibi dönemsel giderler
// ---------------------------------------------------------------------------

export async function giderKaydet(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sema = z.object({
    tur: z.string().trim().min(2, 'Gider türü gerekli.'),
    donem_yil: trSayi({ min: 2000, max: 2100 }),
    donem_ay: trSayi({ min: 1, max: 12 }),
    tutar: trSayi({ min: 0 }),
    odeme_tarihi: bosNull,
    aciklama: bosNull,
  })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('donemsel_giderler').insert({
    ...sonuc.data,
    tur: sonuc.data.tur.toLocaleUpperCase('tr'),
    donem_yil: Math.round(sonuc.data.donem_yil),
    donem_ay: Math.round(sonuc.data.donem_ay),
  })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Gider kaydedildi.' }
}

export async function giderSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('donemsel_giderler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Gider silindi.' }
}

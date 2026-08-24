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
  revalidatePath('/maliyet/giderler')
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
  varsayilan_cikan_porsiyon: trSayi({ min: 0 }),
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
    varsayilan_cikan_porsiyon: Math.round(sonuc.data.varsayilan_cikan_porsiyon),
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
      varsayilan_cikan_porsiyon: Math.round(sonuc.data.varsayilan_cikan_porsiyon),
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

const tamsayi = (d: number | null) =>
  d === null || !Number.isFinite(d) || d < 0 ? null : Math.round(d)

/**
 * Bir ayın çıkan porsiyonlarını ve faturalanan kişi sayılarını yazar.
 *
 * Porsiyon yemek bazında tutulur: aynı gün 50 kişilik ıspanak, 100 kişilik
 * tatlı çıkabiliyor. Boş bırakılan kalem yerin varsayılan porsiyonunu kullanır;
 * açıkça yazılan 0 "o kalem hiç çıkmadı" demek — bu ikisi farklı olduğu için
 * boş bırakmak satırı siler, 0 yazmak 0 olarak kaydeder.
 */
export async function gunlukHizmetKaydet(
  noktaId: string,
  gunler: { tarih: string; kisi_sayisi: number | null }[],
  cikanlar: { tarih: string; yemek_adi: string; porsiyon: number | null }[],
): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()

  // Faturalanan kişi sayıları
  const kisiDolu = []
  const kisiBos: string[] = []
  for (const g of gunler) {
    const kisi = tamsayi(g.kisi_sayisi)
    if (kisi === null) kisiBos.push(g.tarih)
    else kisiDolu.push({ hizmet_noktasi_id: noktaId, tarih: g.tarih, kisi_sayisi: kisi })
  }

  if (kisiDolu.length > 0) {
    const { error } = await supabase
      .from('gunluk_hizmet')
      .upsert(kisiDolu, { onConflict: 'hizmet_noktasi_id,tarih' })
    if (error) return { hata: error.message }
  }
  if (kisiBos.length > 0) {
    const { error } = await supabase
      .from('gunluk_hizmet')
      .delete()
      .eq('hizmet_noktasi_id', noktaId)
      .in('tarih', kisiBos)
    if (error) return { hata: error.message }
  }

  // Yemek bazlı çıkan porsiyonlar
  const cikanDolu = []
  const cikanBos: { tarih: string; yemek_adi: string }[] = []
  for (const c of cikanlar) {
    const p = tamsayi(c.porsiyon)
    if (p === null) cikanBos.push({ tarih: c.tarih, yemek_adi: c.yemek_adi })
    else
      cikanDolu.push({
        hizmet_noktasi_id: noktaId,
        tarih: c.tarih,
        yemek_adi: c.yemek_adi,
        porsiyon: p,
      })
  }

  if (cikanDolu.length > 0) {
    const { error } = await supabase
      .from('gunluk_cikan')
      .upsert(cikanDolu, { onConflict: 'hizmet_noktasi_id,tarih,yemek_adi' })
    if (error) return { hata: error.message }
  }

  // Temizlenen kalemler: tarih bazında toplayıp tek sorguda sil
  if (cikanBos.length > 0) {
    const tarihler = [...new Set(cikanBos.map((c) => c.tarih))]
    const { data: mevcut, error: okumaHatasi } = await supabase
      .from('gunluk_cikan')
      .select('id, tarih, yemek_adi')
      .eq('hizmet_noktasi_id', noktaId)
      .in('tarih', tarihler)
    if (okumaHatasi) return { hata: okumaHatasi.message }

    const silinecek = (mevcut ?? [])
      .filter((m) => cikanBos.some((c) => c.tarih === m.tarih && c.yemek_adi === m.yemek_adi))
      .map((m) => m.id)

    if (silinecek.length > 0) {
      const { error } = await supabase.from('gunluk_cikan').delete().in('id', silinecek)
      if (error) return { hata: error.message }
    }
  }

  tazele()
  return { basari: `${cikanDolu.length} porsiyon girişi kaydedildi.` }
}

// ---------------------------------------------------------------------------
// Genel giderler — yer bazlı
//
// Her hizmet yerinin kendi personeli ve kendi sabit giderleri var. Gider
// doğrudan yere yazılır, yerler arasında dağıtılmaz.
// ---------------------------------------------------------------------------

const giderSemasi = z.object({
  hizmet_noktasi_id: z.uuid('Hizmet yeri seçin.'),
  kategori: z.enum(['sgk', 'kira', 'mazot', 'maas', 'diger']),
  tur: z.string().trim().min(2, 'Gider adı gerekli.'),
  donem_yil: trSayi({ min: 2000, max: 2100 }),
  donem_ay: trSayi({ min: 1, max: 12 }),
  tutar: trSayi({ min: 0 }),
  aciklama: bosNull,
})

export async function genelGiderEkle(
  _onceki: MaliyetDurumu,
  formData: FormData,
): Promise<MaliyetDurumu> {
  const sonuc = giderSemasi.safeParse(Object.fromEntries(formData.entries()))
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

export async function genelGiderTutarKaydet(
  id: string,
  tutar: number,
): Promise<MaliyetDurumu> {
  if (!Number.isFinite(tutar) || tutar < 0) return { hata: 'Geçerli bir tutar girin.' }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('donemsel_giderler')
    .update({ tutar })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Güncellendi.' }
}

export async function genelGiderSil(id: string): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('donemsel_giderler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Gider silindi.' }
}

/**
 * Personeli bir hizmet yerine bağlar.
 *
 * Maaşın hangi yerin maliyetine gireceği buradan belli oluyor. Boş bırakılan
 * personelin maaşı hiçbir yere yazılmaz — yemekhane dışında çalışanlar için
 * doğru davranış bu.
 */
export async function personelYeriAta(
  personelId: string,
  hizmetNoktasiId: string | null,
): Promise<MaliyetDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('personeller')
    .update({ hizmet_noktasi_id: hizmetNoktasiId })
    .eq('id', personelId)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Personel yeri güncellendi.' }
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

import { ayinOdemeleriniSil, ozetiYenile } from './maaslar/ozet'

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
  revalidatePath('/finans/tahsil-edilmemis')
  revalidatePath('/maliyet/kar-zarar')
  revalidatePath('/maliyet/giderler')
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
  const sema = z.object({
    ad: z.string().trim().min(2, 'Cari adı gerekli.'),
    grup: z.enum(['adliye', 'tasimali', 'ozel_egitim', 'dis_hizmet', 'diger']),
  })
  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()

  // Sıra grup içinde anlamlı: yeni cari kendi grubunun sonuna eklenir.
  // Genel bir "en büyük sıra" kullanmak, cariyi başka grubun arasına
  // düşürüyordu.
  const { data: enBuyuk } = await supabase
    .from('cariler')
    .select('sira')
    .eq('grup', sonuc.data.grup)
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('cariler').insert({
    ad: sonuc.data.ad.toLocaleUpperCase('tr'),
    grup: sonuc.data.grup,
    sira: (enBuyuk?.sira ?? 0) + 1,
  })
  if (error) {
    return { hata: error.code === '23505' ? 'Bu cari zaten var.' : error.message }
  }

  tazele()
  return { basari: 'Cari eklendi.' }
}

/**
 * Personeli o ayın maaş listesinden çıkarır ya da geri getirir.
 *
 * Yazın personel çıkarılıyor, eylülde geri alınıyor. Personeli tamamen pasife
 * almak bunu karşılamıyor: dönünce elle aktifleştirmek ve hangi aylar
 * çalışmadığını hatırlamak gerekiyordu. Çıkarılan ayda maaşı beklenmediği
 * gibi, o yerin genel giderine de girmez.
 *
 * Ödemesi girilmiş ay çıkarılamaz: ödenmiş maaşı listeden kaldırmak kaydı
 * gizlemek olur.
 */
export async function personelAyaGizle(
  personelId: string,
  yil: number,
  ay: number,
  gizle: boolean,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  if (gizle) {
    const { data: odeme } = await supabase
      .from('maas_odemeleri')
      .select('id')
      .eq('personel_id', personelId)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
      .maybeSingle()

    if (odeme) {
      return { hata: 'Bu ay maaş ödemesi girilmiş; önce ödemeyi geri alın.' }
    }

    const { error } = await supabase
      .from('personel_gizli')
      .insert({ personel_id: personelId, donem_yil: yil, donem_ay: ay })
    if (error && error.code !== '23505') return { hata: error.message }
  } else {
    const { error } = await supabase
      .from('personel_gizli')
      .delete()
      .eq('personel_id', personelId)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
    if (error) return { hata: error.message }
  }

  tazele()
  return { basari: gizle ? 'Personel bu aydan çıkarıldı.' : 'Personel geri eklendi.' }
}

/** Var olan bir cariyi başka gruba taşır. */
export async function cariGrubuDegistir(
  id: string,
  grup: string,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  const { data: enBuyuk } = await supabase
    .from('cariler')
    .select('sira')
    .eq('grup', grup)
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from('cariler')
    .update({ grup, sira: (enBuyuk?.sira ?? 0) + 1 })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Cari grubu değiştirildi.' }
}

/**
 * Cariyi o ayın şablonundan çıkarır ya da geri getirir.
 *
 * Yazın okullar kapalı; şablonda duran boş satırlar listeyi kalabalıklaştırıp
 * gerçekten girilmesi gereken satırı gizliyordu. Cariyi pasife almak çözüm
 * değil, eylülde geri gelmesi gerekiyor — bu yüzden gizleme aya özel.
 * Faturası olan cari gizlenmez: girilmiş bir tutarı listeden kaldırmak onu
 * kaybetmek olur.
 */
export async function cariAyaGizle(
  cariId: string,
  yil: number,
  ay: number,
  gizle: boolean,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  if (gizle) {
    const { data: fatura } = await supabase
      .from('faturalar')
      .select('id')
      .eq('cari_id', cariId)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
      .maybeSingle()

    if (fatura) {
      return { hata: 'Bu ay faturası girilmiş; önce faturayı silin.' }
    }

    const { error } = await supabase
      .from('fatura_gizli')
      .insert({ cari_id: cariId, donem_yil: yil, donem_ay: ay })
    // Zaten gizliyse sonuç istenen durum; hata göstermeye gerek yok
    if (error && error.code !== '23505') return { hata: error.message }
  } else {
    const { error } = await supabase
      .from('fatura_gizli')
      .delete()
      .eq('cari_id', cariId)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
    if (error) return { hata: error.message }
  }

  tazele()
  return { basari: gizle ? 'Cari bu aydan çıkarıldı.' : 'Cari geri eklendi.' }
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

export type FaturaSatiri = {
  cari_id: string
  /** Boş bırakılan satır fatura üretmez; varsa silinir */
  adet: number | null
  tutar: number | null
}

/**
 * Bir ayın tüm carilerini tek seferde kaydeder.
 *
 * Alacaklar her ay aynı cariler için tekrarlanıyor; tek tek "fatura ekle"
 * demek ayda beş forma dönüşüyordu. Ekran artık aktif carilerin hepsini
 * satır olarak açıyor, burada toplu yazılıyor.
 *
 * Tutarı boşaltılan satırın faturası silinir — ekranda temizlemek silme
 * anlamına gelsin, ayrı bir "sil" adımı aramayalım. Tahsilatı olan fatura
 * ise silinmez: para girmiş bir faturayı sessizce yok etmek veri kaybı olur.
 */
export async function faturaSablonuKaydet(
  yil: number,
  ay: number,
  satirlar: FaturaSatiri[],
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  const yazilacak = satirlar.filter((s) => s.tutar !== null && s.tutar > 0)
  const silinecek = satirlar.filter((s) => s.tutar === null || s.tutar <= 0)

  if (yazilacak.length > 0) {
    const { error } = await supabase.from('faturalar').upsert(
      yazilacak.map((s) => ({
        cari_id: s.cari_id,
        donem_yil: Math.round(yil),
        donem_ay: Math.round(ay),
        adet: s.adet !== null && s.adet > 0 ? Math.round(s.adet) : null,
        tutar: s.tutar,
      })),
      { onConflict: 'cari_id,donem_yil,donem_ay' },
    )
    if (error) return { hata: error.message }
  }

  let korunan = 0
  if (silinecek.length > 0) {
    // Tahsilatı olan faturayı silme; kullanıcıya kaç tanesinin kaldığını söyle
    const { data: mevcut } = await supabase
      .from('faturalar')
      .select('id, cari_id, fatura_tahsilatlari(id)')
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
      .in(
        'cari_id',
        silinecek.map((s) => s.cari_id),
      )

    const guvenli = ((mevcut ?? []) as { id: string; fatura_tahsilatlari: unknown[] }[])
      .filter((f) => f.fatura_tahsilatlari.length === 0)
      .map((f) => f.id)
    korunan = (mevcut ?? []).length - guvenli.length

    if (guvenli.length > 0) {
      const { error } = await supabase.from('faturalar').delete().in('id', guvenli)
      if (error) return { hata: error.message }
    }
  }

  tazele()
  return {
    basari:
      `${yazilacak.length} cari kaydedildi.` +
      (korunan > 0 ? ` ${korunan} fatura tahsilatı olduğu için silinmedi.` : ''),
  }
}

/**
 * Faturayı elle "ödendi" işaretler ya da işareti kaldırır.
 *
 * Gelen para kuruşu kuruşuna fatura tutarını tutmayabiliyor: kesinti, banka
 * masrafı, birden fazla faturanın tek havaleyle ödenmesi. Her seferinde
 * tahsilat satırını tutturmaya çalışmak yerine fatura kapatılıyor. Gerçek
 * tahsilat toplamı ekranda kalmaya devam eder — fark saklanmaz, sadece
 * takipten düşer.
 */
export async function faturaKapat(
  id: string,
  tarih: string | null,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('faturalar').update({ kapatildi: tarih }).eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: tarih ? 'Fatura ödendi olarak işaretlendi.' : 'İşaret kaldırıldı.' }
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

/**
 * Maaş, ekranda hangi ay açıksa o ayın 1'inden itibaren geçerli olur.
 *
 * Önce ayrı bir "geçerlilik tarihi" kutusu vardı ama karışıklık yaratıyordu:
 * kullanıcı ağustosa bakarken maaşı değiştirdiğinde ağustostan itibaren
 * geçerli olmasını bekliyor. Artık kural bu; geçmiş aylar kendi ücretiyle
 * kalır, sonraki aylar yeni rakamı devralır.
 */
const maasliPersonelSemasi = personelSemasi.extend({
  maas: trSayi({ min: 0 }),
  donem_yil: trSayi({ min: 2000, max: 2100 }),
  donem_ay: trSayi({ min: 1, max: 12 }),
})

function ayinIlkGunu(yil: number, ay: number): string {
  return `${Math.round(yil)}-${String(Math.round(ay)).padStart(2, '0')}-01`
}

/**
 * Yeni personel — maaşıyla birlikte.
 *
 * Maaş ayrı bir tabloda tutuluyor (zam geçmişi bozulmasın diye), ama kayıt
 * sırasında sorulmayınca personel 0 ₺ ücretle listeye düşüyor ve maaş
 * ekranında sanki ücreti tanımsızmış gibi görünüyordu. Artık ilk ücret
 * kaydı burada açılıyor; geçerlilik tarihi personelin işe başladığı ay.
 */
export async function personelEkle(
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = maasliPersonelSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const { maas, donem_yil, donem_ay, ...personel } = sonuc.data
  const maas_baslangic = ayinIlkGunu(donem_yil, donem_ay)

  const supabase = await supabaseServer()
  const { data: enBuyuk } = await supabase
    .from('personeller')
    .select('sira')
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: yeni, error } = await supabase
    .from('personeller')
    .insert({
      ...personel,
      ad: personel.ad.toLocaleUpperCase('tr'),
      maas_gunu: Math.round(personel.maas_gunu),
      sira: (enBuyuk?.sira ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) {
    return { hata: error.code === '23505' ? 'Bu isimde personel var.' : error.message }
  }

  if (maas > 0) {
    const { error: ucretHatasi } = await supabase.from('personel_ucretleri').insert({
      personel_id: yeni.id,
      gecerli_baslangic: maas_baslangic,
      tutar: maas,
    })
    // Personel yazıldı; ücret yazılamadıysa bunu gizleme, ekrandan
    // "Zam" ile eklenebilsin diye açıkça söyle.
    if (ucretHatasi) {
      tazele()
      return {
        hata: `Personel eklendi ama maaş kaydedilemedi: ${ucretHatasi.message}. Satırdaki "Zam" ile girin.`,
      }
    }
  }

  tazele()
  return {
    basari: maas > 0 ? 'Personel ve maaşı eklendi.' : 'Personel eklendi (maaş girilmedi).',
  }
}

/**
 * Personel bilgileri ve maaşı — tek formda.
 *
 * Maaş ayrı bir "Zam" düğmesinin arkasındaydı; maaşı değiştirmek isteyen
 * kullanıcı önce Düzelt'e bakıyor, orada bulamıyordu. Artık ikisi aynı
 * yerde ve tarihe göre karar veriliyor:
 *
 * - Girilen tarihte zaten bir ücret satırı varsa o satır güncellenir
 *   (yanlış girilmiş rakamın düzeltilmesi).
 * - Yeni bir tarih girilmişse yeni satır açılır (zam); geçmiş aylar eski
 *   ücretiyle kalır.
 *
 * Tarih varsayılan olarak yürürlükteki ücretin tarihidir, yani hiçbir şey
 * değiştirmeden kaydetmek geçmişi bozmaz.
 */
export async function personelGuncelle(
  id: string,
  _onceki: FinansDurumu,
  formData: FormData,
): Promise<FinansDurumu> {
  const sonuc = maasliPersonelSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const { maas, donem_yil, donem_ay, ...personel } = sonuc.data
  const maas_baslangic = ayinIlkGunu(donem_yil, donem_ay)

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('personeller')
    .update({
      ...personel,
      ad: personel.ad.toLocaleUpperCase('tr'),
      maas_gunu: Math.round(personel.maas_gunu),
    })
    .eq('id', id)
  if (error) return { hata: error.message }

  if (maas <= 0) {
    tazele()
    return { basari: 'Kaydedildi.' }
  }

  const { data: ayniTarih } = await supabase
    .from('personel_ucretleri')
    .select('id, tutar')
    .eq('personel_id', id)
    .eq('gecerli_baslangic', maas_baslangic)
    .maybeSingle()

  if (ayniTarih) {
    if (Math.abs(Number(ayniTarih.tutar) - maas) < 0.005) {
      tazele()
      return { basari: 'Kaydedildi.' }
    }
    const { error: e } = await supabase
      .from('personel_ucretleri')
      .update({ tutar: maas })
      .eq('id', ayniTarih.id)
    if (e) return { hata: `Bilgiler kaydedildi ama maaş güncellenemedi: ${e.message}` }

    tazele()
    return { basari: 'Kaydedildi. Bu ay ve sonrası yeni maaşla hesaplanır.' }
  }

  const { error: e } = await supabase
    .from('personel_ucretleri')
    .insert({ personel_id: id, gecerli_baslangic: maas_baslangic, tutar: maas })
  if (e) return { hata: `Bilgiler kaydedildi ama maaş eklenemedi: ${e.message}` }

  tazele()
  return { basari: 'Kaydedildi. Bu ay ve sonrası yeni maaşla hesaplanır, geçmiş aylar değişmedi.' }
}

export async function personelCikar(id: string, aktif: boolean): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('personeller').update({ aktif }).eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: aktif ? 'Personel aktifleştirildi.' : 'Personel listeden çıkarıldı.' }
}

/**
 * Zam: yeni tarihten itibaren geçerli ücret. Geçmiş aylar bozulmaz.
 *
 * Her ay ücretini kendinden önce başlayan en yeni satırdan okur; yani bir
 * kez girilen rakam sonraki aylarda da geçerlidir, zam gelince o aydan
 * sonrası yeni rakama döner.
 *
 * Yeni rakam, o aydan itibaren **ödenmiş** maaş kayıtlarına da işlenir.
 * Yoksa ekranda ücret bir şey, üstteki "Ödenen" toplamı başka bir şey
 * gösteriyordu: maaşı düzeltmek toplamı düzeltmiyordu.
 */
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

  const duzelen = await odemeleriUcreteUydur(personelId, sonuc.data.gecerli_baslangic)

  tazele()
  return {
    basari:
      duzelen > 0
        ? `Ücret kaydedildi. ${duzelen} ödenmiş ay yeni rakama göre düzeltildi.`
        : 'Ücret kaydedildi.',
  }
}

/**
 * Ücret değişince, o aydan sonraki ödenmiş maaşları yeni rakama çeker.
 *
 * Ücret tek doğru kaynak: maaşı düzeltmek ekrandaki her rakamı düzeltmeli.
 * Avans ya da eksik ödeme girmek isteyen, ücreti kaydettikten sonra o ayın
 * kutusuna kendi rakamını yazar — orası yalnızca o ödemeyi değiştirir.
 */
async function odemeleriUcreteUydur(personelId: string, baslangic: string): Promise<number> {
  const supabase = await supabaseServer()

  const [{ data: ucretVeri }, { data: odemeVeri }] = await Promise.all([
    supabase
      .from('personel_ucretleri')
      .select('gecerli_baslangic, tutar')
      .eq('personel_id', personelId)
      .order('gecerli_baslangic', { ascending: false }),
    supabase
      .from('maas_odemeleri')
      .select('id, donem_yil, donem_ay, tutar')
      .eq('personel_id', personelId),
  ])

  const ucretler = ((ucretVeri ?? []) as { gecerli_baslangic: string; tutar: number | string }[])
    .map((u) => ({ baslangic: u.gecerli_baslangic, tutar: Number(u.tutar) }))
  const odemeler = (odemeVeri ?? []) as {
    id: string
    donem_yil: number
    donem_ay: number
    tutar: number | string
  }[]

  const ayBasi = baslangic.slice(0, 7)
  let duzelen = 0

  for (const o of odemeler) {
    const donem = `${o.donem_yil}-${String(o.donem_ay).padStart(2, '0')}`
    if (donem < ayBasi) continue

    const sonGun = `${donem}-${String(new Date(o.donem_yil, o.donem_ay, 0).getDate()).padStart(2, '0')}`
    const gecerli = ucretler.find((u) => u.baslangic <= sonGun)
    if (!gecerli) continue

    if (Number(o.tutar) === gecerli.tutar) continue

    const { error } = await supabase
      .from('maas_odemeleri')
      .update({ tutar: gecerli.tutar })
      .eq('id', o.id)
    if (!error) duzelen++
  }

  return duzelen
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

  // Ayın ödemeleri tek parçaya indiriliyor: bu düğme "tamamını ödedim"
  // demek. Parça parça ödeme için maasOdemeEkle kullanılıyor.
  const silmeHatasi = await ayinOdemeleriniSil(supabase, personelId, yil, ay)
  if (silmeHatasi) return { hata: silmeHatasi }

  if (tutar > 0) {
    const { data: personel } = await supabase
      .from('personeller')
      .select('ad')
      .eq('id', personelId)
      .maybeSingle()
    const ad = (personel as { ad?: string } | null)?.ad ?? 'Personel'

    // Ödenen maaş günlük masrafa da yazılıyor — ayrıca elle girmek gerekmesin.
    const { data: yeniGider, error: giderHatasi } = await supabase
      .from('gunluk_gider')
      .insert({
        tarih: odemeTarihi,
        tutar,
        masraf_noktasi: 'MAAŞ',
        aciklama: `Maaş — ${ad} · ${String(ay).padStart(2, '0')}.${yil}`,
      })
      .select('id')
      .single()
    if (giderHatasi) return { hata: giderHatasi.message }

    const { error } = await supabase.from('maas_odeme_hareketleri').insert({
      personel_id: personelId,
      donem_yil: yil,
      donem_ay: ay,
      tarih: odemeTarihi,
      tutar,
      gider_id: (yeniGider as { id: string }).id,
    })
    if (error) {
      await supabase.from('gunluk_gider').delete().eq('id', (yeniGider as { id: string }).id)
      return { hata: error.message }
    }
  }

  const ozetHatasi = await ozetiYenile(supabase, personelId, yil, ay)
  if (ozetHatasi) return { hata: ozetHatasi }

  tazele()
  return { basari: 'Maaş ödendi işaretlendi, günlük masrafa yazıldı.' }
}

export async function maasGeriAl(
  personelId: string,
  yil: number,
  ay: number,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  // Ayın bütün ödemeleri ve onlarla açılan masraf satırları kalkıyor;
  // defterde ödenmemiş bir maaşın masrafı durmasın.
  const silmeHatasi = await ayinOdemeleriniSil(supabase, personelId, yil, ay)
  if (silmeHatasi) return { hata: silmeHatasi }

  const ozetHatasi = await ozetiYenile(supabase, personelId, yil, ay)
  if (ozetHatasi) return { hata: ozetHatasi }

  tazele()
  return { basari: 'Ödeme geri alındı, masraf satırları silindi.' }
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

/**
 * SGK şablon kalemi — tutarı yaz, satır oluşsun.
 *
 * Kalemler her ay aynı (SGK ELMALI, GÖKSU, AKBABA, KONAK), o yüzden ekran
 * dördünü de açıyor ve burada upsert ediliyor. Tutar sıfırlanırsa satır
 * silinir: ekranda temizlemek "bu ay yok" demek olsun.
 */
export async function sgkKaydet(
  yil: number,
  ay: number,
  tur: string,
  tutar: number,
): Promise<FinansDurumu> {
  if (!Number.isFinite(tutar) || tutar < 0) return { hata: 'Geçerli bir tutar girin.' }

  const supabase = await supabaseServer()

  if (tutar === 0) {
    const { error } = await supabase
      .from('donemsel_giderler')
      .delete()
      .eq('tur', tur)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
      .is('hizmet_noktasi_id', null)
    if (error) return { hata: error.message }

    tazele()
    return { basari: `${tur} bu aydan kaldırıldı.` }
  }

  // Upsert kullanılamıyor: benzersiz indeks kısmi (yalnızca yer bazlı olmayan
  // satırları kapsıyor), PostgREST ise ON CONFLICT'e o koşulu ekleyemediği
  // için Postgres indeksi eşleştiremiyor ve 42P10 veriyor. Bu yüzden önce
  // bakıp sonra yazıyoruz.
  const { data: mevcut } = await supabase
    .from('donemsel_giderler')
    .select('id')
    .eq('tur', tur)
    .eq('donem_yil', yil)
    .eq('donem_ay', ay)
    .is('hizmet_noktasi_id', null)
    .maybeSingle()

  const { error } = mevcut
    ? await supabase.from('donemsel_giderler').update({ tutar }).eq('id', mevcut.id)
    : await supabase.from('donemsel_giderler').insert({
        tur,
        kategori: 'sgk',
        donem_yil: Math.round(yil),
        donem_ay: Math.round(ay),
        tutar,
      })

  if (error) return { hata: error.message }

  tazele()
  return { basari: `${tur} kaydedildi.` }
}

/**
 * SGK kalemini o ayın şablonundan çıkarır ya da geri getirir.
 *
 * Bir yerin o ay SGK'sı olmayabiliyor; satırın boş boş durması listeyi
 * kalabalıklaştırıyor. Yalnızca o dönemi etkiler. Tutarı girilmiş kalem
 * çıkarılmaz — girilmiş rakamı listeden kaldırmak onu kaybetmek olur.
 */
export async function sgkAyaGizle(
  tur: string,
  yil: number,
  ay: number,
  gizle: boolean,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()

  if (gizle) {
    const { data: mevcut } = await supabase
      .from('donemsel_giderler')
      .select('id')
      .eq('tur', tur)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
      .is('hizmet_noktasi_id', null)
      .maybeSingle()

    if (mevcut) return { hata: 'Bu ay tutarı girilmiş; önce tutarı sıfırlayın.' }

    const { error } = await supabase
      .from('sgk_gizli')
      .insert({ tur, donem_yil: yil, donem_ay: ay })
    if (error && error.code !== '23505') return { hata: error.message }
  } else {
    const { error } = await supabase
      .from('sgk_gizli')
      .delete()
      .eq('tur', tur)
      .eq('donem_yil', yil)
      .eq('donem_ay', ay)
    if (error) return { hata: error.message }
  }

  tazele()
  return { basari: gizle ? 'Kalem bu aydan çıkarıldı.' : 'Kalem geri eklendi.' }
}

/** Gideri ödendi işaretler ya da geri alır. */
export async function giderOdemeDegistir(
  id: string,
  odemeTarihi: string | null,
): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('donemsel_giderler')
    .update({ odeme_tarihi: odemeTarihi })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: odemeTarihi ? 'Ödendi olarak işaretlendi.' : 'Ödeme geri alındı.' }
}

export async function giderSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('donemsel_giderler').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Gider silindi.' }
}

// ---------------------------------------------------------------------------
// Artı / Eksi defteri
// ---------------------------------------------------------------------------

const artiEksiSemasi = z.object({
  yon: z.enum(['arti', 'eksi']),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih gerekli.'),
  tutar: trSayi({ min: 0 }).refine((t) => t > 0, 'Tutar girin.'),
  yontem: z.enum(['nakit', 'havale'], { message: 'Nakit ya da havale seçin.' }),
  aciklama: bosNull,
})

/** id verilirse satırı günceller, verilmezse yeni satır ekler. */
export async function artiEksiKaydet(
  id: string | null,
  veri: Record<string, string>,
): Promise<FinansDurumu> {
  const sonuc = artiEksiSemasi.safeParse(veri)
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = id
    ? await supabase.from('arti_eksi').update(sonuc.data).eq('id', id)
    : await supabase.from('arti_eksi').insert(sonuc.data)
  if (error) return { hata: error.message }

  revalidatePath('/finans/arti-eksi')
  return { basari: id ? 'Kaydedildi.' : 'Eklendi.' }
}

export async function artiEksiSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('arti_eksi').delete().eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/finans/arti-eksi')
  return { basari: 'Silindi.' }
}

// ---------------------------------------------------------------------------
// Günlük defter — alışverişler, günlük gelen nakit; firma bazlı
// ---------------------------------------------------------------------------

const defterSemasi = z.object({
  yon: z.enum(['arti', 'eksi']),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih gerekli.'),
  tutar: trSayi({ min: 0 }).refine((t) => t > 0, 'Tutar girin.'),
  // Aynı firma farklı yazılışla ikiye bölünmesin: boşluklar sadeleşir,
  // büyük harfe çevrilir
  firma: bosNull.transform((f) => (f ? f.replace(/\s+/g, ' ').toLocaleUpperCase('tr') : null)),
  aciklama: bosNull,
})

/** id verilirse satırı günceller, verilmezse yeni satır ekler. */
export async function defterKaydet(
  id: string | null,
  veri: Record<string, string>,
): Promise<FinansDurumu> {
  const sonuc = defterSemasi.safeParse(veri)
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = id
    ? await supabase.from('gunluk_defter').update(sonuc.data).eq('id', id)
    : await supabase.from('gunluk_defter').insert(sonuc.data)
  if (error) return { hata: error.message }

  revalidatePath('/finans/defter')
  return { basari: id ? 'Kaydedildi.' : 'Eklendi.' }
}

export async function defterSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('gunluk_defter').delete().eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/finans/defter')
  return { basari: 'Silindi.' }
}

// ---------------------------------------------------------------------------
// Günlük ciro — yer bazlı (GÖKSU, AKBABA, TORİK…)
// ---------------------------------------------------------------------------

const ciroSemasi = z.object({
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih gerekli.'),
  yer: z
    .string()
    .trim()
    .min(1, 'Yer gerekli.')
    .transform((y) => y.replace(/\s+/g, ' ').toLocaleUpperCase('tr')),
  // Hasılat nakit ve kart olarak ayrı giriliyor; toplam bunlardan çıkar,
  // ayrıca yazılmıyor ki iki rakam birbirini tutmaz hâle gelmesin.
  //
  // Boş bırakılan kutu "dokunma" demek, "sıfır" değil: kart kutusunu
  // doldurup nakit kutusunu boş bırakmak kayıtlı nakdi siliyordu.
  nakit: z.string().trim().optional(),
  // Kart = Z raporu (brüt); hesaba yatan ayrı, aradaki fark pos komisyonu
  kart: z.string().trim().optional(),
  kart_yatan: z.string().trim().optional(),
  aciklama: bosNull,
  /**
   * Kredi kartının banka kırılımı: `[["VAKIFBANK","1.200,50"], …]` JSON'u.
   * İsteğe bağlı; verilince kart tutarı buradan toplanır.
   */
  kart_kirilimi: z.string().trim().optional(),
  /** Hesaba yatanın banka kırılımı; aynı biçimde */
  kart_yatan_kirilimi: z.string().trim().optional(),
})

/** Kırılım metnini banka → tutar nesnesine çevirir; boşsa null */
function kirilimCoz(ham?: string): { kirilim: Record<string, number> | null; hata?: string } {
  if (!ham) return { kirilim: null }

  let çiftler: unknown
  try {
    çiftler = JSON.parse(ham)
  } catch {
    return { kirilim: null, hata: 'Banka kırılımı okunamadı.' }
  }
  if (!Array.isArray(çiftler)) return { kirilim: null, hata: 'Banka kırılımı okunamadı.' }

  const kirilim: Record<string, number> = {}
  for (const c of çiftler) {
    if (!Array.isArray(c) || c.length !== 2) continue
    const banka = String(c[0]).trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr')
    const tutar = Number(String(c[1]).replace(/\./g, '').replace(',', '.'))
    if (!banka) continue
    if (!Number.isFinite(tutar) || tutar < 0)
      return { kirilim: null, hata: `${banka} tutarı sayı olmalı.` }
    // Aynı banka iki kez yazılırsa toplanır; satırlardan biri sessizce düşmesin
    kirilim[banka] = (kirilim[banka] ?? 0) + tutar
  }

  return { kirilim: Object.keys(kirilim).length > 0 ? kirilim : null }
}

/**
 * Bir yerin bir günkü cirosunu yazar.
 *
 * Aynı gün ve yer için ikinci giriş öncekini günceller: aynı günü iki kez
 * girmek toplamı şişiriyordu.
 */
export async function ciroKaydet(veri: Record<string, string>): Promise<FinansDurumu> {
  const sonuc = ciroSemasi.safeParse(veri)
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const {
    kart_kirilimi: ham,
    kart_yatan_kirilimi: yatanKirilimHam,
    kart_yatan: yatanHam,
    nakit: nakitHam,
    kart: kartHam,
    ...veriler
  } = sonuc.data

  const { kirilim, hata: kirilimHatasi } = kirilimCoz(ham)
  if (kirilimHatasi) return { hata: kirilimHatasi }
  const { kirilim: yatanKirilim, hata: yatanKirilimHatasi } = kirilimCoz(yatanKirilimHam)
  if (yatanKirilimHatasi) return { hata: yatanKirilimHatasi }

  /** Boş metin null döner: "dokunma" demek, sıfır değil */
  const sayiVeya = (metin: string | undefined, ad: string) => {
    if (!metin) return { deger: null as number | null }
    const n = Number(metin.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return { hata: `${ad} tutarı sayı olmalı.` }
    return { deger: Math.round(n * 100) / 100 }
  }

  const nakitSonuc = sayiVeya(nakitHam, 'Nakit')
  if (nakitSonuc.hata) return { hata: nakitSonuc.hata }
  const kartSonuc = sayiVeya(kartHam, 'Kart')
  if (kartSonuc.hata) return { hata: kartSonuc.hata }
  const yatanSonuc = sayiVeya(yatanHam, 'Hesaba yatan')
  if (yatanSonuc.hata) return { hata: yatanSonuc.hata }

  const supabase = await supabaseServer()

  // Kayıtlı satır: boş bırakılan alanlar bundan korunuyor. Önceden boş kutu
  // sıfır yazılıyordu ve girilmiş nakit siliniyordu.
  const { data: eskiVeri } = await supabase
    .from('gunluk_ciro')
    .select('nakit, kart, kart_yatan, kart_kirilimi, kart_yatan_kirilimi')
    .eq('tarih', veriler.tarih)
    .eq('yer', veriler.yer)
    .maybeSingle()

  const eski = eskiVeri as {
    nakit: number | string
    kart: number | string
    kart_yatan: number | string | null
    kart_kirilimi: Record<string, number> | null
    kart_yatan_kirilimi: Record<string, number> | null
  } | null

  const topla = (k: Record<string, number>) =>
    Math.round(Object.values(k).reduce((t, n) => t + n, 0) * 100) / 100

  // Kırılım varsa tutar onun toplamı: kullanıcı aynı rakamı iki kez
  // yazmasın, yazarsa da ikisi birbirinden ayrı düşmesin.
  const kart = kirilim ? topla(kirilim) : (kartSonuc.deger ?? Number(eski?.kart ?? 0))
  const nakit = nakitSonuc.deger ?? Number(eski?.nakit ?? 0)
  const kartYatan = yatanKirilim
    ? topla(yatanKirilim)
    : (yatanSonuc.deger ??
      (eski?.kart_yatan === null || eski?.kart_yatan === undefined
        ? null
        : Number(eski.kart_yatan)))

  const { error } = await supabase.from('gunluk_ciro').upsert(
    {
      ...veriler,
      nakit,
      kart,
      kart_yatan: kartYatan,
      kart_kirilimi: kirilim ?? eski?.kart_kirilimi ?? null,
      kart_yatan_kirilimi: yatanKirilim ?? eski?.kart_yatan_kirilimi ?? null,
      // Ciro brütten hesaplanıyor: komisyon gider tarafında kalmalı
      tutar: Math.round((nakit + kart) * 100) / 100,
    },
    { onConflict: 'tarih,yer' },
  )
  if (error) return { hata: error.message }

  revalidatePath('/finans/ciro')
  return { basari: 'Kaydedildi.' }
}

export async function ciroSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('gunluk_ciro').delete().eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/finans/ciro')
  return { basari: 'Silindi.' }
}

// ---------------------------------------------------------------------------
// Günlük gider — gün gün serbest gider notu
// ---------------------------------------------------------------------------

const giderSemasi = z.object({
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih gerekli.'),
  tutar: trSayi({ min: 0 }),
  // Aynı yer iki türlü yazılıp listede ikiye bölünmesin
  masraf_noktasi: z
    .string()
    .trim()
    .min(1, 'Masraf noktası gerekli.')
    .transform((m) => m.replace(/\s+/g, ' ').toLocaleUpperCase('tr')),
  aciklama: bosNull,
})

/** id verilirse satırı günceller, verilmezse yeni satır ekler. */
export async function gunlukGiderKaydet(
  id: string | null,
  veri: Record<string, string>,
): Promise<FinansDurumu> {
  const sonuc = giderSemasi.safeParse(veri)
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  const supabase = await supabaseServer()
  const { error } = id
    ? await supabase.from('gunluk_gider').update(sonuc.data).eq('id', id)
    : await supabase.from('gunluk_gider').insert(sonuc.data)
  if (error) return { hata: error.message }

  revalidatePath('/finans/gider')
  return { basari: id ? 'Kaydedildi.' : 'Eklendi.' }
}

export async function gunlukGiderSil(id: string): Promise<FinansDurumu> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from('gunluk_gider').delete().eq('id', id)
  if (error) return { hata: error.message }

  revalidatePath('/finans/gider')
  return { basari: 'Silindi.' }
}

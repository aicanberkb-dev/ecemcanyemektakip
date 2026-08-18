// Veritabanı şemasının TypeScript karşılığı.
// supabase/migrations altındaki şema değişince burası da güncellenmeli.

export type AboneTipi = 'gunluk' | 'aylik'

/**
 * Öğrenci tipi.
 *
 * Tiplerin çoğu kendi taksit planına tabidir; **1. sınıf** istisnadır — ücreti
 * standartla aynıdır, ayrı bir plana ihtiyacı yoktur. Tip yine de gerekli:
 * 1. sınıflar sınıflarından toplu alınıp yoklamaları kâğıtta tutulduğu için
 * ekranlarda ayırt edilmeleri gerekiyor.
 */
export type OgrenciTipi = 'standart' | 'birinci_sinif' | 'anasinifi' | 'anasinifi_etut'

export const OGRENCI_TIPI_ADLARI: Record<OgrenciTipi, string> = {
  standart: 'Standart',
  birinci_sinif: '1. Sınıf',
  anasinifi: 'Anasınıfı',
  anasinifi_etut: 'Anasınıfı + Etüt',
}

export const OGRENCI_TIPLERI: OgrenciTipi[] = [
  'standart',
  'birinci_sinif',
  'anasinifi',
  'anasinifi_etut',
]

/** Taksit planı tanımlanan tipler — 1. sınıf standart planı kullanır. */
export const PLANLI_OGRENCI_TIPLERI: OgrenciTipi[] = [
  'standart',
  'anasinifi',
  'anasinifi_etut',
]
export type IslemTipi = 'tahsilat' | 'harcama'
export type SerbestOgunTipi = 'ucretli' | 'misafir'
export type KullaniciRolu = 'admin' | 'personel'
export type OdemeYontemi = 'nakit' | 'havale' | 'kredi_karti'

export const ODEME_YONTEMI_ADLARI: Record<OdemeYontemi, string> = {
  nakit: 'Nakit',
  havale: 'Havale / EFT',
  kredi_karti: 'Kredi Kartı',
}

export type Okul = {
  id: string
  ad: string
  sira: number
  aktif: boolean
  created_at: string
  updated_at: string
}

export type Student = {
  id: string
  okul_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kimlik_no: string | null
  veli_adi: string | null
  veli_telefon: string | null
  // Ödemeyi anne de baba da yapabiliyor; ekstre eşleştirmesi iki ada da bakar.
  veli2_adi: string | null
  veli2_telefon: string | null
  /** Aynı gruptaki öğrenciler kardeştir; null ise kardeşi tanımlı değil. */
  kardes_grup_id: string | null
  iskonto_orani: number
  iskonto_tutar: number
  devir: number
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
  aktif: boolean
  created_at: string
  updated_at: string
}

export type StudentBalance = {
  student_id: string
  okul_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kimlik_no: string | null
  veli_adi: string | null
  veli_telefon: string | null
  veli2_adi: string | null
  veli2_telefon: string | null
  /** Aynı gruptaki öğrenciler kardeştir; null ise kardeşi tanımlı değil. */
  kardes_grup_id: string | null
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
  aktif: boolean
  iskonto_orani: number
  iskonto_tutar: number
  devir: number
  alinan_para: number
  harcanan: number
  kalan: number
  ogun_sayisi: number
  gunluk_ucret: number
}

export type AppSettings = {
  id: string
  taban_gunluk_ucret: number
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  student_id: string
  tarih: string
  tip: IslemTipi
  tutar: number
  aciklama: string | null
  islemi_yapan_user_id: string
  ogun_abone_tipi: AboneTipi | null
  /** Yalnızca tahsilat kayıtlarında dolu; harcamalarda null */
  odeme_yontemi: OdemeYontemi | null
  created_at: string
}

export type SerbestOgun = {
  id: string
  tarih: string
  tip: SerbestOgunTipi
  tutar: number
  aciklama: string | null
  islemi_yapan_user_id: string
  created_at: string
}

/**
 * Dönem kabı. Tarihler isteğe bağlıdır: girilmezse hiçbir tarih filtresi
 * uygulanmaz, öğrencinin tüm tahsilatı sezona sayılır. Sezon başında veri
 * sıfırlanarak yeniden başlandığı için varsayılan kullanım budur.
 */
export type Sezon = {
  id: string
  okul_id: string
  ad: string
  baslangic: string | null
  bitis: string | null
  aktif: boolean
  created_at: string
  updated_at: string
}

/**
 * Tarihli ücret tarifesi: öğün, ait olduğu günün tarifesinden fiyatlanır.
 *
 * Tek kalem yeter — ücretli öğün taban günlük ücrete tabi, misafirden ücret
 * alınmıyor.
 */
export type UcretGecmisi = {
  id: string
  okul_id: string
  gecerli_baslangic: string
  taban_gunluk_ucret: number
  aciklama: string | null
  created_at: string
  updated_at: string
}

export type TaksitPlani = {
  id: string
  sezon_id: string
  /** Bu taksit satırı hangi öğrenci tipine ait */
  ogrenci_tipi: OgrenciTipi
  ad: string
  vade_tarihi: string
  tutar: number
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  rol: KullaniciRolu
  ad_soyad: string | null
  created_at: string
  updated_at: string
}

export type AuditLog = {
  id: string
  user_id: string | null
  tarih: string
  islem_tipi: string
  tablo_adi: string
  kayit_id: string | null
  eski_deger: Record<string, unknown> | null
  yeni_deger: Record<string, unknown> | null
}

// --- RPC dönüş tipleri ---------------------------------------------------

export type PosSonuc = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kimlik_no: string | null
  abone_tipi: AboneTipi
  kalan: number
  gunluk_ucret: number
  bugun_yedi: boolean
  tam_eslesme: boolean
}

/** Bir öğrencinin etkin taksit satırı: okul planı + varsa kişisel istisna */
export type OgrenciTaksitSatiri = {
  istisna_id: string | null
  /** null ise satır okul planında yok, yalnızca bu öğrenciye ait */
  taksit_plani_id: string | null
  ad: string
  okul_tutar: number | null
  okul_vade: string | null
  tutar: number
  vade_tarihi: string
  ozel_tutar: boolean
  ozel_vade: boolean
  /** Öğrenciye özel ek taksit (okul planında karşılığı yok) */
  ekstra: boolean
  aciklama: string | null
}

export type TaksitDurumu = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  ogrenci_tipi: OgrenciTipi
  yillik_toplam: number
  vadesi_gelen: number
  odenen: number
  eksik: number
  odeme_alinmali: boolean
  son_vade: string | null
  /** Öğrencinin okul planından sapan en az bir taksiti var */
  ozel_plan: boolean
}

export type DevamSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
  geldigi_gunler: number[]
  /** O ay tahsilat alınan günler — çizelgede işaretlenir */
  odeme_gunleri: number[]
  /** Gün numarası → o günün tahsilatı ve öncesi/sonrası bakiye */
  odeme_detay: Record<string, { tutar: number; oncesi: number; sonrasi: number }>
  geldi_sayisi: number
  gelmedi_sayisi: number
}

export type GunSonu = {
  gunlukcu: number
  aylikci: number
  ucretli: number
  misafir: number
  toplam: number
  gunlukcu_tutar: number
  ucretli_tutar: number
  misafir_tutar: number
}

export type NakitSatiri = {
  tarih: string
  nakit_tutar: number
  havale_tutar: number
  kart_tutar: number
  belirsiz_tutar: number
  tahsilat_tutar: number
  tahsilat_adet: number
  ucretli_tutar: number
  ucretli_adet: number
  toplam: number
  /** Kasaya fiilen giren para: nakit tahsilat + ücretli öğünler */
  kasa_nakit: number
}

export type GelenGidenSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
  devir: number
  donem_tahsilat: number
  donem_harcama: number
  donem_ogun: number
  guncel_kalan: number
}

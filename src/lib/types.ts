// Veritabanı şemasının TypeScript karşılığı.
// supabase/migrations altındaki şema değişince burası da güncellenmeli.

export type AboneTipi = 'gunluk' | 'aylik'
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
  iskonto_orani: number
  iskonto_tutar: number
  devir: number
  abone_tipi: AboneTipi
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
  abone_tipi: AboneTipi
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
  ucretli_ogun_ucreti: number
  misafir_ogun_ucreti: number
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

export type TaksitPlani = {
  id: string
  yil: number
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

export type TaksitDurumu = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  yillik_toplam: number
  vadesi_gelen: number
  odenen: number
  eksik: number
  odeme_alinmali: boolean
  son_vade: string | null
}

export type DevamSatiri = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  geldigi_gunler: number[]
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
  devir: number
  donem_tahsilat: number
  donem_harcama: number
  donem_ogun: number
  guncel_kalan: number
}

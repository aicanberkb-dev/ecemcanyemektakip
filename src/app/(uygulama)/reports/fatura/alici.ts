/**
 * Faturanın kime kesileceği.
 *
 * Kayıt yoksa birinci veli, o da yoksa öğrencinin kendisi — bugüne kadarki
 * davranış bu. "Diğer" seçilirse ad ve vergi bilgileri elle giriliyor;
 * dede, amca ya da bir şirkete kesilen faturalar için.
 */

export type AliciTipi = 'veli1' | 'veli2' | 'ogrenci' | 'diger'

export const ALICI_ADLARI: Record<AliciTipi, string> = {
  veli1: '1. Veli',
  veli2: '2. Veli',
  ogrenci: 'Öğrenci',
  diger: 'Başka kişi/kurum',
}

export type FaturaAlicisi = {
  tip: AliciTipi
  ad: string | null
  vergi_no: string | null
  vergi_dairesi: string | null
  adres: string | null
}

/** Alıcının faturaya yazılacak adı ve vergi numarası */
export type CozulmusAlici = {
  tip: AliciTipi
  ad: string
  vergiNo: string | null
  /** Seçilen veli anaveride boşsa uyarılsın */
  eksik: boolean
}

export function aliciCoz(
  kayit: FaturaAlicisi | null,
  ogrenci: {
    ad_soyad: string
    veli_adi: string | null
    veli_tc: string | null
    veli2_adi: string | null
    veli2_tc: string | null
    kimlik_no: string | null
  },
): CozulmusAlici {
  const tip: AliciTipi = kayit?.tip ?? (ogrenci.veli_adi ? 'veli1' : 'ogrenci')

  if (tip === 'diger') {
    return {
      tip,
      ad: kayit?.ad ?? '',
      vergiNo: kayit?.vergi_no ?? null,
      eksik: !kayit?.ad,
    }
  }

  if (tip === 'veli2') {
    return {
      tip,
      ad: ogrenci.veli2_adi ?? '',
      vergiNo: ogrenci.veli2_tc,
      eksik: !ogrenci.veli2_adi,
    }
  }

  if (tip === 'ogrenci') {
    return { tip, ad: ogrenci.ad_soyad, vergiNo: ogrenci.kimlik_no, eksik: false }
  }

  return {
    tip: 'veli1',
    ad: ogrenci.veli_adi ?? '',
    vergiNo: ogrenci.veli_tc,
    eksik: !ogrenci.veli_adi,
  }
}

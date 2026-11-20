/**
 * Banka ekstresindeki kredi kartı (POS) harcamalarını çözümler.
 *
 * Öğrenci tahsilatını okuyan `ekstre.ts` para **girişlerine** bakıyor; burası
 * tersi: kartla yapılan **çıkışlar**. Ziraat ekstresinde kart harcamasının
 * açıklaması her seferinde aynı kalıpta:
 *
 *   POS ALIŞVERİŞ [(YURTİÇİ)] KART NO: 6500 **** **** 7395
 *   İŞYERİ: HAKMAR EXP ORNEKKOY MUTABAKAT: 2747254
 *
 * İşyeri adı `İŞYERİ:` ile `MUTABAKAT:` arasından alınır.
 *
 * Bu dosya saf: ağ, veritabanı ve React yok.
 */

import { sayfaHucreleri } from './ekstre'

export type KartHarcamasi = {
  /** ISO tarih (yyyy-mm-dd) */
  tarih: string
  /**
   * Mükerrer aktarımı engelleyen benzersiz anahtar: `tarih/fiş/mutabakat`.
   *
   * Tek başına fiş numarası yetmiyor — banka onu günler arasında yeniden
   * kullanıyor (aynı ekstrede F02873 hem 13.11 hem 17.11 satırında çıktı).
   * Mutabakat numarası işlem başına tekil; tarih ve fiş de eklenerek
   * yıllar arasındaki çakışma ihtimali kapatılıyor.
   */
  anahtar: string
  /** Bankanın fiş numarası; tek başına benzersiz değil */
  fisNo: string
  /** Bankanın yazdığı hâliyle işyeri adı; kırpık ve dağınık olabilir */
  hamAd: string
  /** Deftere yazılacak sade ad: "HAKMAR EXP ORNEKKOY" → "HAKMAR" */
  isyeri: string
  kategori: Kategori
  /** Harcama tutarı, pozitif */
  tutar: number
  /** Bankanın mutabakat numarası; ayıklamada yardımcı, saklanmıyor */
  mutabakat: string
}

export const KATEGORILER = [
  'Market / gıda',
  'Akaryakıt',
  'Fırın / unlu mamul',
  'Araç',
  'Malzeme / bakım',
  'Diğer',
] as const

export type Kategori = (typeof KATEGORILER)[number]

/**
 * Banka işyeri adını kırpıyor ve aynı yeri birkaç ad altında yazıyor:
 * "HAKMAR EXP ORNEKKOY", "HAKMAR EXP YUSA / BE", "HALKODE OD/HAKMAR -"
 * hepsi Hakmar. Defterde sade ad duruyor, ham ad açıklamaya yazılıyor.
 */
const SADE_ADLAR: { desen: RegExp; ad: string }[] = [
  { desen: /HAKMAR/, ad: 'HAKMAR' },
  { desen: /^BIM|BIM AS/, ad: 'BİM' },
  { desen: /^SOK-/, ad: 'ŞOK' },
  { desen: /^A101/, ad: 'A101' },
  { desen: /PAK PETROL/, ad: 'PAK PETROL' },
  { desen: /SHELL/, ad: 'SHELL' },
  { desen: /GUZEL ENERJI/, ad: 'GÜZEL ENERJİ' },
]

/** Kategori, sade ad üzerinden değil ham ad üzerinden kestiriliyor */
const KATEGORI_DESENLERI: { desen: RegExp; kategori: Kategori }[] = [
  {
    desen:
      /HAKMAR|BIM|SOK-|A101|MOPAS|OZTEPE|OZKUL|YILANCIOGLU|MINI HAL|ONDER GIDA|YUCEL GIDA|OZTURK GIDA|KARAN MESRUBAT|ATA PEYNIR/,
    kategori: 'Market / gıda',
  },
  { desen: /PETROL|SHELL|ENERJI|ADAR|BULPET|DOCO/, kategori: 'Akaryakıt' },
  { desen: /FIRIN|EKMEK|UNLU MA|CITIRIM|BUFE/, kategori: 'Fırın / unlu mamul' },
  { desen: /OTO|SENTURK|YIKAMA|THERAPY GARAG|AKI/, kategori: 'Araç' },
  { desen: /ORMAN URUNLE|YAPI|TEMIZLIK/, kategori: 'Malzeme / bakım' },
]

/** "ODEAL//" ön eki ödeme aracısının adı, işyerinin değil */
function onEkiAt(ad: string): string {
  return ad.replace(/^ODEAL\/\//, '').trim()
}

export function sadeAd(hamAd: string): string {
  const temiz = onEkiAt(hamAd)
  const buyuk = temiz.toLocaleUpperCase('tr')
  for (const { desen, ad } of SADE_ADLAR) if (desen.test(buyuk)) return ad
  return temiz
}

export function kategoriBul(hamAd: string): Kategori {
  const buyuk = onEkiAt(hamAd).toLocaleUpperCase('tr')
  for (const { desen, kategori } of KATEGORI_DESENLERI) if (desen.test(buyuk)) return kategori
  return 'Diğer'
}

/** "28.07.2026" → "2026-07-28" */
function tarihCevir(gg: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(gg.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Ekstreden kart harcamalarını çıkarır.
 *
 * Yalnızca açıklaması POS ile başlayan ve tutarı eksi olan satırlar alınır:
 * POS iadeleri (artı tutar) harcama değildir, deftere masraf olarak düşmez.
 */
export function kartEkstresiOku(dosya: Uint8Array): KartHarcamasi[] {
  const sonuc: KartHarcamasi[] = []

  for (const h of sayfaHucreleri(dosya)) {
    if (h.length < 4) continue

    const tarih = tarihCevir(h[0] ?? '')
    if (!tarih) continue

    const aciklama = (h[2] ?? '').trim()
    if (!/^POS\b/i.test(aciklama)) continue

    const tutar = Number(h[3])
    if (!Number.isFinite(tutar) || tutar >= 0) continue

    const m = /İŞYERİ:\s*(.+?)\s*MUTABAKAT:\s*(\d+)/u.exec(aciklama)
    if (!m) continue

    const hamAd = m[1].replace(/\s+/g, ' ').trim()
    const fisNo = (h[1] ?? '').trim()
    sonuc.push({
      tarih,
      anahtar: `${tarih}/${fisNo}/${m[2]}`,
      fisNo,
      hamAd,
      isyeri: sadeAd(hamAd),
      kategori: kategoriBul(hamAd),
      tutar: Math.abs(tutar),
      mutabakat: m[2],
    })
  }

  return sonuc
}

/**
 * Ekstrede POS satırı olup da çözümlenemeyen var mı?
 *
 * Kalıp değişirse sessizce satır düşmesin; ekran bu sayıyı gösterip
 * kullanıcıyı uyarıyor.
 */
export function cozumlenemeyen(dosya: Uint8Array): number {
  let posSatiri = 0
  for (const h of sayfaHucreleri(dosya)) {
    const aciklama = (h[2] ?? '').trim()
    const tutar = Number(h[3] ?? '')
    if (/^POS\b/i.test(aciklama) && Number.isFinite(tutar) && tutar < 0) posSatiri++
  }
  return posSatiri - kartEkstresiOku(dosya).length
}

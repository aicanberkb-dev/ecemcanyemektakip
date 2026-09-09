/**
 * Sınıf/şube ile ilgili saf yardımcılar.
 *
 * `SinifSecici` bir istemci bileşeni; sunucu bileşenleri oradan fonksiyon
 * çağıramaz — çağırırsa Next.js "client function from the server" hatası verir.
 * Bu yüzden hem sunucunun hem istemcinin kullandığı saf kısım burada duruyor.
 */

/** Anasınıfı da bir "sınıf" kademesi; değer içinde bu adla saklanır. */
export const ANASINIFI = 'Anasınıfı'

export const SINIFLAR = ['1', '2', '3', '4', '5', '6', '7', '8']
export const SUBELER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/**
 * Anasınıfının üç şubesi var ve ikisinin okulda kullanılan bir adı var.
 * Listede adıyla görünmesi, kaydı alan kişinin doğru şubeyi seçmesini
 * kolaylaştırıyor; saklanan değer yine tek harf.
 */
export const ANASINIFI_SUBELERI = [
  { kod: 'A', ad: 'A - Arılar Sınıfı' },
  { kod: 'B', ad: 'B - Masal Sınıfı' },
  { kod: 'C', ad: 'C - Uğur Böcekleri Sınıfı' },
]

/** "1-A" → { sinif: '1', sube: 'A' }; tanınmayan biçim boş döner. */
export function sinifCozumle(deger: string | null | undefined): {
  sinif: string
  sube: string
} {
  const ham = (deger ?? '').trim()

  const anasinifi = new RegExp(
    `^\\s*${ANASINIFI}\\s*[-/]\\s*([A-Za-zÇĞİÖŞÜçğıöşü])\\s*$`,
    'i',
  ).exec(ham)
  if (anasinifi) return { sinif: ANASINIFI, sube: anasinifi[1].toLocaleUpperCase('tr') }

  const m = /^\s*(\d)\s*[-/]\s*([A-Za-zÇĞİÖŞÜçğıöşü])\s*$/.exec(ham)
  if (!m) return { sinif: '', sube: '' }
  return { sinif: m[1], sube: m[2].toLocaleUpperCase('tr') }
}

/**
 * 1. sınıf artık öğrenci tipinden değil, sınıf alanından anlaşılıyor: tek
 * doğru kaynak sınıf bilgisi. Yoklama kâğıdı ve rozet buna bakar.
 */
export function birinciSinifMi(sinif: string | null | undefined): boolean {
  return sinifCozumle(sinif).sinif === '1'
}

export function anasinifiMi(sinif: string | null | undefined): boolean {
  return sinifCozumle(sinif).sinif === ANASINIFI
}

/**
 * Ad benzerliği — mükerrer öğrenci kaydını yakalamak için.
 *
 * Kayıt masasında iki kişi aynı anda çalışıyor ve birbirinden habersiz aynı
 * öğrenciyi girebiliyor. Birebir aynı ad kolay yakalanır; asıl sorun birinin
 * "Zeynep Kılıç", diğerinin "Zeynep Kılınç" yazması. Bu yüzden yalnızca
 * eşitliğe değil, harf farkına da bakıyoruz.
 */

/** Türkçe harfleri sadeleştirip karşılaştırmaya hazırlar. */
export function adSadelestir(ad: string): string {
  return ad
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * İki metin arasındaki düzeltme uzaklığı (Levenshtein).
 *
 * `esik` aşıldığı anda erken çıkar: 300 öğrencilik listede tam hesap gereksiz,
 * bizi ilgilendiren yalnızca "birkaç harf farklı mı" sorusu.
 */
export function harfFarki(a: string, b: string, esik: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > esik) return esik + 1

  let onceki = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const simdiki = [i]
    let satirEnAz = i

    for (let j = 1; j <= b.length; j++) {
      const bedel = a[i - 1] === b[j - 1] ? 0 : 1
      const deger = Math.min(
        onceki[j] + 1, // silme
        simdiki[j - 1] + 1, // ekleme
        onceki[j - 1] + bedel, // değiştirme
      )
      simdiki.push(deger)
      if (deger < satirEnAz) satirEnAz = deger
    }

    // Bu satırın tamamı eşiğin üstündeyse sonuç da eşiğin üstünde olacak.
    if (satirEnAz > esik) return esik + 1
    onceki = simdiki
  }

  return onceki[b.length]
}

export type BenzerlikTuru = 'ayni' | 'benzer'

/**
 * Verilen ada benzeyen kayıtları döndürür.
 *
 * Eşik ada göre değişiyor: kısa adlarda 2 harf fark çok şey değiştirir
 * ("Ali Ak" ↔ "Ali Ok" farklı kişiler olabilir), uzun adlarda ise yazım
 * hatası olma ihtimali yüksek.
 */
export function benzerAdlar<T extends { id: string; ad_soyad: string }>(
  ad: string,
  kayitlar: T[],
  harictutId?: string,
): (T & { benzerlik: BenzerlikTuru })[] {
  const hedef = adSadelestir(ad)
  if (hedef.length < 3) return []

  const esik = hedef.length <= 10 ? 1 : 2

  const sonuc: (T & { benzerlik: BenzerlikTuru })[] = []
  for (const k of kayitlar) {
    if (harictutId && k.id === harictutId) continue

    const aday = adSadelestir(k.ad_soyad)
    if (aday === hedef) {
      sonuc.push({ ...k, benzerlik: 'ayni' })
      continue
    }
    if (harfFarki(hedef, aday, esik) <= esik) {
      sonuc.push({ ...k, benzerlik: 'benzer' })
    }
  }

  // Birebir aynı olanlar önce görünsün: en güçlü uyarı onlar.
  return sonuc.sort((a, b) => (a.benzerlik === b.benzerlik ? 0 : a.benzerlik === 'ayni' ? -1 : 1))
}

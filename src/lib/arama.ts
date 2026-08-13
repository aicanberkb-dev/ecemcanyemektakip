/**
 * Türkçe metin arama yardımcıları.
 *
 * Kullanıcı "ömer" yerine "omer", "çıtlak" yerine "citlak" yazabiliyor; arama
 * bunları da bulmalı. Bu yüzden karşılaştırma öncesi metin sadeleştirilir:
 * küçük harfe indirilir, Türkçe harfler ASCII karşılıklarına çevrilir,
 * noktalama boşluğa dönüşür.
 */

export function aramaNormalle(metin: string): string {
  return metin
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Aranan metin, hedefin herhangi bir yerinde geçiyor mu?
 *
 * Birden fazla kelime yazıldıysa hepsi geçmelidir ("berat oral" → Ömer Berat
 * Oral). Tek kelime yazıldıysa parça eşleşmesi yeterlidir ("öm", "be", "or"
 * hepsi Ömer Berat Oral'ı bulur).
 */
export function aramaEslesir(hedef: string, aranan: string): boolean {
  const a = aramaNormalle(aranan)
  if (!a) return true
  const h = aramaNormalle(hedef)
  return a.split(' ').every((parca) => h.includes(parca))
}

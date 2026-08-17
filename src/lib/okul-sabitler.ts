/**
 * Okul seçimiyle ilgili saf sabitler.
 *
 * `okul.ts` sunucu tarafında `next/headers` ve Supabase kullanıyor; proxy
 * (middleware) o modülü içe alamıyor. Ortak sabitler bu yüzden burada duruyor.
 */

export const OKUL_CEREZI = 'aktif_okul'

/**
 * Okul yerine "genel" seçilebilir: yönetimin kullandığı, okula bağlı olmayan
 * ekranlar (yemek listeleri, maliyet, kâr/zarar) oradan açılır. Yemekhane
 * personelinin bu ekranları görmesi gerekmiyor; ana menü de böylece
 * kalabalıklaşmıyor.
 */
export const GENEL = 'genel'

/** Yalnızca genel modda açılan yollar. */
export const GENEL_YOLLAR = ['/menu', '/maliyet']

export function genelYolMu(yol: string): boolean {
  return GENEL_YOLLAR.some((p) => yol === p || yol.startsWith(`${p}/`))
}

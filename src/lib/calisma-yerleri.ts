/**
 * Personelin çalıştığı yerler.
 *
 * Serbest metindi; aynı yer "GÖKSU", "Göksu yemekhane", "GÖKSU YEMEKHANE"
 * diye üç ayrı değere dağılabiliyordu ve gruplama tutmuyordu. Yerler belli,
 * o yüzden liste sabit ve buradaki sıra ekrandaki sıradır.
 *
 * Not: bu alan personelin fiziksel görev yeri. Genel giderin hangi hizmet
 * noktasına yazılacağını belirleyen `hizmet_noktasi_id` ayrı bir alandır —
 * biri kadro, diğeri maliyet dağıtımı içindir.
 */
export const CALISMA_YERLERI = [
  'ELMALI',
  'GÖKSU YEMEKHANE',
  'GÖKSU KANTİN',
  'AKBABA',
  'AHMET MİTHAT',
  'ADLİYE',
  'DİĞER',
] as const

export type CalismaYeri = (typeof CALISMA_YERLERI)[number]

/**
 * Gruplama sırası. Listede olmayan bir değer (eski serbest metin kayıtları)
 * en sona, "DİĞER" başlığının altına düşer — veri silinmez, yalnızca
 * gruplanır.
 */
export function calismaYeriSirasi(yer: string | null): number {
  const i = CALISMA_YERLERI.indexOf((yer ?? '') as CalismaYeri)
  return i === -1 ? CALISMA_YERLERI.length - 1 : i
}

/** Bir personelin hangi başlık altında listeleneceği. */
export function calismaYeriGrubu(yer: string | null): string {
  return CALISMA_YERLERI[calismaYeriSirasi(yer)]
}

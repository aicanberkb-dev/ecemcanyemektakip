/**
 * Listeye bağlı sabit kapalı gün kuralı.
 *
 * Bir listede her hafta aynı gün yemek çıkmıyorsa (GÖKSU anasınıfı etüt
 * yemeği cumaları verilmiyor) her ay tek tek kapalı gün işaretlemek yerine
 * kural listede duruyor. Alanı boş olan listeler bundan etkilenmiyor.
 *
 * Kural kayıt üretmiyor, yalnızca ekranda ve afişte gösteriliyor: gerçek
 * kapalı gün kayıtları (resmi tatil, gezi) olduğu gibi kalıyor ve onlar
 * kuralın önüne geçiyor.
 */

export type SabitKapali = {
  /** 1 pazartesi … 7 pazar (ISO) */
  haftaGunu: number
  not: string
}

export function sabitKapaliKurali(liste: {
  kapali_haftagunu?: number | null
  kapali_notu?: string | null
}): SabitKapali | null {
  if (!liste.kapali_haftagunu) return null
  return {
    haftaGunu: liste.kapali_haftagunu,
    not: liste.kapali_notu?.trim() || 'Yemek yok',
  }
}

/** Tarih bu kurala giriyor mu */
export function kuralaGiriyor(tarih: string, kural: SabitKapali | null): boolean {
  if (!kural) return false
  // getDay(): 0 pazar … 6 cumartesi. ISO'ya çeviriliyor.
  const g = new Date(`${tarih}T00:00:00`).getDay()
  return (g === 0 ? 7 : g) === kural.haftaGunu
}

/**
 * Ayın kurala giren günlerini kapalı gün haritasına ekler.
 *
 * Gerçek kayıt varsa ona dokunulmuyor: resmi tatilin sebebi kuralın notuyla
 * değiştirilmemeli.
 */
export function kuralliKapaliGunler(
  yil: number,
  ay: number,
  kural: SabitKapali | null,
  kapali: Map<string, string | null>,
): Map<string, string | null> {
  if (!kural) return kapali
  const sonuc = new Map(kapali)
  const gunSayisi = new Date(yil, ay, 0).getDate()
  for (let g = 1; g <= gunSayisi; g++) {
    const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
    if (sonuc.has(tarih) || !kuralaGiriyor(tarih, kural)) continue
    sonuc.set(tarih, kural.not)
  }
  return sonuc
}

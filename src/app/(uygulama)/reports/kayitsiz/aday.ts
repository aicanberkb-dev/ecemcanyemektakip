import { adSadelestir, harfFarki } from '@/lib/ad-benzerlik'

/**
 * Kayıtsız gelişteki ada uyan öğrenci adayları.
 *
 * Ad yemekhanede elle yazılıyor: harf hatası, eksik soyadı, ters sıra
 * olağan. Bu yüzden üç yoldan bakılıyor ve hangisinden geldiği kullanıcıya
 * söyleniyor — neye güveneceğine kendisi karar versin.
 */
export type AdayOgrenci = {
  id: string
  ad_soyad: string
  sinif: string | null
  /** birebir: aynı ad · benzer: birkaç harf fark · parca: adın parçaları geçiyor */
  tur: 'birebir' | 'benzer' | 'parca'
}

type Ogrenci = { id: string; ad_soyad: string; sinif: string | null }

/** Anlamlı ad parçaları; tek harflik gürültü atılır */
function parcalar(ad: string): string[] {
  return adSadelestir(ad)
    .split(' ')
    .filter((p) => p.length > 1)
}

export function adaylar(ad: string, ogrenciler: Ogrenci[]): AdayOgrenci[] {
  const hedef = adSadelestir(ad)
  if (hedef.length < 3) return []

  // Kısa adda iki harf fark başka bir çocuk olabilir, uzun adda yazım hatası
  const esik = hedef.length <= 10 ? 1 : 2
  const hedefParcalari = parcalar(ad)

  const sonuc: AdayOgrenci[] = []

  for (const o of ogrenciler) {
    const aday = adSadelestir(o.ad_soyad)
    const temel = { id: o.id, ad_soyad: o.ad_soyad, sinif: o.sinif }

    if (aday === hedef) {
      sonuc.push({ ...temel, tur: 'birebir' })
      continue
    }

    if (harfFarki(hedef, aday, esik) <= esik) {
      sonuc.push({ ...temel, tur: 'benzer' })
      continue
    }

    // "mehmet kaya" ⊂ "mehmet ali kaya" ya da yalnızca "mehmet" yazılmışsa
    const adayParcalari = new Set(parcalar(o.ad_soyad))
    if (
      hedefParcalari.length > 0 &&
      hedefParcalari.every((p) => adayParcalari.has(p) || [...adayParcalari].some((a) => harfFarki(p, a, 1) <= 1))
    ) {
      sonuc.push({ ...temel, tur: 'parca' })
    }
  }

  const sira = { birebir: 0, benzer: 1, parca: 2 }
  return sonuc
    .sort((a, b) => sira[a.tur] - sira[b.tur] || a.ad_soyad.localeCompare(b.ad_soyad, 'tr'))
    .slice(0, 8)
}

export const ADAY_ETIKETI: Record<AdayOgrenci['tur'], string> = {
  birebir: 'birebir aynı',
  benzer: 'benzer yazım',
  parca: 'adı içeriyor',
}

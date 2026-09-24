import { aramaNormalle } from '@/lib/arama'
import { telefonNormalize } from '@/lib/rehber'

/**
 * Telefon rehberi dosyasından okunan kişi.
 *
 * Rehber dışa aktarımı iki biçimde geliyor: telefonun paylaştığı vCard (.vcf)
 * ve Google Kişiler'in CSV'si. İkisi de ad ve numara veriyor, gerisi bizim
 * işimize yaramıyor.
 */
export type RehberKaydi = { ad: string; telefon: string }

/** Ad eşleşmesinin nereden geldiği — kullanıcı neye güveneceğini bilsin. */
export type EslesmeSebebi = 'ogrenci' | 'veli' | 'soyad'

export type Eslesme = {
  student_id: string
  ogrenci: string
  veli: string | null
  sinif: string | null
  /** Rehberdeki kişi adı, olduğu gibi */
  rehberAdi: string
  telefon: string
  sebep: EslesmeSebebi
  /** Aynı öğrenciye birden fazla kişi uyduysa ayırt edilmesi gerekir */
  rakipVar: boolean
}

export type EslestirmeGirdisi = {
  student_id: string
  ad_soyad: string
  veli_adi: string | null
  sinif: string | null
}

/** Ad parçaları: tek harflik gürültü atılır ("A.", "-") */
function parcalar(ad: string): string[] {
  return aramaNormalle(ad)
    .split(' ')
    .filter((p) => p.length > 1)
}

/** Soyad: son anlamlı parça */
function soyad(ad: string): string | null {
  const p = parcalar(ad)
  return p.length >= 2 ? p[p.length - 1] : null
}

/** Bütün parçaları hedefte geçiyor mu? "fatma gugu" ⊂ "fatma uludan gugu" */
function hepsiGeciyor(ad: string, hedefParcalari: Set<string>): boolean {
  const p = parcalar(ad)
  return p.length > 0 && p.every((x) => hedefParcalari.has(x))
}

/**
 * vCard metnini kişi listesine çevirir.
 *
 * Yalnızca FN (görünen ad) ve TEL alanları okunur. Bir kişide birden çok
 * numara varsa ilk geçerli cep numarası alınır: sabit hat WhatsApp'ta
 * işe yaramıyor, telefonNormalize zaten onları eliyor.
 */
export function vcardOku(metin: string): RehberKaydi[] {
  const kayitlar: RehberKaydi[] = []
  // Satır kaydırma: vCard uzun satırı boşlukla başlayan satıra taşır
  const duz = metin.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')

  for (const blok of duz.split(/BEGIN:VCARD/i).slice(1)) {
    const adEsl = blok.match(/^FN[^:\n]*:(.*)$/im)
    if (!adEsl) continue
    const ad = adEsl[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';')
    if (!ad) continue

    for (const tel of blok.matchAll(/^TEL[^:\n]*:(.*)$/gim)) {
      const numara = telefonNormalize(tel[1])
      if (numara) {
        kayitlar.push({ ad, telefon: numara })
        break
      }
    }
  }
  return kayitlar
}

/** CSV satırını virgüle göre böler; tırnak içindeki virgülü korur. */
function csvSatirBol(satir: string): string[] {
  const hucreler: string[] = []
  let suanki = ''
  let tirnakta = false

  for (let i = 0; i < satir.length; i++) {
    const k = satir[i]
    if (k === '"') {
      if (tirnakta && satir[i + 1] === '"') {
        suanki += '"'
        i++
      } else {
        tirnakta = !tirnakta
      }
    } else if (k === ',' && !tirnakta) {
      hucreler.push(suanki)
      suanki = ''
    } else {
      suanki += k
    }
  }
  hucreler.push(suanki)
  return hucreler
}

/**
 * Google Kişiler CSV'si. Başlıklar sürüme göre değişiyor, bu yüzden
 * sütunlar ada göre aranıyor: ad için "Name" / "First Name", numara için
 * "Phone ... Value".
 */
export function csvOku(metin: string): RehberKaydi[] {
  const satirlar = metin.split(/\r?\n/).filter((s) => s.trim() !== '')
  if (satirlar.length < 2) return []

  const basliklar = csvSatirBol(satirlar[0]).map((b) => b.trim().toLowerCase())
  const adIdx = basliklar.findIndex((b) => b === 'name' || b === 'display name')
  const adIdx1 = basliklar.findIndex((b) => b === 'first name' || b === 'given name')
  const adIdx2 = basliklar.findIndex((b) => b === 'last name' || b === 'family name')
  const telIdxler = basliklar
    .map((b, i) => (b.startsWith('phone') && b.includes('value') ? i : -1))
    .filter((i) => i >= 0)

  if (telIdxler.length === 0) return []

  const kayitlar: RehberKaydi[] = []
  for (const satir of satirlar.slice(1)) {
    const h = csvSatirBol(satir)
    const ad =
      (adIdx >= 0 ? h[adIdx] : '') ||
      [adIdx1 >= 0 ? h[adIdx1] : '', adIdx2 >= 0 ? h[adIdx2] : ''].filter(Boolean).join(' ')
    if (!ad?.trim()) continue

    for (const i of telIdxler) {
      // Bir hücrede ":::" ile ayrılmış birden çok numara olabiliyor
      const ilk = (h[i] ?? '').split(':::')[0]
      const numara = telefonNormalize(ilk)
      if (numara) {
        kayitlar.push({ ad: ad.trim(), telefon: numara })
        break
      }
    }
  }
  return kayitlar
}

/** Dosya adına göre doğru okuyucuyu seçer. */
export function rehberOku(dosyaAdi: string, metin: string): RehberKaydi[] {
  return dosyaAdi.toLowerCase().endsWith('.csv') ? csvOku(metin) : vcardOku(metin)
}

/**
 * Telefonu olmayan öğrencileri rehberdeki kişilerle eşleştirir.
 *
 * Üç kademe var ve ilk tutan kazanır:
 *  1. Rehber adı öğrencinin adını içeriyor — sistemden aktarılan kişiler
 *     "LİVA BERA GÜGÜ(G-FATMA ULUDAN GÜGÜ)" biçiminde, bu yüzden en güvenli.
 *  2. Rehber adı veli adını içeriyor.
 *  3. Yalnızca soyad tutuyor — zayıf; tek başına yazmaya yetmez, kullanıcı
 *     bakmadan onaylamamalı.
 *
 * Aynı öğrenciye birden çok kişi uyduğunda `rakipVar` işaretlenir: hangisinin
 * doğru olduğuna insan karar vermeli, sessizce ilkini yazmak yanlış numarayı
 * kalıcı hale getirir.
 */
export function eslestir(
  ogrenciler: EslestirmeGirdisi[],
  rehber: RehberKaydi[],
): Eslesme[] {
  const kisiler = rehber.map((k) => ({
    ...k,
    parcalar: new Set(parcalar(k.ad)),
  }))

  const sonuc: Eslesme[] = []

  for (const o of ogrenciler) {
    const adaylar: { kisi: (typeof kisiler)[number]; sebep: EslesmeSebebi }[] = []

    for (const k of kisiler) {
      if (hepsiGeciyor(o.ad_soyad, k.parcalar)) {
        adaylar.push({ kisi: k, sebep: 'ogrenci' })
        continue
      }
      if (o.veli_adi && hepsiGeciyor(o.veli_adi, k.parcalar)) {
        adaylar.push({ kisi: k, sebep: 'veli' })
        continue
      }
      const s = soyad(o.ad_soyad)
      if (s && k.parcalar.has(s)) adaylar.push({ kisi: k, sebep: 'soyad' })
    }

    if (adaylar.length === 0) continue

    const sira: EslesmeSebebi[] = ['ogrenci', 'veli', 'soyad']
    adaylar.sort((a, b) => sira.indexOf(a.sebep) - sira.indexOf(b.sebep))

    const enIyi = adaylar[0]
    // Aynı numaraya işaret eden birden çok kayıt rakip sayılmaz
    const farkliNumaralar = new Set(adaylar.map((a) => a.kisi.telefon))

    sonuc.push({
      student_id: o.student_id,
      ogrenci: o.ad_soyad,
      veli: o.veli_adi,
      sinif: o.sinif,
      rehberAdi: enIyi.kisi.ad,
      telefon: enIyi.kisi.telefon,
      sebep: enIyi.sebep,
      rakipVar: farkliNumaralar.size > 1,
    })
  }

  return sonuc
}

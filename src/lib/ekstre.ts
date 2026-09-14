/**
 * Banka ekstresi (xlsx) okuyucu ve veli-öğrenci eşleştirici.
 *
 * Ziraat Bankası'nın "Hesap Hareketleri" dosyası sade bir xlsx: paylaşılan
 * metin tablosu yok, değerler doğrudan hücrede duruyor ve etiketler `x:`
 * ön ekli. Buradaki çözümleyici o yapıyı hedefler; başka bankaların dosyaları
 * farklı gelirse burası genişletilir.
 *
 * Bu dosya saf: ağ, veritabanı ve React yok — böylece hem sunucuda çalışır
 * hem de tek başına test edilebilir.
 */

import { unzipSync, strFromU8 } from 'fflate'

export type EkstreSatiri = {
  /** ISO tarih (yyyy-mm-dd) */
  tarih: string
  /** Bankanın fiş numarası — mükerrer aktarımı bu engeller */
  fisNo: string
  /** Ekstredeki ham açıklama */
  aciklama: string
  /** Para girişi (pozitif) */
  tutar: number
  /** Açıklamadan çıkarılan gönderen adı */
  gonderen: string
}

/** Türkçe karakterleri ve noktalamayı normalleyip karşılaştırılabilir hale getirir. */
export function adNormalle(metin: string): string {
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
 * "Gönd: SENİHA KELEŞ Gökay keleş 0067-Yapı ve Kredi ... FAST işlemi"
 * satırından gönderen adını ayıklar.
 *
 * Kural: `Gönd:` ile banka kodunun (`0067-`) başladığı yer arasındaki metin
 * alınır, oradan da baştaki büyük harfli kelimeler gönderen adıdır. Veli adı
 * ekstrede her zaman başta ve tamamen büyük harfle yazılır; arkasından gelen
 * öğrenci adı/açıklaması karışık yazımdadır.
 */
export function gonderenAyikla(aciklama: string): string {
  const bas = aciklama.replace(/^\s*Gönd\s*:\s*/i, '')
  // Banka kodu (0067-...) ve sonrasını at
  const bankasiz = bas.split(/\s\d{4}-/)[0] ?? bas

  const kelimeler = bankasiz.trim().split(/\s+/)
  const ad: string[] = []
  for (const k of kelimeler) {
    const harfli = k.replace(/[^\p{L}]/gu, '')
    if (!harfli) break
    // Tamamı büyük harf mi? (Türkçe locale ile)
    const buyuk = harfli === harfli.toLocaleUpperCase('tr')
    if (ad.length > 0 && !buyuk) break
    if (ad.length === 0 && !buyuk) {
      // Ekstrede bazen ad karışık yazımda gelir ("Mehmet Çağrı Özdemir").
      // O durumda ilk üç kelimeyi ad kabul ederiz.
      return kelimeler.slice(0, 3).join(' ')
    }
    ad.push(harfli)
    if (ad.length >= 4) break
  }
  return ad.join(' ')
}

/** xlsx içindeki ilk sayfayı bulup satır-hücre dizisine çevirir. */
function sayfaHucreleri(dosya: Uint8Array): string[][] {
  const paket = unzipSync(dosya)
  const sayfaAdi = Object.keys(paket).find((a) => /^xl\/worksheets\/sheet\d*\.xml$/.test(a))
  if (!sayfaAdi) throw new Error('Dosyada çalışma sayfası bulunamadı.')

  const xml = strFromU8(paket[sayfaAdi])
  const satirlar: string[][] = []

  const satirDesen = /<(?:x:)?row(?:\s[^>]*)?>([\s\S]*?)<\/(?:x:)?row>/g
  const hucreDesen = /<(?:x:)?c[^>]*?>(?:<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>)?<\/(?:x:)?c>/g

  let s: RegExpExecArray | null
  while ((s = satirDesen.exec(xml)) !== null) {
    const hucreler: string[] = []
    let h: RegExpExecArray | null
    hucreDesen.lastIndex = 0
    while ((h = hucreDesen.exec(s[1])) !== null) {
      hucreler.push((h[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    }
    satirlar.push(hucreler)
  }
  return satirlar
}

/** "28.07.2026" → "2026-07-28" */
function tarihCevir(gg: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(gg.trim())
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/**
 * Ekstre dosyasını satırlara çevirir. Yalnızca **para girişleri** döner;
 * çıkışlar (negatif tutarlar) tahsilat değildir.
 */
export function ekstreOku(dosya: Uint8Array): EkstreSatiri[] {
  const sonuc: EkstreSatiri[] = []

  for (const h of sayfaHucreleri(dosya)) {
    if (h.length < 4) continue
    const tarih = tarihCevir(h[0] ?? '')
    if (!tarih) continue

    const tutar = Number(h[3])
    if (!Number.isFinite(tutar) || tutar <= 0) continue

    const aciklama = (h[2] ?? '').trim()
    sonuc.push({
      tarih,
      fisNo: (h[1] ?? '').trim(),
      aciklama,
      tutar,
      gonderen: gonderenAyikla(aciklama),
    })
  }
  return sonuc
}

/**
 * Önerinin neden yapıldığı:
 *   veli-ogrenci — gönderen kayıtlı veli ve açıklamada öğrencinin adı geçiyor
 *   ogrenci      — açıklamada öğrencinin adı geçiyor, gönderen kayıtlı veli değil
 *   veli         — yalnız veli adı tuttu; velinin başka çocuğu da olabilir
 */
export type EslesmeTuru = 'veli-ogrenci' | 'ogrenci' | 'veli'

export type EslesmeAdayi = {
  studentId: string
  ogrenciNo: string
  adSoyad: string
  sinif: string | null
  eslesme: EslesmeTuru
  /** Veli adı hangi alandan tuttu; yalnız öğrenci adıyla eşleştiyse null */
  kaynak: 'veli' | 'veli2' | null
  /** Ana veride kayıtlı, eşleşen veli adı; veli tutmadıysa null */
  veliAdi: string | null
  /**
   * Ekranda "Gönderen" sütununa yazılacak ad.
   *
   * Bankanın gönderen alanı veli adının ardına öğrenci adını ve 'YEMEK' gibi
   * açıklamaları ekliyor. Veli tuttuysa kayıtlı temiz veli adı; tutmadıysa
   * gönderen metninden öğrencinin adı çıkarılmış hâli — çocuğun adı gönderen
   * sütununda görünmesin.
   */
  gonderenAdi: string
}

export type VeliKaydi = {
  studentId: string
  ogrenciNo: string
  adSoyad: string
  sinif: string | null
  veliAdi: string | null
  veli2Adi: string | null
}

const kelimeler = (normal: string) => normal.split(' ').filter(Boolean)

/**
 * Veli adının gönderenle ne kadar tuttuğu: 3 birebir, 2 gönderen veli adıyla
 * başlıyor, 1 veli adının tüm kelimeleri gönderende geçiyor, 0 tutmuyor.
 * Tek kelimelik veli adı 3 dışında sayılmaz — yanlış eşleşme üretir.
 */
function veliDerecesi(veliNormal: string, gonderenNormal: string, metin: string): number {
  if (!veliNormal) return 0
  if (veliNormal === gonderenNormal) return 3
  const k = kelimeler(veliNormal)
  if (k.length < 2) return 0
  if (gonderenNormal.startsWith(veliNormal + ' ') || metin.startsWith(veliNormal + ' ')) return 2
  const g = kelimeler(gonderenNormal)
  if (k.every((p) => g.includes(p))) return 1
  return 0
}

/**
 * Öğrencinin adı açıklamada geçiyor mu? Adın tamamı ya da ilk ve son kelimesi
 * (ikinci ad yazılmamış olabilir: "Eymen Demir") geçmeli.
 */
function ogrenciAdiGeciyor(adSoyad: string, metin: string): boolean {
  const k = kelimeler(adNormalle(adSoyad))
  if (k.length < 2) return false
  const m = ` ${metin} `
  if (m.includes(` ${k.join(' ')} `)) return true
  return m.includes(` ${k[0]} `) && m.includes(` ${k[k.length - 1]} `)
}

/**
 * Gönderen metninden öğrencinin adını çıkarır.
 *
 * Yalnız adın art arda geçtiği yer silinir (tam ad ya da ad + soyad). Tek
 * başına soyad silinmez: dede "HASAN DEMİR" gönderdiğinde çocuğun soyadı
 * aynı diye gönderen "HASAN"a düşmesin.
 */
function ogrenciAdiniCikar(gonderen: string, adSoyad: string): string {
  const ham = gonderen.split(/\s+/).filter(Boolean)
  const normal = ham.map((k) => adNormalle(k))
  const ad = kelimeler(adNormalle(adSoyad))
  if (ad.length < 2) return gonderen

  const aranan = [ad, [ad[0], ad[ad.length - 1]]]
  for (const dizi of aranan) {
    for (let i = 0; i + dizi.length <= normal.length; i++) {
      if (dizi.every((k, j) => normal[i + j] === k)) {
        const kalan = [...ham.slice(0, i), ...ham.slice(i + dizi.length)].join(' ')
        return kalan || gonderen
      }
    }
  }
  return gonderen
}

/**
 * Ödemeyi öğrencilerle eşleştirir — çift taraflı.
 *
 * Açıklamada genelde hem veli hem çocuk adı yazıyor ("ÖZGÜR SARIKAYA ENES
 * SARIKAYA", "UFUK GÜL Çisem gül yemek ücreti"). Önce yalnız veli adına
 * bakılıyordu: aynı velinin iki çocuğu ayırt edilemiyor, gönderen metnindeki
 * çocuk adı veli sanılabiliyordu. Artık iki taraf da kontrol edilir ve en
 * güçlü kademe döner:
 *   1. veli adı tuttu VE açıklamada öğrencinin adı geçiyor
 *   2. açıklamada öğrencinin adı geçiyor (gönderen kayıtlı veli değil: amca,
 *      dede, başka hesap)
 *   3. yalnız veli adı tuttu (en iyi veli derecesindekiler)
 *
 * Aynı kademede birden çok öğrenci dönebilir: bir veli iki çocuğu için tek
 * havale gönderip ikisinin adını yazmışsa ikisi de önerilir.
 *
 * Öğrenci adı aranırken tutan veli adları açıklamadan çıkarılır: velinin
 * adıyla aynı adı taşıyan başka bir öğrenci yanlışlıkla "adı geçiyor"
 * sayılmasın.
 */
export function adaylariBul(
  gonderen: string,
  aciklama: string,
  ogrenciler: VeliKaydi[],
): EslesmeAdayi[] {
  const gonderenNormal = adNormalle(gonderen)
  const metinHam = adNormalle(aciklama).replace(/^gond /, '')
  if (!gonderenNormal && !metinHam) return []

  // 1. tur: her öğrencinin en iyi veli eşleşmesi
  const veliler = ogrenciler.map((o) => {
    let derece = 0
    let kaynak: 'veli' | 'veli2' | null = null
    let ad: string | null = null
    for (const [alan, veliAdi] of [
      ['veli', o.veliAdi],
      ['veli2', o.veli2Adi],
    ] as const) {
      if (!veliAdi) continue
      const d = veliDerecesi(adNormalle(veliAdi), gonderenNormal, metinHam)
      if (d > derece) {
        derece = d
        kaynak = alan
        ad = veliAdi
      }
    }
    return { derece, kaynak, ad }
  })

  // Tutan veli adlarını açıklamadan birer kez çıkar
  let metin = ` ${metinHam} `
  for (const v of new Set(veliler.filter((v) => v.derece >= 2).map((v) => adNormalle(v.ad!)))) {
    metin = metin.replace(` ${v} `, ' ')
  }
  metin = metin.trim()

  // 2. tur: adaylar
  const adaylar: (EslesmeAdayi & { veliDerece: number })[] = []
  ogrenciler.forEach((o, i) => {
    const v = veliler[i]
    const adGeciyor = ogrenciAdiGeciyor(o.adSoyad, metin)
    if (v.derece === 0 && !adGeciyor) return

    adaylar.push({
      studentId: o.studentId,
      ogrenciNo: o.ogrenciNo,
      adSoyad: o.adSoyad,
      sinif: o.sinif,
      eslesme: adGeciyor && v.derece > 0 ? 'veli-ogrenci' : adGeciyor ? 'ogrenci' : 'veli',
      kaynak: v.kaynak,
      veliAdi: v.ad,
      gonderenAdi: v.ad ?? ogrenciAdiniCikar(gonderen, o.adSoyad),
      veliDerece: v.derece,
    })
  })

  // Sıralama için tutulan veli derecesi dışarı verilmez
  const temizle = (liste: typeof adaylar): EslesmeAdayi[] =>
    liste.map((a) => ({
      studentId: a.studentId,
      ogrenciNo: a.ogrenciNo,
      adSoyad: a.adSoyad,
      sinif: a.sinif,
      eslesme: a.eslesme,
      kaynak: a.kaynak,
      veliAdi: a.veliAdi,
      gonderenAdi: a.gonderenAdi,
    }))

  const ikisi = adaylar.filter((a) => a.eslesme === 'veli-ogrenci')
  if (ikisi.length > 0) return temizle(ikisi)

  const adla = adaylar.filter((a) => a.eslesme === 'ogrenci')
  if (adla.length > 0) return temizle(adla)

  const enIyi = Math.max(0, ...adaylar.map((a) => a.veliDerece))
  return temizle(adaylar.filter((a) => a.veliDerece === enIyi))
}

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

export type EslesmeAdayi = {
  studentId: string
  ogrenciNo: string
  adSoyad: string
  sinif: string | null
  /** Hangi alandan eşleşti */
  kaynak: 'veli' | 'veli2'
}

export type VeliKaydi = {
  studentId: string
  ogrenciNo: string
  adSoyad: string
  sinif: string | null
  veliAdi: string | null
  veli2Adi: string | null
}

/**
 * Gönderen adını öğrenci listesiyle eşleştirir.
 *
 * Ayıklanan gönderen adı çoğu zaman veli adından uzundur: ekstrede veli adının
 * hemen ardından öğrenci adı da büyük harfle yazılabiliyor ("FATMA SOKUR KAĞAN
 * SOKUR"). Bu yüzden karşılaştırma veli adının gönderen metnini kapsamasına
 * değil, gönderen metninin veli adıyla başlamasına bakar.
 *
 * Üç kademe, ilk dolu olan döner:
 *   1. birebir aynı
 *   2. gönderen, veli adıyla başlıyor (veli adı en az iki kelime olmalı —
 *      tek kelimelik ad yanlış eşleşme üretir)
 *   3. veli adının tüm kelimeleri gönderen metninde geçiyor (sıra önemsiz)
 *
 * Birden fazla aday çıkarsa hepsi döner; seçimi kullanıcı yapar.
 */
export function adaylariBul(gonderen: string, ogrenciler: VeliKaydi[]): EslesmeAdayi[] {
  const hedef = adNormalle(gonderen)
  if (!hedef) return []
  const hedefKelimeler = hedef.split(' ').filter(Boolean)

  const tam: EslesmeAdayi[] = []
  const baslangic: EslesmeAdayi[] = []
  const kismi: EslesmeAdayi[] = []

  for (const o of ogrenciler) {
    for (const [alan, ad] of [
      ['veli', o.veliAdi],
      ['veli2', o.veli2Adi],
    ] as const) {
      if (!ad) continue
      const n = adNormalle(ad)
      if (!n) continue
      const nKelimeler = n.split(' ').filter(Boolean)

      const aday: EslesmeAdayi = {
        studentId: o.studentId,
        ogrenciNo: o.ogrenciNo,
        adSoyad: o.adSoyad,
        sinif: o.sinif,
        kaynak: alan,
      }

      if (n === hedef) {
        tam.push(aday)
      } else if (nKelimeler.length > 1 && hedef.startsWith(n + ' ')) {
        baslangic.push(aday)
      } else if (nKelimeler.length > 1 && nKelimeler.every((p) => hedefKelimeler.includes(p))) {
        kismi.push(aday)
      }
    }
  }

  if (tam.length > 0) return tam
  if (baslangic.length > 0) return baslangic
  return kismi
}

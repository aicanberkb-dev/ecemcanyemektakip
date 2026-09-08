/**
 * Veli rehberi — telefona aktarılacak kişi kartları.
 *
 * WhatsApp'ın kendi rehberi yok; telefonun rehberinden okuyor. Bu yüzden
 * numaraları WhatsApp'a "kaydetmek" diye bir şey mümkün değil — yapılacak iş,
 * telefonun rehberine toplu kişi eklemek. vCard her telefonun ve Google
 * Rehber'in anladığı ortak biçim.
 *
 * Kişi adı öğrencinin adıyla başlıyor: mesajı yazan kişi çocuğu tanıyor,
 * veliyi çoğu zaman tanımıyor. Veli adı ve okul parantez içinde duruyor ki
 * aynı isimli öğrenciler ayırt edilebilsin.
 */

export type VeliKisi = {
  ogrenciAdi: string
  veliAdi: string | null
  telefon: string | null
  okulAdi: string
}

export type RehberKisisi = {
  ad: string
  telefon: string
  okulAdi: string
}

/**
 * Türkiye cep numarasını uluslararası biçime çevirir.
 *
 * WhatsApp numarayı ülke koduyla ister; rehberde "0535..." duruyorsa sohbeti
 * açamıyor. Tanınmayan biçimler null döner ve dışa aktarımda atlanır —
 * yanlış numarayı rehbere yazmaktansa listede eksik görünmesi iyidir.
 */
export function telefonNormalize(ham: string | null | undefined): string | null {
  const rakam = (ham ?? '').replace(/\D/g, '')
  if (!rakam) return null

  // 0535..., 535..., 90535..., 0090535...
  let govde = rakam
  if (govde.startsWith('0090')) govde = govde.slice(4)
  else if (govde.startsWith('90') && govde.length === 12) govde = govde.slice(2)
  if (govde.startsWith('0')) govde = govde.slice(1)

  // Cep numarası 10 hane ve 5 ile başlar; sabit hat WhatsApp'ta işe yaramaz.
  if (govde.length !== 10 || !govde.startsWith('5')) return null
  return `+90${govde}`
}

/** vCard metin alanlarında kaçılması gereken karakterler. */
function kacir(deger: string): string {
  return deger.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function buyuk(deger: string): string {
  return deger.trim().toLocaleUpperCase('tr')
}

/**
 * Aynı numaraya düşen kayıtları tek kişide toplar.
 *
 * Kardeşlerin velisi aynı numara oluyor. Ayrı ayrı yazılırsa telefon rehberi
 * aynı numarayı iki kez gösterir ve WhatsApp hangisini açacağını şaşırtır;
 * bunun yerine tek kişide iki öğrenci adı yazılıyor.
 */
export function rehberKisileri(kayitlar: VeliKisi[]): RehberKisisi[] {
  const gruplar = new Map<
    string,
    { ogrenciler: string[]; veliler: string[]; okullar: string[] }
  >()

  for (const k of kayitlar) {
    const telefon = telefonNormalize(k.telefon)
    if (!telefon) continue

    const g = gruplar.get(telefon) ?? { ogrenciler: [], veliler: [], okullar: [] }
    const ogrenci = buyuk(k.ogrenciAdi)
    const veli = buyuk(k.veliAdi ?? '')
    const okul = buyuk(k.okulAdi)

    if (ogrenci && !g.ogrenciler.includes(ogrenci)) g.ogrenciler.push(ogrenci)
    if (veli && !g.veliler.includes(veli)) g.veliler.push(veli)
    if (okul && !g.okullar.includes(okul)) g.okullar.push(okul)

    gruplar.set(telefon, g)
  }

  return [...gruplar.entries()]
    .map(([telefon, g]) => {
      const parantez = [g.veliler.join(', '), g.okullar.join(', ')]
        .filter(Boolean)
        .join('-')
      const ad = parantez
        ? `${g.ogrenciler.join(', ')}(${parantez})`
        : g.ogrenciler.join(', ')
      return { ad, telefon, okulAdi: g.okullar.join(', ') }
    })
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
}

/**
 * vCard 3.0 metni. Satır sonu CRLF — biçimin şartı, bazı telefonlar LF ile
 * dosyayı hiç açmıyor.
 */
export function vcardUret(kisiler: RehberKisisi[]): string {
  const kartlar = kisiler.map((k) => {
    const ad = kacir(k.ad)
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${ad};;;`,
      `FN:${ad}`,
      `ORG:${kacir(k.okulAdi)}`,
      `TEL;TYPE=CELL:${k.telefon}`,
      'END:VCARD',
    ].join('\r\n')
  })

  return kartlar.join('\r\n') + '\r\n'
}

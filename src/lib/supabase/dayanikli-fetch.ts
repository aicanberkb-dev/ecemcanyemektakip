/**
 * Supabase istekleri için tekrar deneyen fetch.
 *
 * Veritabanına giden yolda ara ara zaman aşımı (504) ve kısa kopmalar
 * (520–527) oluyor. Tek bir düşen istek sayfayı bozuyordu: okul listesi boş
 * gelince ekran "Okul tanımlı değil" diyordu, oturum kontrolü düşünce giriş
 * ekranına atıyordu. Birkaç yüz milisaniye sonra tekrar denemek neredeyse her
 * zaman geçiyor.
 *
 * Yalnız okuma (GET/HEAD) tekrar denenir. Yazma istekleri denenmez: sunucu
 * isteği işleyip cevabı yolda kaybettiyse tekrar göndermek aynı tahsilatı ya
 * da öğün kaydını iki kez yazabilir, oturum yenilemeyi bozabilir.
 */

const TEKRAR_EDILEBILIR_DURUM = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527])
const BEKLEMELER_MS = [300, 900]

function yontem(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function dayanikliFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const m = yontem(input, init)
  if (m !== 'GET' && m !== 'HEAD') return fetch(input, init)

  for (let deneme = 0; ; deneme++) {
    const son = deneme >= BEKLEMELER_MS.length
    try {
      const cevap = await fetch(input, init)
      if (son || !TEKRAR_EDILEBILIR_DURUM.has(cevap.status)) return cevap
    } catch (hata) {
      // İstek bilerek iptal edildiyse (sayfadan çıkıldı) tekrar deneme
      if (son || init?.signal?.aborted) throw hata
    }
    await bekle(BEKLEMELER_MS[deneme])
  }
}

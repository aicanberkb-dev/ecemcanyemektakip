import { dosyaAdi } from '@/lib/csv'
import { aktifOkul } from '@/lib/okul'
import { aktarildiIsaretle, bekleyenler, rehberListesi } from '@/lib/rehber-sunucu'
import { vcardUret } from '@/lib/rehber'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Veli numaralarını telefon rehberine aktarmak için vCard dosyası.
 *
 * Varsayılan olarak yalnızca **yeni ve adı değişmiş** kişiler iner; aynı
 * numarayı ikinci kez vermek rehberde mükerrer kart oluşturuyor.
 * `?kapsam=tumu` seçili okulun tamamını, `?kapsam=hepsi` bütün okulların
 * tamamını verir.
 */
export async function GET(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const kapsam = new URL(request.url).searchParams.get('kapsam')
  const hepsiOkul = kapsam === 'hepsi'
  const tamListe = hepsiOkul || kapsam === 'tumu'

  const okul = await aktifOkul()
  if (!okul && !hepsiOkul) return new Response('Okul seçili değil.', { status: 400 })

  const tum = await rehberListesi(hepsiOkul, okul?.id)
  if (tum.length === 0) {
    return new Response('Aktarılacak geçerli veli numarası bulunamadı.', { status: 404 })
  }

  let verilecek = tum
  if (!tamListe) {
    const { yeni, degisen } = await bekleyenler(tum)
    verilecek = [...yeni, ...degisen]
    if (verilecek.length === 0) {
      return new Response(
        'Yeni veli yok — bütün numaralar daha önce aktarılmış. Tamamı için "tümünü indir" bağlantısını kullanın.',
        { status: 404 },
      )
    }
  }

  await aktarildiIsaretle(verilecek, hepsiOkul ? null : (okul?.id ?? null))

  const ad = dosyaAdi(
    'veli-rehberi',
    hepsiOkul ? 'tum-okullar' : okul!.ad,
    tamListe ? 'tumu' : 'yeni',
    await bugunSunucu(),
  )

  return new Response(vcardUret(verilecek), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ad}.vcf"`,
    },
  })
}

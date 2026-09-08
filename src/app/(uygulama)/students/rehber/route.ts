import { dosyaAdi } from '@/lib/csv'
import { aktifOkul, okullar as okullariGetir } from '@/lib/okul'
import { rehberKisileri, vcardUret, type VeliKisi } from '@/lib/rehber'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

type Satir = {
  ad_soyad: string
  okul_id: string
  veli_adi: string | null
  veli_telefon: string | null
  veli2_adi: string | null
  veli2_telefon: string | null
}

/**
 * Veli numaralarını telefon rehberine aktarmak için vCard dosyası.
 *
 * `?kapsam=hepsi` bütün okulları tek dosyada verir; varsayılan yalnızca
 * seçili okul. Numarası okunamayan kayıtlar atlanır — rehbere yanlış numara
 * yazmaktansa eksik yazmak yeğdir.
 */
export async function GET(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const hepsi = new URL(request.url).searchParams.get('kapsam') === 'hepsi'
  const okul = await aktifOkul()
  if (!okul && !hepsi) return new Response('Okul seçili değil.', { status: 400 })

  let sorgu = supabase
    .from('students')
    .select('ad_soyad, okul_id, veli_adi, veli_telefon, veli2_adi, veli2_telefon')
    .eq('aktif', true)
    .order('ad_soyad')

  if (!hepsi) sorgu = sorgu.eq('okul_id', okul!.id)

  const { data, error } = await sorgu
  if (error) return new Response(error.message, { status: 500 })

  const okulAdlari = new Map((await okullariGetir()).map((o) => [o.id, o.ad]))
  const satirlar = (data ?? []) as Satir[]

  // Her velinin numarası ayrı bir kişi: ödemeyi anne de baba da yapabiliyor
  // ve ikisine de mesaj gidebilmeli.
  const kayitlar: VeliKisi[] = satirlar.flatMap((s) => {
    const okulAdi = okulAdlari.get(s.okul_id) ?? ''
    return [
      {
        ogrenciAdi: s.ad_soyad,
        veliAdi: s.veli_adi,
        telefon: s.veli_telefon,
        okulAdi,
      },
      {
        ogrenciAdi: s.ad_soyad,
        veliAdi: s.veli2_adi ?? s.veli_adi,
        telefon: s.veli2_telefon,
        okulAdi,
      },
    ]
  })

  const kisiler = rehberKisileri(kayitlar)
  if (kisiler.length === 0) {
    return new Response('Aktarılacak geçerli veli numarası bulunamadı.', { status: 404 })
  }

  const ad = dosyaAdi('veli-rehberi', hepsi ? 'tum-okullar' : okul!.ad, await bugunSunucu())

  return new Response(vcardUret(kisiler), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ad}.vcf"`,
    },
  })
}

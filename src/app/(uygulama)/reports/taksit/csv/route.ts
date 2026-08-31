import { csvMetni, csvSayi, dosyaAdi, hucre } from '@/lib/csv'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { aktifOkul } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import { OGRENCI_TIPI_ADLARI, type TaksitDurumu } from '@/lib/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sezonQ = url.searchParams.get('sezon') ?? undefined

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const okul = await aktifOkul()
  if (!okul) return new Response('Okul seçili değil.', { status: 400 })

  const sezon = sezonSec(await sezonlariGetir(okul.id), sezonQ)
  if (!sezon) return new Response('Sezon tanımlı değil.', { status: 400 })

  const { data, error } = await supabase.rpc('taksit_durumu', { p_sezon_id: sezon.id, p_tarih: await bugunSunucu() })
  if (error) return new Response(error.message, { status: 500 })

  const satirlar = ((data ?? []) as TaksitDurumu[]).map((s) => [
    hucre(s.ogrenci_no),
    hucre(s.ad_soyad),
    hucre(s.sinif),
    hucre(OGRENCI_TIPI_ADLARI[s.ogrenci_tipi]),
    csvSayi(s.yillik_toplam),
    csvSayi(s.vadesi_gelen),
    csvSayi(s.odenen),
    csvSayi(s.eksik),
    hucre(s.odeme_alinmali ? 'ÖDEME ALINMALI' : 'Güncel'),
  ])

  const toplamEksik = ((data ?? []) as TaksitDurumu[]).reduce(
    (t, s) => t + Number(s.eksik),
    0,
  )
  satirlar.push([
    hucre(''),
    hucre('TOPLAM EKSİK'),
    hucre(''),
    hucre(''),
    hucre(''),
    hucre(''),
    hucre(''),
    csvSayi(toplamEksik),
    hucre(''),
  ])

  const csv = csvMetni(
    [
      'Öğrenci No',
      'Ad Soyad',
      'Sınıf',
      'Öğrenci Tipi',
      'Yıllık Toplam',
      'Vadesi Gelen',
      'Ödenen',
      'Eksik',
      'Durum',
    ],
    satirlar,
  )

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dosyaAdi('taksit-takibi', okul.ad, sezon.ad)}.csv"`,
    },
  })
}

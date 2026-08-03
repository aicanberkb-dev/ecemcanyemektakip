import { csvMetni, csvSayi, dosyaAdi, hucre } from '@/lib/csv'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { TaksitDurumu } from '@/lib/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const yil = Number(url.searchParams.get('yil')) || new Date().getFullYear()

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const okul = await aktifOkul()
  if (!okul) return new Response('Okul seçili değil.', { status: 400 })

  const { data, error } = await supabase.rpc('taksit_durumu', {
    p_okul_id: okul.id,
    p_yil: yil,
  })
  if (error) return new Response(error.message, { status: 500 })

  const satirlar = ((data ?? []) as TaksitDurumu[]).map((s) => [
    hucre(s.ogrenci_no),
    hucre(s.ad_soyad),
    hucre(s.sinif),
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
    csvSayi(toplamEksik),
    hucre(''),
  ])

  const csv = csvMetni(
    [
      'Öğrenci No',
      'Ad Soyad',
      'Sınıf',
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
      'Content-Disposition': `attachment; filename="${dosyaAdi('taksit-takibi', okul.ad, String(yil))}.csv"`,
    },
  })
}

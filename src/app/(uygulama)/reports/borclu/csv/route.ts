import { aramaEslesir } from '@/lib/arama'
import { csvMetni, csvSayi, dosyaAdi, hucre } from '@/lib/csv'
import { bugunISO } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  const sinif = url.searchParams.get('sinif')

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const okul = await aktifOkul()
  if (!okul) return new Response('Okul seçili değil.', { status: 400 })

  const { data, error } = await supabase
    .from('student_balances')
    .select('*')
    .eq('okul_id', okul.id)
    .eq('abone_tipi', 'gunluk')
    .eq('aktif', true)
    .lt('kalan', 0)
    .order('kalan')

  if (error) return new Response(error.message, { status: 500 })

  let borclular = (data ?? []) as StudentBalance[]
  if (sinif) borclular = borclular.filter((o) => o.sinif === sinif)
  // Ekrandaki süzgeçle birebir aynı eşleşme kuralı kullanılır.
  if (q?.trim()) {
    borclular = borclular.filter((o) =>
      aramaEslesir(
        `${o.ad_soyad} ${o.ogrenci_no} ${o.veli_adi ?? ''} ${o.veli2_adi ?? ''}`,
        q,
      ),
    )
  }

  const satirlar = borclular.map((o) => [
    hucre(o.ogrenci_no),
    hucre(o.ad_soyad),
    hucre(o.sinif),
    hucre(o.veli_adi),
    hucre(o.veli_telefon),
    csvSayi(o.gunluk_ucret),
    csvSayi(Math.abs(Number(o.kalan))),
  ])

  const toplam = borclular.reduce((t, o) => t + Math.abs(Number(o.kalan)), 0)
  satirlar.push([
    hucre(''),
    hucre('TOPLAM'),
    hucre(''),
    hucre(''),
    hucre(''),
    hucre(''),
    csvSayi(toplam),
  ])

  const csv = csvMetni(
    ['Öğrenci No', 'Ad Soyad', 'Sınıf', 'Veli Adı', 'Veli Telefon', 'Günlük Ücret', 'Borç'],
    satirlar,
  )

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dosyaAdi('borclu-ogrenciler', okul.ad, bugunISO())}.csv"`,
    },
  })
}

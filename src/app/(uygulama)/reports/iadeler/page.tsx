import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { TarihAraligi } from '@/components/TarihAraligi'
import { YazdirButonu } from '@/components/Yazdir'
import { para, tarih as tarihBicim } from '@/lib/format'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'İadeler — Yemek Takip' }

type Iade = {
  id: string
  tarih: string
  tutar: number | string
  aciklama: string | null
  students: { ad_soyad: string; ogrenci_no: string; abone_tipi: string } | null
}

/**
 * Veliye geri ödenen paralar.
 *
 * İade ciroyu doğrudan azaltmıyor — hakediş zaten abonelik kapandığında
 * duruyor. Ama hakedişten fazla iade verildiyse orada taviz verilmiştir ve
 * bunun toplamını görmek gerekir: "bu sezon iadelere ne kadar gitti?"
 */
export default async function IadelerPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const { bas: basQ, bit: bitQ } = await searchParams

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  // Varsayılan aralık: içinde bulunulan sezon
  const { data: sezon } = await supabase
    .from('sezonlar')
    .select('ad, baslangic, bitis')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .order('baslangic', { ascending: false })
    .limit(1)
    .maybeSingle()

  const bas = basQ || sezon?.baslangic || `${new Date().getFullYear()}-01-01`
  const bit = bitQ || sezon?.bitis || await bugunSunucu()

  const { data, error } = await supabase
    .from('transactions')
    .select('id, tarih, tutar, aciklama, students!inner(ad_soyad, ogrenci_no, abone_tipi, okul_id)')
    .eq('tip', 'iade')
    .eq('students.okul_id', okul.id)
    .gte('tarih', bas)
    .lte('tarih', bit)
    .order('tarih', { ascending: false })

  const iadeler = (data ?? []) as unknown as Iade[]
  const toplam = iadeler.reduce((t, i) => t + Number(i.tutar), 0)

  return (
    <div className="space-y-4">
      <CiktiBasligi
        baslik="İadeler"
        okul={okul.ad}
        donem={`${tarihBicim(bas)} – ${tarihBicim(bit)}`}
      />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">İadeler</h1>
          <p className="text-sm text-solgun">
            Veliye geri ödenen paralar. Aylıkçı ayrıldığında hakedişin üstünde kalan
            tutar iade edilir; hakedişten <strong>fazla</strong> iade verildiyse aradaki
            fark verilen tavizdir.
          </p>
        </div>
        <YazdirButonu />
      </div>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/iadeler" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="kart p-4">
        <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
          Toplam iade
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-amber-700">{para(toplam)}</p>
        <p className="mt-1 text-sm text-solgun">{iadeler.length} işlem</p>
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>No</th>
              <th>Öğrenci</th>
              <th>Abone</th>
              <th>Açıklama</th>
              <th className="text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {iadeler.map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap">{tarihBicim(i.tarih)}</td>
                <td className="tabular-nums text-solgun">{i.students?.ogrenci_no ?? '—'}</td>
                <td className="font-medium">{i.students?.ad_soyad ?? '—'}</td>
                <td className="text-solgun">
                  {i.students?.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'}
                </td>
                <td className="text-solgun">{i.aciklama ?? '—'}</td>
                <td className="text-right font-semibold tabular-nums text-amber-700">
                  {para(i.tutar)}
                </td>
              </tr>
            ))}
            {iadeler.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  Bu aralıkta iade yok.
                </td>
              </tr>
            )}
          </tbody>
          {iadeler.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={5} className="px-3 py-2">
                  Toplam
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                  {para(toplam)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="yazdirma-gizle text-xs text-solgun">
        İade işlemek için{' '}
        <Link href="/students" className="text-vurgu hover:underline">
          öğrencinin sayfasındaki
        </Link>{' '}
        <strong>Hakediş</strong> kartını kullanın; orada ne kadarını hak ettiğimiz ve
        ne kadarının iade edilebileceği hesaplanmış olarak durur.
      </p>
    </div>
  )
}

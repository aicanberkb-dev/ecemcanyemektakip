import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export const metadata = { title: '1. Sınıf Yoklama Çizelgesi — Yemek Takip' }

/**
 * 1. sınıfların aylık yoklama çizelgesi — boş, elle doldurulmak üzere.
 *
 * Bu öğrenciler sınıflarından toplu alındığı için yemekhanede tek tek
 * okutulmuyor; personel kâğıda çarpı atıyor, kayıtlar sonradan Toplu Giriş
 * ekranından sisteme işleniyor. Çizelge şube başına ayrı sayfa basılır:
 * her kâğıt tek bir sınıfa gider.
 */
export default async function YoklamaPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('student_balances')
    .select('student_id, ogrenci_no, ad_soyad, sinif')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .eq('ogrenci_tipi', 'birinci_sinif')
    .order('ad_soyad')

  const ogrenciler = (data ?? []) as Pick<
    StudentBalance,
    'student_id' | 'ogrenci_no' | 'ad_soyad' | 'sinif'
  >[]

  // Şube bazlı gruplama: her kâğıt tek bir sınıfa gidiyor
  const subeler = new Map<string, typeof ogrenciler>()
  for (const o of ogrenciler) {
    const anahtar = o.sinif?.trim() || 'Sınıfı girilmemiş'
    const liste = subeler.get(anahtar) ?? []
    liste.push(o)
    subeler.set(anahtar, liste)
  }
  const sirali = [...subeler.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))

  const gunSayisi = new Date(yil, ay, 0).getDate()
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1)
  const haftaSonu = (gun: number) => {
    const g = new Date(yil, ay - 1, gun).getDay()
    return g === 0 || g === 6
  }

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle space-y-3">
        <Link href="/reports" className="text-sm text-vurgu hover:underline">
          ← Raporlar
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="baslik">1. Sınıf Yoklama Çizelgesi</h1>
            <p className="text-sm text-solgun">
              Boş çizelge. Personel yemeğe gelen öğrencinin gününe çarpı atar; kayıtlar
              sonradan{' '}
              <Link href="/toplu" className="text-vurgu hover:underline">
                Toplu Giriş
              </Link>{' '}
              ekranından sisteme işlenir.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
            <YazdirButonu etiket={`Yazdır (${sirali.length} sayfa)`} />
          </div>
        </div>

        <form className="kart flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="etiket" htmlFor="ay">
              Ay
            </label>
            <select id="ay" name="ay" defaultValue={String(ay)} className="girdi">
              {AY_ADLARI.map((adi, i) => (
                <option key={adi} value={i + 1}>
                  {adi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiket" htmlFor="yil">
              Yıl
            </label>
            <input
              id="yil"
              type="number"
              name="yil"
              defaultValue={yil}
              min={2000}
              max={2100}
              className="girdi w-28"
            />
          </div>
          <button className="btn-birincil">Göster</button>
        </form>

        {ogrenciler.length === 0 && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bu okulda <strong>1. Sınıf</strong> tipinde aktif öğrenci yok. Öğrenci
            kaydında <strong>Öğrenci Tipi</strong> alanını “1. Sınıf” seçtiğinizde burada
            listelenirler.
          </p>
        )}
      </div>

      {sirali.map(([sube, liste], i) => (
        <section
          key={sube}
          className="kart p-4"
          style={i === sirali.length - 1 ? undefined : { breakAfter: 'page' }}
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-400 pb-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black">{sube}</span>
              <span className="text-sm font-semibold">YEMEK YOKLAMA ÇİZELGESİ</span>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{okul.ad}</div>
              <div>
                {AY_ADLARI[ay - 1]} {yil} · {liste.length} öğrenci
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">
                    Öğrenci
                  </th>
                  {gunler.map((g) => (
                    <th
                      key={g}
                      className={`w-6 border border-slate-400 px-0 py-1 text-center tabular-nums ${
                        haftaSonu(g) ? 'bg-slate-300 text-slate-500' : 'bg-slate-100'
                      }`}
                    >
                      {g}
                    </th>
                  ))}
                  <th className="border border-slate-400 bg-slate-100 px-2 py-1 text-center">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody>
                {liste.map((o) => (
                  <tr key={o.student_id}>
                    <td className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">
                      {o.ad_soyad}
                    </td>
                    {gunler.map((g) => (
                      <td
                        key={g}
                        className={`h-7 border border-slate-400 ${
                          haftaSonu(g) ? 'bg-slate-200' : ''
                        }`}
                      />
                    ))}
                    <td className="border border-slate-400" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-between text-xs text-slate-600">
            <span>Hafta sonları koyu renkli sütunlardır.</span>
            <span>Görevli imza: ____________________</span>
          </div>
        </section>
      ))}
    </div>
  )
}

import Link from 'next/link'

import { AboneRozeti, Bakiye, DurumRozeti } from '@/components/Rozetler'
import { para } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export const metadata = { title: 'Öğrenciler — Yemek Takip' }

type Arama = {
  q?: string
  sinif?: string
  borc?: 'hepsi' | 'borclu' | 'borcsuz'
  durum?: 'aktif' | 'pasif' | 'hepsi'
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Arama>
}) {
  const filtre = await searchParams
  const supabase = await supabaseServer()

  let sorgu = supabase.from('student_balances').select('*').order('ad_soyad')

  if (filtre.q?.trim()) {
    const t = filtre.q.trim()
    sorgu = sorgu.or(`ad_soyad.ilike.%${t}%,ogrenci_no.ilike.%${t}%,kimlik_no.ilike.%${t}%`)
  }
  if (filtre.sinif?.trim()) sorgu = sorgu.eq('sinif', filtre.sinif.trim())
  if (filtre.durum !== 'hepsi') sorgu = sorgu.eq('aktif', filtre.durum !== 'pasif')
  if (filtre.borc === 'borclu') sorgu = sorgu.lt('kalan', 0)
  if (filtre.borc === 'borcsuz') sorgu = sorgu.gte('kalan', 0)

  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    sorgu,
    supabase.from('students').select('sinif').not('sinif', 'is', null),
  ])

  const ogrenciler = (data ?? []) as StudentBalance[]
  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  const toplamKalan = ogrenciler.reduce((t, o) => t + Number(o.kalan), 0)
  const borcluSayisi = ogrenciler.filter((o) => Number(o.kalan) < 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">Öğrenciler</h1>
        <Link href="/students/new" className="btn-birincil">
          + Yeni Öğrenci
        </Link>
      </div>

      <form className="kart flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="etiket" htmlFor="q">
            Ad / No / Kimlik
          </label>
          <input id="q" name="q" defaultValue={filtre.q ?? ''} className="girdi" />
        </div>

        <div>
          <label className="etiket" htmlFor="sinif">
            Sınıf
          </label>
          <select id="sinif" name="sinif" defaultValue={filtre.sinif ?? ''} className="girdi">
            <option value="">Hepsi</option>
            {siniflar.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="borc">
            Borç durumu
          </label>
          <select id="borc" name="borc" defaultValue={filtre.borc ?? 'hepsi'} className="girdi">
            <option value="hepsi">Hepsi</option>
            <option value="borclu">Borçlu (eksi bakiye)</option>
            <option value="borcsuz">Borçsuz</option>
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="durum">
            Durum
          </label>
          <select id="durum" name="durum" defaultValue={filtre.durum ?? 'aktif'} className="girdi">
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
            <option value="hepsi">Hepsi</option>
          </select>
        </div>

        <button className="btn-birincil">Filtrele</button>
        <Link href="/students" className="btn-ikincil">
          Temizle
        </Link>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Abone</th>
              <th className="text-right">Alınan</th>
              <th className="text-right">Harcanan</th>
              <th className="text-right">Kalan</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {ogrenciler.map((o) => (
              <tr key={o.student_id}>
                <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                <td>
                  <Link
                    href={`/students/${o.student_id}`}
                    className="font-medium text-vurgu hover:underline"
                  >
                    {o.ad_soyad}
                  </Link>
                </td>
                <td>{o.sinif ?? '—'}</td>
                <td>
                  <AboneRozeti tip={o.abone_tipi} />
                </td>
                <td className="text-right tabular-nums">{para(o.alinan_para)}</td>
                <td className="text-right tabular-nums">{para(o.harcanan)}</td>
                <td className="text-right">
                  <Bakiye tutar={Number(o.kalan)} />
                </td>
                <td>
                  <DurumRozeti aktif={o.aktif} />
                </td>
              </tr>
            ))}
            {ogrenciler.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-solgun">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
          {ogrenciler.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={6} className="px-3 py-2">
                  {ogrenciler.length} öğrenci · {borcluSayisi} borçlu
                </td>
                <td className="px-3 py-2 text-right">
                  <Bakiye tutar={toplamKalan} kalin />
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

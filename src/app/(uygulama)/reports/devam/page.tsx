import Link from 'next/link'

import { AY_ADLARI } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { DevamSatiri } from '@/lib/types'

export const metadata = { title: 'Devam Çizelgesi — Yemek Takip' }

export default async function DevamPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; sinif?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()
  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase.rpc('devam_cizelgesi', { p_yil: yil, p_ay: ay }),
    supabase.from('students').select('sinif').not('sinif', 'is', null),
  ])

  let satirlar = (data ?? []) as DevamSatiri[]
  if (q.sinif) satirlar = satirlar.filter((s) => s.sinif === q.sinif)

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  const gunSayisi = new Date(yil, ay, 0).getDate()
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1)
  const haftaSonu = (gun: number) => {
    const g = new Date(yil, ay - 1, gun).getDay()
    return g === 0 || g === 6
  }
  const haftaIciSayisi = gunler.filter((g) => !haftaSonu(g)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">
          Devam Çizelgesi — {AY_ADLARI[ay - 1]} {yil}
        </h1>
        <p className="text-sm text-solgun">
          Ayda {haftaIciSayisi} hafta içi gün · hafta sonları sayıma dahil değil
        </p>
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
        <div>
          <label className="etiket" htmlFor="sinif">
            Sınıf
          </label>
          <select id="sinif" name="sinif" defaultValue={q.sinif ?? ''} className="girdi">
            <option value="">Hepsi</option>
            {siniflar.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-birincil">Göster</button>
        <Link href="/reports/devam" className="btn-ikincil">
          Bu ay
        </Link>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50">Öğrenci</th>
              {gunler.map((g) => (
                <th
                  key={g}
                  className={`!px-1 text-center tabular-nums ${
                    haftaSonu(g) ? 'bg-slate-200 text-slate-400' : ''
                  }`}
                >
                  {g}
                </th>
              ))}
              <th className="text-right">Geldi</th>
              <th className="text-right">Gelmedi</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const geldigi = new Set(s.geldigi_gunler)
              return (
                <tr key={s.student_id}>
                  <td className="sticky left-0 z-10 bg-white whitespace-nowrap">
                    <Link
                      href={`/reports/devam/${s.student_id}?yil=${yil}`}
                      className="font-medium text-vurgu hover:underline"
                    >
                      {s.ad_soyad}
                    </Link>
                    <span className="ml-2 text-xs text-solgun">{s.sinif ?? ''}</span>
                  </td>
                  {gunler.map((g) => (
                    <td
                      key={g}
                      className={`!px-1 text-center ${
                        haftaSonu(g)
                          ? 'bg-slate-100'
                          : geldigi.has(g)
                            ? 'bg-emerald-50 font-semibold text-emerald-700'
                            : ''
                      }`}
                    >
                      {geldigi.has(g) ? '✓' : ''}
                    </td>
                  ))}
                  <td className="text-right font-semibold tabular-nums text-emerald-700">
                    {s.geldi_sayisi}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">{s.gelmedi_sayisi}</td>
                </tr>
              )
            })}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={gunSayisi + 3} className="py-8 text-center text-solgun">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

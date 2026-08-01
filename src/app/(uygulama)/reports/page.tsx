import Link from 'next/link'

import { AboneRozeti, Bakiye } from '@/components/Rozetler'
import { TarihAraligi } from '@/components/TarihAraligi'
import { ayBasiISO, bugunISO, para } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { GelenGidenSatiri } from '@/lib/types'

export const metadata = { title: 'Gelen–Giden Raporu — Yemek Takip' }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string; sinif?: string }>
}) {
  const { bas: basQ, bit: bitQ, sinif } = await searchParams
  const bas = basQ || ayBasiISO()
  const bit = bitQ || bugunISO()

  const supabase = await supabaseServer()
  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase.rpc('gelen_giden_raporu', { p_bas: bas, p_bit: bit }),
    supabase.from('students').select('sinif').not('sinif', 'is', null),
  ])

  let satirlar = (data ?? []) as GelenGidenSatiri[]
  if (sinif) satirlar = satirlar.filter((s) => s.sinif === sinif)

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  const toplam = satirlar.reduce(
    (t, s) => ({
      tahsilat: t.tahsilat + Number(s.donem_tahsilat),
      harcama: t.harcama + Number(s.donem_harcama),
      ogun: t.ogun + Number(s.donem_ogun),
      kalan: t.kalan + Number(s.guncel_kalan),
      devir: t.devir + Number(s.devir),
    }),
    { tahsilat: 0, harcama: 0, ogun: 0, kalan: 0, devir: 0 },
  )

  const csvYolu = `/reports/csv?bas=${bas}&bit=${bit}${sinif ? `&sinif=${encodeURIComponent(sinif)}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">Gelen – Giden – Tahsil Edilen</h1>
        <a href={csvYolu} className="btn-ikincil">
          CSV indir
        </a>
      </div>

      <TarihAraligi
        bas={bas}
        bit={bit}
        temizleYolu="/reports"
        cocuklar={
          <div>
            <label className="etiket" htmlFor="sinif">
              Sınıf
            </label>
            <select id="sinif" name="sinif" defaultValue={sinif ?? ''} className="girdi">
              <option value="">Hepsi</option>
              {siniflar.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      {/* Özet satırı */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Ozet baslik="Dönem tahsilatı" deger={para(toplam.tahsilat)} renk="text-emerald-700" />
        <Ozet baslik="Dönem harcaması" deger={para(toplam.harcama)} />
        <Ozet baslik="Öğün sayısı" deger={String(toplam.ogun)} />
        <div className="kart p-4">
          <p className="text-xs font-medium tracking-wide text-solgun uppercase">
            Güncel toplam bakiye
          </p>
          <p className="mt-1 text-2xl">
            <Bakiye tutar={toplam.kalan} kalin />
          </p>
        </div>
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Abone</th>
              <th className="text-right">Devir</th>
              <th className="text-right">Tahsilat</th>
              <th className="text-right">Harcama</th>
              <th className="text-right">Öğün</th>
              <th className="text-right">Güncel Kalan</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.student_id}>
                <td className="tabular-nums text-solgun">{s.ogrenci_no}</td>
                <td>
                  <Link
                    href={`/students/${s.student_id}`}
                    className="font-medium text-vurgu hover:underline"
                  >
                    {s.ad_soyad}
                  </Link>
                </td>
                <td>{s.sinif ?? '—'}</td>
                <td>
                  <AboneRozeti tip={s.abone_tipi} />
                </td>
                <td className="text-right tabular-nums">{para(s.devir)}</td>
                <td className="text-right tabular-nums text-emerald-700">
                  {para(s.donem_tahsilat)}
                </td>
                <td className="text-right tabular-nums">{para(s.donem_harcama)}</td>
                <td className="text-right tabular-nums">{s.donem_ogun}</td>
                <td className="text-right">
                  <Bakiye tutar={Number(s.guncel_kalan)} />
                </td>
              </tr>
            ))}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-solgun">
                  Bu aralıkta kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
          {satirlar.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-3 py-2">
                  {satirlar.length} öğrenci
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.devir)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.tahsilat)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.harcama)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{toplam.ogun}</td>
                <td className="px-3 py-2 text-right">
                  <Bakiye tutar={toplam.kalan} kalin />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function Ozet({ baslik, deger, renk }: { baslik: string; deger: string; renk?: string }) {
  return (
    <div className="kart p-4">
      <p className="text-xs font-medium tracking-wide text-solgun uppercase">{baslik}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${renk ?? ''}`}>{deger}</p>
    </div>
  )
}

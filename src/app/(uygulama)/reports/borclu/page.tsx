import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { YazdirButonu } from '@/components/Yazdir'
import { para } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export const metadata = { title: 'Borçlu Öğrenciler — Yemek Takip' }

export default async function BorcluPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sinif?: string }>
}) {
  const filtre = await searchParams
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  // Sadece günlükçüler: aylıkçıların ücreti taksit planından takip edilir,
  // yemek başına borçlanmadıkları için bu raporda yerleri yok.
  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase
      .from('student_balances')
      .select('*')
      .eq('okul_id', okul.id)
      .eq('abone_tipi', 'gunluk')
      .eq('aktif', true)
      .lt('kalan', 0)
      .order('kalan'),
    supabase
      .from('students')
      .select('sinif')
      .eq('okul_id', okul.id)
      .eq('abone_tipi', 'gunluk')
      .not('sinif', 'is', null),
  ])

  let borclular = (data ?? []) as StudentBalance[]

  if (filtre.sinif) borclular = borclular.filter((o) => o.sinif === filtre.sinif)
  if (filtre.q?.trim()) {
    const t = filtre.q.trim().toLocaleLowerCase('tr')
    borclular = borclular.filter(
      (o) =>
        o.ad_soyad.toLocaleLowerCase('tr').includes(t) ||
        o.ogrenci_no.includes(t) ||
        (o.veli_adi ?? '').toLocaleLowerCase('tr').includes(t),
    )
  }

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  const toplamBorc = borclular.reduce((t, o) => t + Math.abs(Number(o.kalan)), 0)
  const telefonsuz = borclular.filter((o) => !o.veli_telefon).length

  const csvYolu =
    `/reports/borclu/csv?` +
    new URLSearchParams({
      ...(filtre.q ? { q: filtre.q } : {}),
      ...(filtre.sinif ? { sinif: filtre.sinif } : {}),
    }).toString()

  return (
    <div className="space-y-4">
      <CiktiBasligi baslik="Borçlu Öğrenciler" okul={okul.ad} />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="baslik">Borçlu Öğrenciler</h1>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>
        <div className="flex gap-2">
          <YazdirButonu />
          <a href={csvYolu} className="btn-ikincil">
            CSV indir
          </a>
        </div>
      </div>
      <p className="yazdirma-gizle text-sm text-solgun">
        Bakiyesi eksiye düşmüş <strong>günlükçü</strong> öğrenciler. Bakiyesi sıfır veya
        artıda olanlar listede görünmez. Aylıkçılar bu raporda yer almaz — onların takibi{' '}
        <Link href="/reports/taksit" className="text-vurgu hover:underline">
          Taksit Takibi
        </Link>{' '}
        sayfasındadır.
      </p>

      <form className="kart yazdirma-gizle flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="etiket" htmlFor="q">
            Öğrenci veya veli ara
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
        <button className="btn-birincil">Filtrele</button>
        <Link href="/reports/borclu" className="btn-ikincil">
          Temizle
        </Link>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Borçlu öğrenci" deger={String(borclular.length)} />
        <Ozet baslik="Toplam alacak" deger={para(toplamBorc)} renk="text-red-600" />
        <Ozet
          baslik="Telefonu eksik"
          deger={String(telefonsuz)}
          alt={telefonsuz > 0 ? 'veliye ulaşılamaz' : 'hepsinde telefon var'}
        />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Veli</th>
              <th>Telefon</th>
              <th className="text-right">Günlük Ücret</th>
              <th className="text-right">Borç</th>
            </tr>
          </thead>
          <tbody>
            {borclular.map((o) => (
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
                <td>{o.veli_adi ?? '—'}</td>
                <td className="whitespace-nowrap">
                  {o.veli_telefon ? (
                    <a
                      href={`tel:${o.veli_telefon.replace(/\s/g, '')}`}
                      className="text-vurgu hover:underline"
                    >
                      {o.veli_telefon}
                    </a>
                  ) : (
                    <span className="rozet bg-amber-100 text-amber-800">telefon yok</span>
                  )}
                </td>
                <td className="text-right tabular-nums text-solgun">
                  {para(o.gunluk_ucret)}
                </td>
                <td className="text-right font-bold tabular-nums text-red-600">
                  {para(Math.abs(Number(o.kalan)))}
                </td>
              </tr>
            ))}
            {borclular.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <p className="font-medium text-emerald-700">Borçlu öğrenci yok.</p>
                  <p className="mt-1 text-sm text-solgun">
                    Tüm günlükçü öğrencilerin bakiyesi sıfır veya artıda.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
          {borclular.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={6} className="px-3 py-2">
                  {borclular.length} öğrenciden toplam alacak
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">
                  {para(toplamBorc)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  deger,
  alt,
  renk,
}: {
  baslik: string
  deger: string
  alt?: string
  renk?: string
}) {
  return (
    <div className="kart p-4">
      <p className="text-xs font-medium tracking-wide text-solgun uppercase">{baslik}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${renk ?? ''}`}>{deger}</p>
      {alt && <p className="mt-1 text-xs text-solgun">{alt}</p>}
    </div>
  )
}

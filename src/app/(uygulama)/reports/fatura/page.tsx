import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { AboneRozeti } from '@/components/Rozetler'
import { TarihAraligi } from '@/components/TarihAraligi'
import { YazdirButonu } from '@/components/Yazdir'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export const metadata = { title: 'Fatura İstenenler — Yemek Takip' }

/** Notunda fatura geçiyor mu? İşaretlenmeyi bekleyen öğrencileri yakalar. */
const FATURA_IZI = /fatura/i

export default async function FaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const { bas: basQ, bit: bitQ } = await searchParams

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  // Varsayılan dönem: içinde bulunulan sezon
  const { data: sezon } = await supabase
    .from('sezonlar')
    .select('ad, baslangic, bitis')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .order('baslangic', { ascending: false })
    .limit(1)
    .maybeSingle()

  const bas = basQ || sezon?.baslangic || `${new Date().getFullYear()}-01-01`
  const bit = bitQ || sezon?.bitis || (await bugunSunucu())

  const [{ data: ogrenciVeri, error }, { data: tahsilatVeri }] = await Promise.all([
    supabase
      .from('student_balances')
      .select('*')
      .eq('okul_id', okul.id)
      .order('ad_soyad'),
    supabase
      .from('transactions')
      .select('student_id, tutar, students!inner(okul_id)')
      .eq('students.okul_id', okul.id)
      .eq('tip', 'tahsilat')
      .gte('tarih', bas)
      .lte('tarih', bit),
  ])

  const ogrenciler = (ogrenciVeri ?? []) as StudentBalance[]

  // Dönem içinde o öğrenciden tahsil edilen para: faturanın tutarı buradan
  // çıkar, fatura kesilirken elle toplamak gerekmesin.
  const tahsilat = new Map<string, number>()
  for (const t of (tahsilatVeri ?? []) as { student_id: string; tutar: number | string }[]) {
    tahsilat.set(t.student_id, (tahsilat.get(t.student_id) ?? 0) + Number(t.tutar))
  }

  const isaretliler = ogrenciler.filter((o) => o.fatura_istiyor)
  // Notuna "fatura" yazılmış ama kutusu işaretlenmemiş olanlar: liste eksik
  // kalmasın diye ayrıca gösterilir
  const adaylar = ogrenciler.filter(
    (o) => !o.fatura_istiyor && (FATURA_IZI.test(o.ozel_not ?? '') || FATURA_IZI.test(o.fatura_bilgisi ?? '')),
  )

  const toplam = isaretliler.reduce((t, o) => t + (tahsilat.get(o.student_id) ?? 0), 0)

  return (
    <div className="space-y-4">
      <CiktiBasligi
        baslik="Fatura İstenenler"
        okul={okul.ad}
        donem={`${tarihBicim(bas)} – ${tarihBicim(bit)}`}
      />

      <div className="yazdirma-gizle flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="baslik">Fatura İstenenler</h1>
          <p className="text-sm text-solgun">
            Ana veride <strong>Fatura istiyor</strong> işaretli öğrenciler. Tutar sütunu
            seçili dönemde o öğrenciden tahsil edilen parayı gösterir.
          </p>
        </div>
        <YazdirButonu />
      </div>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/fatura" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="kart p-4">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Fatura istenen öğrenci
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{isaretliler.length}</p>
        </div>
        <div className="kart p-4">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Dönemde tahsil edilen
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700">{para(toplam)}</p>
        </div>
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Abone</th>
              <th>Veli</th>
              <th>Fatura Bilgileri</th>
              <th className="text-right">Dönem Tahsilatı</th>
            </tr>
          </thead>
          <tbody>
            {isaretliler.map((o) => (
              <tr key={o.student_id}>
                <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                <td className="font-medium">
                  <Link href={`/students/${o.student_id}`} className="text-vurgu hover:underline">
                    {o.ad_soyad}
                  </Link>
                  {!o.aktif && (
                    <span className="rozet ml-1 bg-slate-100 text-slate-600">Pasif</span>
                  )}
                </td>
                <td>{o.sinif ?? '—'}</td>
                <td>
                  <AboneRozeti tip={o.abone_tipi} />
                </td>
                <td className="text-solgun">{o.veli_adi ?? '—'}</td>
                <td className="max-w-80 text-xs whitespace-pre-wrap">
                  {o.fatura_bilgisi ?? (
                    <span className="text-solgun">
                      {o.ozel_not && FATURA_IZI.test(o.ozel_not) ? o.ozel_not : '— girilmemiş —'}
                    </span>
                  )}
                </td>
                <td className="text-right font-medium tabular-nums text-emerald-700">
                  {para(tahsilat.get(o.student_id) ?? 0)}
                </td>
              </tr>
            ))}
            {isaretliler.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  Fatura istiyor işareti konmuş öğrenci yok. İşaret öğrenci ana verisinde,
                  Özel Not alanının yanında.
                </td>
              </tr>
            )}
          </tbody>
          {isaretliler.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={6} className="px-3 py-2">
                  Toplam
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {para(toplam)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {adaylar.length > 0 && (
        <div className="kart yazdirma-gizle overflow-x-auto border-amber-300">
          <div className="border-b border-cizgi bg-amber-50 px-4 py-3">
            <h2 className="font-semibold text-amber-900">
              Notunda fatura geçiyor ama işaretlenmemiş ({adaylar.length})
            </h2>
            <p className="text-xs text-amber-800">
              Eski kayıtlarda fatura bilgisi özel nota yazılmıştı. Bunları açıp
              &quot;Fatura istiyor&quot; kutusunu işaretleyin; sonra bu liste boşalır.
            </p>
          </div>
          <table className="tablo">
            <thead>
              <tr>
                <th>No</th>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Not</th>
                <th className="text-right">İşaretle</th>
              </tr>
            </thead>
            <tbody>
              {adaylar.map((o) => (
                <tr key={o.student_id}>
                  <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                  <td className="font-medium">{o.ad_soyad}</td>
                  <td>{o.sinif ?? '—'}</td>
                  <td className="max-w-96 text-xs whitespace-pre-wrap text-solgun">
                    {o.ozel_not ?? '—'}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/students/${o.student_id}/edit`}
                      className="text-xs text-vurgu hover:underline"
                    >
                      Ana veriye git →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

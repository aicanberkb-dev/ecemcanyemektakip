import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { TarihAraligi } from '@/components/TarihAraligi'
import { YazdirButonu } from '@/components/Yazdir'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { OdemeYontemi, StudentBalance } from '@/lib/types'

import { FaturaListesi, type FaturaSatiri } from './FaturaListesi'

export const metadata = { title: 'Fatura İstenenler — Yemek Takip' }

/** Notunda fatura geçiyor mu? İşaretlenmeyi bekleyen öğrencileri yakalar. */
const FATURA_IZI = /fatura/i

type HamTahsilat = {
  id: string
  student_id: string
  tarih: string
  tutar: number | string
  odeme_yontemi: OdemeYontemi | null
  aciklama: string | null
}

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

  const [{ data: ogrenciVeri, error }, { data: tahsilatVeri }, { data: faturaVeri }] =
    await Promise.all([
      supabase.from('student_balances').select('*').eq('okul_id', okul.id).order('ad_soyad'),
      supabase
        .from('transactions')
        .select('id, student_id, tarih, tutar, odeme_yontemi, aciklama, students!inner(okul_id)')
        .eq('students.okul_id', okul.id)
        .eq('tip', 'tahsilat')
        .gte('tarih', bas)
        .lte('tarih', bit)
        .order('tarih'),
      supabase
        .from('ogrenci_faturalari')
        .select('student_id, kesildi_tarih, tutar, students!inner(okul_id)')
        .eq('students.okul_id', okul.id)
        .eq('donem_bas', bas)
        .eq('donem_bit', bit),
    ])

  const ogrenciler = (ogrenciVeri ?? []) as StudentBalance[]

  // Dönem içindeki tahsilatlar öğrenci öğrenci gruplanır: fatura tutarı
  // hangi ödemelerden geliyor, listede tek tek görünsün
  const odemeler = new Map<string, FaturaSatiri['odemeler']>()
  for (const t of (tahsilatVeri ?? []) as unknown as HamTahsilat[]) {
    const liste = odemeler.get(t.student_id) ?? []
    liste.push({
      id: t.id,
      tarih: t.tarih,
      tutar: Number(t.tutar),
      odeme_yontemi: t.odeme_yontemi,
      aciklama: t.aciklama,
    })
    odemeler.set(t.student_id, liste)
  }

  const kesilenler = new Map<string, { tarih: string; tutar: number }>()
  for (const f of (faturaVeri ?? []) as unknown as {
    student_id: string
    kesildi_tarih: string
    tutar: number | string
  }[]) {
    kesilenler.set(f.student_id, { tarih: f.kesildi_tarih, tutar: Number(f.tutar) })
  }

  const satirlar: FaturaSatiri[] = ogrenciler
    .filter((o) => o.fatura_istiyor)
    .map((o) => ({
      student_id: o.student_id,
      ogrenci_no: o.ogrenci_no,
      ad_soyad: o.ad_soyad,
      sinif: o.sinif,
      abone_tipi: o.abone_tipi,
      aktif: o.aktif,
      veli_adi: o.veli_adi,
      fatura_bilgisi: o.fatura_bilgisi,
      ozel_not: o.ozel_not,
      odemeler: odemeler.get(o.student_id) ?? [],
      kesildi: kesilenler.get(o.student_id) ?? null,
    }))

  // Notuna "fatura" yazılmış ama kutusu işaretlenmemiş olanlar: liste eksik
  // kalmasın diye ayrıca gösterilir
  const adaylar = ogrenciler.filter(
    (o) =>
      !o.fatura_istiyor &&
      (FATURA_IZI.test(o.ozel_not ?? '') || FATURA_IZI.test(o.fatura_bilgisi ?? '')),
  )

  const toplam = satirlar.reduce(
    (t, s) => t + s.odemeler.reduce((a, o) => a + o.tutar, 0),
    0,
  )
  const kesilen = satirlar.filter((s) => s.kesildi).length

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
            Ana veride <strong>Fatura istiyor</strong> işaretli öğrenciler. Tutar seçili
            dönemde tahsil edilen paradır; yanındaki bağlantı ödemeleri tek tek açar.
            Faturayı kesince soldaki kutuyu işaretle, aynı dönemi ikinci kez kesme.
          </p>
        </div>
        <YazdirButonu />
      </div>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/fatura" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kart p-4">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Fatura istenen öğrenci
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{satirlar.length}</p>
        </div>
        <div className="kart p-4">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Kesilen fatura
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700">
            {kesilen}
            <span className="ml-1 text-base font-medium text-solgun">
              / {satirlar.length}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-solgun">bu dönem için</p>
        </div>
        <div className="kart p-4">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Dönemde tahsil edilen
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700">{para(toplam)}</p>
        </div>
      </div>

      <FaturaListesi satirlar={satirlar} bas={bas} bit={bit} />

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

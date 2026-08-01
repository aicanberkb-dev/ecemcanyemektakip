import Link from 'next/link'

import { TarihAraligi } from '@/components/TarihAraligi'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { Transaction } from '@/lib/types'

export const metadata = { title: 'Tahsilat Geçmişi — Yemek Takip' }

type Kayit = Transaction & {
  students: { ad_soyad: string; ogrenci_no: string; sinif: string | null } | null
}

export default async function TahsilatPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string; q?: string }>
}) {
  const q = await searchParams
  const yil = new Date().getFullYear()
  const bas = q.bas || `${yil}-01-01`
  const bit = q.bit || `${yil}-12-31`

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const { data, error } = await supabase
    .from('transactions')
    .select('*, students!inner(ad_soyad, ogrenci_no, sinif, okul_id)')
    .eq('students.okul_id', okul.id)
    .eq('tip', 'tahsilat')
    .gte('tarih', bas)
    .lte('tarih', bit)
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  let kayitlar = (data ?? []) as Kayit[]
  if (q.q?.trim()) {
    const t = q.q.trim().toLocaleLowerCase('tr')
    kayitlar = kayitlar.filter(
      (k) =>
        k.students?.ad_soyad.toLocaleLowerCase('tr').includes(t) ||
        k.students?.ogrenci_no.includes(t),
    )
  }

  const toplam = kayitlar.reduce((t, k) => t + Number(k.tutar), 0)

  // Öğrenci bazlı kırılım
  const ogrenciBazli = new Map<string, { ad: string; no: string; tutar: number; adet: number }>()
  for (const k of kayitlar) {
    const mevcut = ogrenciBazli.get(k.student_id) ?? {
      ad: k.students?.ad_soyad ?? '—',
      no: k.students?.ogrenci_no ?? '',
      tutar: 0,
      adet: 0,
    }
    mevcut.tutar += Number(k.tutar)
    mevcut.adet += 1
    ogrenciBazli.set(k.student_id, mevcut)
  }
  const ozetSatirlari = [...ogrenciBazli.entries()].sort((a, b) => b[1].tutar - a[1].tutar)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Tahsilat Geçmişi</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      <TarihAraligi
        bas={bas}
        bit={bit}
        temizleYolu="/reports/tahsilat"
        cocuklar={
          <div className="min-w-48 flex-1">
            <label className="etiket" htmlFor="q">
              Öğrenci ara
            </label>
            <input id="q" name="q" defaultValue={q.q ?? ''} className="girdi" />
          </div>
        }
      />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Toplam tahsilat" deger={para(toplam)} renk="text-emerald-700" />
        <Ozet baslik="İşlem sayısı" deger={String(kayitlar.length)} />
        <Ozet baslik="Ödeme yapan öğrenci" deger={String(ogrenciBazli.size)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="kart overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
            İşlemler ({kayitlar.length})
          </h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Açıklama</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td className="whitespace-nowrap">{tarihBicim(k.tarih)}</td>
                  <td>
                    <Link
                      href={`/students/${k.student_id}`}
                      className="font-medium text-vurgu hover:underline"
                    >
                      {k.students?.ad_soyad ?? '—'}
                    </Link>
                  </td>
                  <td>{k.students?.sinif ?? '—'}</td>
                  <td className="text-solgun">{k.aciklama ?? '—'}</td>
                  <td className="text-right font-medium tabular-nums text-emerald-700">
                    {para(k.tutar)}
                  </td>
                </tr>
              ))}
              {kayitlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-solgun">
                    Bu aralıkta tahsilat yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="kart h-fit overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">Öğrenci Bazlı</h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th className="text-right">Adet</th>
                <th className="text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {ozetSatirlari.map(([id, o]) => (
                <tr key={id}>
                  <td>
                    <Link href={`/students/${id}`} className="text-vurgu hover:underline">
                      {o.ad}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums text-solgun">{o.adet}</td>
                  <td className="text-right font-medium tabular-nums">{para(o.tutar)}</td>
                </tr>
              ))}
              {ozetSatirlari.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-solgun">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

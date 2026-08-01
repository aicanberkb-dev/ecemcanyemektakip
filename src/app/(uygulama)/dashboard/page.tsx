import Link from 'next/link'

import { TarihAraligi } from '@/components/TarihAraligi'
import { ayBasiISO, bugunISO, para, tarih as tarihBicim } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { SerbestOgun, Transaction } from '@/lib/types'

export const metadata = { title: 'Özet — Yemek Takip' }

type SonIslem = Transaction & { students: { ad_soyad: string; ogrenci_no: string } | null }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const { bas: basQ, bit: bitQ } = await searchParams
  const bas = basQ || ayBasiISO()
  const bit = bitQ || bugunISO()

  const supabase = await supabaseServer()

  const [
    { data: islemler },
    { data: serbest },
    { count: aktifOgrenci },
    { data: sonIslemler },
  ] = await Promise.all([
    supabase.from('transactions').select('tip, tutar, ogun_abone_tipi').gte('tarih', bas).lte('tarih', bit),
    supabase.from('serbest_ogunler').select('tip, tutar').gte('tarih', bas).lte('tarih', bit),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('aktif', true),
    supabase
      .from('transactions')
      .select('*, students(ad_soyad, ogrenci_no)')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const hareketler = (islemler ?? []) as Pick<Transaction, 'tip' | 'tutar' | 'ogun_abone_tipi'>[]
  const serbestler = (serbest ?? []) as Pick<SerbestOgun, 'tip' | 'tutar'>[]

  const tahsilat = hareketler
    .filter((h) => h.tip === 'tahsilat')
    .reduce((t, h) => t + Number(h.tutar), 0)
  const harcama = hareketler
    .filter((h) => h.tip === 'harcama')
    .reduce((t, h) => t + Number(h.tutar), 0)
  const ogunSayisi = hareketler.filter((h) => h.ogun_abone_tipi !== null).length
  const ucretliTutar = serbestler
    .filter((s) => s.tip === 'ucretli')
    .reduce((t, s) => t + Number(s.tutar), 0)
  const ucretliAdet = serbestler.filter((s) => s.tip === 'ucretli').length
  const misafirAdet = serbestler.filter((s) => s.tip === 'misafir').length

  return (
    <div className="space-y-5">
      <h1 className="baslik">Özet</h1>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kart baslik="Tahsilat" deger={para(tahsilat)} renk="text-emerald-700" alt={`${bas} – ${bit}`} />
        <Kart baslik="Harcama (yemek)" deger={para(harcama)} alt={`${ogunSayisi} öğrenci öğünü`} />
        <Kart
          baslik="Ücretli öğün"
          deger={para(ucretliTutar)}
          alt={`${ucretliAdet} adet · ${misafirAdet} misafir`}
        />
        <Kart baslik="Aktif öğrenci" deger={String(aktifOgrenci ?? 0)} alt="kayıtlı" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <HizliBaglanti yol="/pos" ad="Yemekhane girişi" />
        <HizliBaglanti yol="/payments/new" ad="Tahsilat gir" />
        <HizliBaglanti yol="/reports/gun-sonu" ad="Gün sonu raporu" />
      </div>

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">Son İşlemler</h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Tip</th>
              <th>Açıklama</th>
              <th className="text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {((sonIslemler ?? []) as SonIslem[]).map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap">{tarihBicim(i.tarih)}</td>
                <td>
                  <Link
                    href={`/students/${i.student_id}`}
                    className="text-vurgu hover:underline"
                  >
                    {i.students?.ad_soyad ?? '—'}
                  </Link>
                </td>
                <td>
                  {i.tip === 'tahsilat' ? (
                    <span className="rozet bg-emerald-100 text-emerald-800">Tahsilat</span>
                  ) : (
                    <span className="rozet bg-slate-100 text-slate-700">
                      {i.ogun_abone_tipi ? 'Yemek' : 'Harcama'}
                    </span>
                  )}
                </td>
                <td className="text-solgun">{i.aciklama ?? '—'}</td>
                <td
                  className={`text-right font-medium tabular-nums ${
                    i.tip === 'tahsilat' ? 'text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {i.tip === 'tahsilat' ? '+' : '−'}
                  {para(i.tutar)}
                </td>
              </tr>
            ))}
            {(sonIslemler ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-solgun">
                  Henüz işlem yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kart({
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

function HizliBaglanti({ yol, ad }: { yol: string; ad: string }) {
  return (
    <Link href={yol} className="kart p-4 text-center font-medium text-vurgu hover:bg-blue-50">
      {ad} →
    </Link>
  )
}

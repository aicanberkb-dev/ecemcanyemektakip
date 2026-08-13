import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import { OGRENCI_TIPLERI, type TaksitPlani } from '@/lib/types'

import { KayitFormuCiktisi } from './KayitFormuCiktisi'

export const metadata = { title: 'Kayıt Formu — Yemek Takip' }

export default async function KayitFormuPage({
  searchParams,
}: {
  searchParams: Promise<{ sezon?: string }>
}) {
  const { sezon: sezonQ } = await searchParams
  const okul = await aktifOkul()
  if (!okul) return null

  const sezonListesi = await sezonlariGetir(okul.id)
  const sezon = sezonSec(sezonListesi, sezonQ)

  const supabase = await supabaseServer()
  const { data } = sezon
    ? await supabase
        .from('taksit_plani')
        .select('*')
        .eq('sezon_id', sezon.id)
        .order('vade_tarihi')
    : { data: null }

  const plan = (data ?? []) as TaksitPlani[]

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="yazdirma-gizle space-y-3">
        <Link href="/students" className="text-sm text-vurgu hover:underline">
          ← Öğrenciler
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="baslik">Kayıt Formu</h1>
            <p className="text-sm text-solgun">
              Veli kayda geldiğinde doldurulacak basılı form. Taksit tarihleri ve
              tutarları sistemdeki plandan gelir.
            </p>
          </div>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>

        {!sezon && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sezon tanımlı değil. Taksit planı olmadan form basılabilir ama plan tablosu
            boş görünür.{' '}
            <Link href="/admin/settings" className="underline">
              Ayarlar
            </Link>
            &apos;dan sezon ve taksit planı tanımlayın.
          </p>
        )}

        {sezon && plan.length === 0 && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>{sezon.ad}</strong> sezonunda hiç taksit tanımlı değil — formlardaki
            plan tabloları boş çıkar.{' '}
            <Link href="/admin/settings" className="underline">
              Taksit planını girin
            </Link>
            .
          </p>
        )}
      </div>

      <KayitFormuCiktisi
        okulAdi={okul.ad}
        sezonAdi={sezon?.ad ?? '—'}
        plan={plan}
        tipler={OGRENCI_TIPLERI}
      />
    </div>
  )
}

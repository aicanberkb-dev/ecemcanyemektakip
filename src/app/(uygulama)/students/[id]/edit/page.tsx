import Link from 'next/link'
import { notFound } from 'next/navigation'

import { supabaseServer } from '@/lib/supabase/server'
import type { Student } from '@/lib/types'

import { ogrenciGuncelle } from '../../actions'
import { OgrenciFormu } from '../../OgrenciFormu'

export const metadata = { title: 'Öğrenci Düzenle — Yemek Takip' }

export default async function OgrenciDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await supabaseServer()
  const { data } = await supabase.from('students').select('*').eq('id', id).maybeSingle()

  if (!data) notFound()
  const ogrenci = data as Student

  const eylem = ogrenciGuncelle.bind(null, id)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/students/${id}`} className="text-sm text-vurgu hover:underline">
        ← {ogrenci.ad_soyad}
      </Link>
      <h1 className="baslik">Öğrenci Düzenle</h1>
      <OgrenciFormu eylem={eylem} ogrenci={ogrenci} iptalYolu={`/students/${id}`} />
    </div>
  )
}

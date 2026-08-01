import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AboneRozeti } from '@/components/Rozetler'
import { AY_ADLARI, GUN_KISALTMA } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

export const metadata = { title: 'Devam Takvimi — Yemek Takip' }

export default async function DevamOgrenciPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ yil?: string }>
}) {
  const { id } = await params
  const { yil: yilQ } = await searchParams
  const yil = Number(yilQ) || new Date().getFullYear()

  const supabase = await supabaseServer()
  const [{ data: ogrenciVeri }, { data: kayitlar }] = await Promise.all([
    supabase.from('student_balances').select('*').eq('student_id', id).maybeSingle(),
    supabase
      .from('transactions')
      .select('tarih')
      .eq('student_id', id)
      .not('ogun_abone_tipi', 'is', null)
      .gte('tarih', `${yil}-01-01`)
      .lte('tarih', `${yil}-12-31`),
  ])

  if (!ogrenciVeri) notFound()
  const ogrenci = ogrenciVeri as StudentBalance

  const geldigiGunler = new Set((kayitlar ?? []).map((k) => k.tarih as string))

  // Yıl geneli hafta içi / geldiği gün sayısı
  let haftaIciToplam = 0
  for (let ay = 0; ay < 12; ay++) {
    const gunSayisi = new Date(yil, ay + 1, 0).getDate()
    for (let g = 1; g <= gunSayisi; g++) {
      const gun = new Date(yil, ay, g).getDay()
      if (gun !== 0 && gun !== 6) haftaIciToplam++
    }
  }
  const geldi = geldigiGunler.size

  return (
    <div className="space-y-4">
      <Link href="/reports/devam" className="text-sm text-vurgu hover:underline">
        ← Devam Çizelgesi
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ogrenci.ad_soyad}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-solgun">
            <span className="tabular-nums">{ogrenci.ogrenci_no}</span>
            {ogrenci.sinif && <span>· {ogrenci.sinif}</span>}
            <AboneRozeti tip={ogrenci.abone_tipi} />
          </p>
        </div>
        <form className="flex items-end gap-2">
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
          <button className="btn-birincil">Göster</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Geldiği gün" deger={String(geldi)} renk="text-emerald-700" />
        <Ozet baslik="Gelmediği hafta içi gün" deger={String(Math.max(0, haftaIciToplam - geldi))} />
        <Ozet baslik="Yıl içi hafta içi gün" deger={String(haftaIciToplam)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AY_ADLARI.map((adi, ayIndex) => (
          <AyTakvimi
            key={adi}
            yil={yil}
            ayIndex={ayIndex}
            baslik={adi}
            geldigiGunler={geldigiGunler}
          />
        ))}
      </div>
    </div>
  )
}

function AyTakvimi({
  yil,
  ayIndex,
  baslik,
  geldigiGunler,
}: {
  yil: number
  ayIndex: number
  baslik: string
  geldigiGunler: Set<string>
}) {
  const gunSayisi = new Date(yil, ayIndex + 1, 0).getDate()
  // Pazartesi = 0 olacak şekilde kaydır
  const ilkGun = (new Date(yil, ayIndex, 1).getDay() + 6) % 7
  const hucreler: (number | null)[] = [
    ...Array<null>(ilkGun).fill(null),
    ...Array.from({ length: gunSayisi }, (_, i) => i + 1),
  ]

  const iso = (gun: number) =>
    `${yil}-${String(ayIndex + 1).padStart(2, '0')}-${String(gun).padStart(2, '0')}`

  const ayGeldi = Array.from({ length: gunSayisi }, (_, i) => i + 1).filter((g) =>
    geldigiGunler.has(iso(g)),
  ).length

  return (
    <div className="kart p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{baslik}</h3>
        <span className="text-xs text-solgun">{ayGeldi} gün</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {GUN_KISALTMA.map((g) => (
          <div key={g} className="py-1 font-medium text-solgun">
            {g}
          </div>
        ))}
        {hucreler.map((gun, i) => {
          if (gun === null) return <div key={`bos-${i}`} />
          const haftaSonu = i % 7 >= 5
          const geldi = geldigiGunler.has(iso(gun))
          return (
            <div
              key={gun}
              className={`rounded py-1 tabular-nums ${
                geldi
                  ? 'bg-emerald-500 font-semibold text-white'
                  : haftaSonu
                    ? 'text-slate-300'
                    : 'text-slate-600'
              }`}
            >
              {gun}
            </div>
          )
        })}
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

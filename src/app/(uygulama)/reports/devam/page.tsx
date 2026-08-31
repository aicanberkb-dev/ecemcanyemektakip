import Link from 'next/link'

import { AY_ADLARI } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { DevamSatiri } from '@/lib/types'

import { DevamTablosu } from './DevamTablosu'

export const metadata = { title: 'Devam Çizelgesi — Yemek Takip' }

export default async function DevamPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const iki = (n: number) => String(n).padStart(2, '0')
  const ayBas = `${yil}-${iki(ay)}-01`
  const ayBit = `${yil}-${iki(ay)}-${new Date(yil, ay, 0).getDate()}`

  const [{ data, error }, { data: sinifSatirlari }, { data: tatilVeri }] = await Promise.all([
    supabase.rpc('devam_cizelgesi', { p_okul_id: okul.id, p_yil: yil, p_ay: ay }),
    supabase.from('students').select('sinif').eq('okul_id', okul.id).not('sinif', 'is', null),
    // Tatil günleri sayımdan muaf: o gün gelmemek devamsızlık değil
    supabase
      .from('okulsuz_gunler')
      .select('tarih, sebep')
      .is('hizmet_noktasi_id', null)
      .gte('tarih', ayBas)
      .lte('tarih', ayBit),
  ])

  // Ay ve yıl sunucudan gelir (veriyi onlar belirler); sınıf ve arama
  // tablonun içinde, yazdıkça süzülecek şekilde çalışır.
  const satirlar = (data ?? []) as DevamSatiri[]

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  const gunSayisi = new Date(yil, ay, 0).getDate()
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1)
  const tatilGunleri = new Set(
    ((tatilVeri ?? []) as { tarih: string }[]).map((t) => Number(t.tarih.slice(8, 10))),
  )
  const kapaliGunler = gunler.filter((gun) => {
    const g = new Date(yil, ay - 1, gun).getDay()
    return g === 0 || g === 6 || tatilGunleri.has(gun)
  })
  const dersGunuSayisi = gunSayisi - kapaliGunler.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="baslik">
            Devam Çizelgesi — {AY_ADLARI[ay - 1]} {yil}
          </h1>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>
        <p className="text-sm text-solgun">
          Ayda {dersGunuSayisi} ders günü · hafta sonu ve tatiller sayıma dahil değil          {tatilGunleri.size > 0 && ` (${tatilGunleri.size} tatil günü)`}
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
        <button className="btn-birincil">Göster</button>
        <Link href="/reports/devam" className="btn-ikincil">
          Bu ay
        </Link>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <DevamTablosu
        satirlar={satirlar}
        siniflar={siniflar}
        yil={yil}
        gunler={gunler}
        kapaliGunler={kapaliGunler}
      />
    </div>
  )
}

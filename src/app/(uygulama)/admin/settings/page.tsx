import { para } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { AppSettings, TaksitPlani } from '@/lib/types'

import { TaksitPlaniBolumu } from './TaksitPlaniBolumu'
import { UcretFormu } from './UcretFormu'

export const metadata = { title: 'Ayarlar — Yemek Takip' }

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string }>
}) {
  const { yil: yilQ } = await searchParams
  const yil = Number(yilQ) || new Date().getFullYear()

  const supabase = await supabaseServer()
  const [{ data: ayarVeri }, { data: planVeri }] = await Promise.all([
    supabase.from('app_settings').select('*').limit(1).maybeSingle(),
    supabase.from('taksit_plani').select('*').eq('yil', yil).order('vade_tarihi'),
  ])

  const ayar = ayarVeri as AppSettings | null
  const plan = (planVeri ?? []) as TaksitPlani[]

  return (
    <div className="space-y-5">
      <h1 className="baslik">Ayarlar</h1>

      <section className="kart p-6">
        <h2 className="mb-1 font-semibold">Ücretler</h2>
        <p className="mb-4 text-sm text-solgun">
          Yemek fiyatları burada tanımlanır ve sunucuda hesaplanır — kasa ekranından
          değiştirilemez.
        </p>
        {ayar ? (
          <UcretFormu ayar={ayar} />
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Ayar satırı bulunamadı. Migration&apos;ların uygulandığından emin olun.
          </p>
        )}
      </section>

      <section className="kart p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Aylıkçı Taksit Planı — {yil}</h2>
            <p className="text-sm text-solgun">
              Aylıkçı öğrencilerin yıllık ücreti bu vadelere göre takip edilir.
            </p>
          </div>
          <form className="flex items-end gap-2">
            <div>
              <label className="etiket text-xs" htmlFor="yil">
                Yıl
              </label>
              <input
                id="yil"
                type="number"
                name="yil"
                defaultValue={yil}
                min={2000}
                max={2100}
                className="girdi !py-1.5 w-28"
              />
            </div>
            <button className="btn-ikincil !py-1.5">Göster</button>
          </form>
        </div>

        <TaksitPlaniBolumu yil={yil} plan={plan} />
      </section>

      {ayar && (
        <p className="text-xs text-solgun">
          Örnek: taban {para(ayar.taban_gunluk_ucret)} olan bir öğrencinin %10 iskontosu
          varsa efektif ücreti{' '}
          {para(Number(ayar.taban_gunluk_ucret) * 0.9)} olur.
        </p>
      )}
    </div>
  )
}

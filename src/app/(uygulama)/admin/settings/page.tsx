import { SezonUyarisi } from '@/components/SezonUyarisi'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { AppSettings, TaksitPlani, UcretGecmisi } from '@/lib/types'

import { OkulAdiFormu } from './OkulAdiFormu'
import { SezonBolumu } from './SezonBolumu'
import { TaksitPlaniBolumu } from './TaksitPlaniBolumu'
import { UcretGecmisiBolumu } from './UcretGecmisiBolumu'

export const metadata = { title: 'Ayarlar — Yemek Takip' }

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sezon?: string }>
}) {
  const { sezon: sezonQ } = await searchParams

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const liste = await sezonlariGetir(okul.id)
  const sezon = sezonSec(liste, sezonQ)

  const [{ data: ayarVeri }, { data: planVeri }, { data: tarifeVeri }] = await Promise.all([
    supabase.from('app_settings').select('*').eq('okul_id', okul.id).maybeSingle(),
    sezon
      ? supabase
          .from('taksit_plani')
          .select('*')
          .eq('sezon_id', sezon.id)
          .order('vade_tarihi')
      : Promise.resolve({ data: null }),
    supabase
      .from('ucret_gecmisi')
      .select('*')
      .eq('okul_id', okul.id)
      .order('gecerli_baslangic', { ascending: false }),
  ])

  const ayar = ayarVeri as AppSettings | null
  const plan = (planVeri ?? []) as TaksitPlani[]
  const tarifeler = (tarifeVeri ?? []) as UcretGecmisi[]
  const bugun = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Ayarlar</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Bu sayfadaki ücretler, sezonlar ve taksit planı yalnızca{' '}
        <strong>{okul.ad}</strong> için geçerlidir. Diğer okulun ayarları için üst bardan
        okulu değiştirin.
      </p>

      <section className="kart p-6">
        <h2 className="mb-1 font-semibold">Okul</h2>
        <p className="mb-4 text-sm text-solgun">
          Üst bardaki seçicide ve raporlarda görünen ad.
        </p>
        <OkulAdiFormu okulId={okul.id} ad={okul.ad} />
      </section>

      <section className="kart p-6">
        <h2 className="mb-1 font-semibold">Ücret Tarifeleri</h2>
        <p className="mb-4 text-sm text-solgun">
          Yemek fiyatları burada tanımlanır ve sunucuda hesaplanır — kasa ekranından
          değiştirilemez.
        </p>
        <UcretGecmisiBolumu tarifeler={tarifeler} bugun={bugun} />
      </section>

      <section className="kart p-6">
        <h2 className="mb-1 font-semibold">Sezonlar</h2>
        <SezonBolumu sezonlar={liste} />
      </section>

      <section className="kart p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              Aylıkçı Taksit Planı{sezon ? ` — ${sezon.ad}` : ''}
            </h2>
            {sezon && (
              <p className="text-sm text-solgun">
                {tarihBicim(sezon.baslangic)} – {tarihBicim(sezon.bitis)} arası
              </p>
            )}
          </div>
          {liste.length > 1 && (
            <form className="flex items-end gap-2">
              <div>
                <label className="etiket text-xs" htmlFor="sezon">
                  Sezon
                </label>
                <select
                  id="sezon"
                  name="sezon"
                  defaultValue={sezon?.id ?? ''}
                  className="girdi !py-1.5"
                >
                  {liste.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-ikincil !py-1.5">Göster</button>
            </form>
          )}
        </div>

        {sezon ? (
          <>
            <div className="mb-4">
              <SezonUyarisi sezon={sezon} plan={plan} />
            </div>
            <TaksitPlaniBolumu
              key={sezon.id}
              sezonId={sezon.id}
              sezonAdi={sezon.ad}
              plan={plan}
            />
          </>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Taksit planı girebilmek için önce yukarıdan bir sezon ekleyin.
          </p>
        )}
      </section>

      {ayar && Number(ayar.taban_gunluk_ucret) > 0 && (
        <p className="text-xs text-solgun">
          Örnek: taban {para(ayar.taban_gunluk_ucret)} olan bir öğrencinin %10 iskontosu
          varsa efektif ücreti {para(Number(ayar.taban_gunluk_ucret) * 0.9)} olur.
        </p>
      )}
    </div>
  )
}

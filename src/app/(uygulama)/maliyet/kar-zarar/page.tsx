import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI, para, tarih as tarihBicim } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

import { Sekmeler } from '../Sekmeler'

import { KisiSayisiEkrani, type GunMaliyeti, type GunlukKisi } from './KisiSayisiEkrani'

export const metadata = { title: 'Kâr / Zarar — Yemek Takip' }

type KarZarar = {
  hizmet_noktasi: string
  gun_sayisi: number
  toplam_kisi: number
  ciro: number | string
  maliyet: number | string
  kar: number | string
  kisi_basi_kar: number | string
}

type Nokta = { id: string; ad: string; liste_id: string | null }

function ayAralik(yil: number, ay: number) {
  return {
    bas: `${yil}-${String(ay).padStart(2, '0')}-01`,
    bit: `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`,
  }
}

export default async function KarZararPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; nokta?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1
  const { bas, bit } = ayAralik(yil, ay)

  const supabase = await supabaseServer()

  const [{ data: raporVeri }, { data: noktaVeri }] = await Promise.all([
    supabase.rpc('kar_zarar', { p_bas: bas, p_bit: bit }),
    supabase.from('hizmet_noktalari').select('id, ad, liste_id').eq('aktif', true).order('sira'),
  ])

  const rapor = (raporVeri ?? []) as KarZarar[]
  const noktalar = (noktaVeri ?? []) as Nokta[]

  const secili = noktalar.find((n) => n.id === q.nokta) ?? noktalar[0] ?? null

  // Seçili yerin o ayki kişi sayıları ve günlük menü maliyeti
  const [{ data: kisiVeri }, { data: maliyetVeri }] = await Promise.all([
    secili
      ? supabase
          .from('gunluk_hizmet')
          .select('tarih, kisi_sayisi')
          .eq('hizmet_noktasi_id', secili.id)
          .gte('tarih', bas)
          .lte('tarih', bit)
      : Promise.resolve({ data: null }),
    secili?.liste_id
      ? supabase.rpc('ay_menu_maliyeti', { p_liste_id: secili.liste_id, p_bas: bas, p_bit: bit })
      : Promise.resolve({ data: null }),
  ])

  const kisiler = (kisiVeri ?? []) as GunlukKisi[]
  const gunMaliyetleri = (maliyetVeri ?? []) as GunMaliyeti[]

  const toplam = rapor.reduce(
    (t, r) => ({
      kisi: t.kisi + Number(r.toplam_kisi),
      ciro: t.ciro + Number(r.ciro),
      maliyet: t.maliyet + Number(r.maliyet),
      kar: t.kar + Number(r.kar),
    }),
    { kisi: 0, ciro: 0, maliyet: 0, kar: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle">
        <h1 className="baslik">Kâr / Zarar</h1>
        <p className="text-sm text-solgun">
          Ciro = kişi sayısı × satış fiyatı. Maliyet = kişi sayısı × o günkü menünün
          reçete maliyeti.
        </p>
      </div>

      <div className="yazdirma-gizle">
        <Sekmeler />
      </div>

      <div className="kart yazdirma-gizle flex flex-wrap items-end gap-3 p-4">
        <form className="flex flex-wrap items-end gap-2">
          {secili && <input type="hidden" name="nokta" value={secili.id} />}
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
        </form>
        <YazdirButonu />
      </div>

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
          {AY_ADLARI[ay - 1]} {yil} — {tarihBicim(bas)} / {tarihBicim(bit)}
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Hizmet Yeri</th>
              <th className="text-right">Gün</th>
              <th className="text-right">Toplam Kişi</th>
              <th className="text-right">Ciro</th>
              <th className="text-right">Maliyet</th>
              <th className="text-right">Kâr / Zarar</th>
              <th className="text-right">Kişi Başı</th>
            </tr>
          </thead>
          <tbody>
            {rapor.map((r) => (
              <tr key={r.hizmet_noktasi}>
                <td className="font-medium">{r.hizmet_noktasi}</td>
                <td className="text-right tabular-nums">{r.gun_sayisi}</td>
                <td className="text-right tabular-nums">{r.toplam_kisi}</td>
                <td className="text-right tabular-nums">{para(r.ciro)}</td>
                <td className="text-right tabular-nums">{para(r.maliyet)}</td>
                <td
                  className={`text-right font-semibold tabular-nums ${
                    Number(r.kar) < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {para(r.kar)}
                </td>
                <td className="text-right tabular-nums">{para(r.kisi_basi_kar)}</td>
              </tr>
            ))}
            {rapor.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  Bu ayda kişi sayısı girilmemiş. Aşağıdan girin.
                </td>
              </tr>
            )}
          </tbody>
          {rapor.length > 0 && (
            <tfoot>
              <tr>
                <td className="font-semibold">Toplam</td>
                <td />
                <td className="text-right font-semibold tabular-nums">{toplam.kisi}</td>
                <td className="text-right font-semibold tabular-nums">{para(toplam.ciro)}</td>
                <td className="text-right font-semibold tabular-nums">{para(toplam.maliyet)}</td>
                <td
                  className={`text-right font-bold tabular-nums ${
                    toplam.kar < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {para(toplam.kar)}
                </td>
                <td className="text-right font-semibold tabular-nums">
                  {toplam.kisi > 0 ? para(toplam.kar / toplam.kisi) : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {noktalar.length === 0 ? (
        <p className="yazdirma-gizle rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hizmet yeri tanımlı değil.{' '}
          <Link href="/maliyet/yerler" className="underline">
            Hizmet Yerleri
          </Link>{' '}
          sekmesinden ekleyin.
        </p>
      ) : (
        secili && (
          <div className="yazdirma-gizle space-y-3">
            <div className="flex flex-wrap gap-2">
              {noktalar.map((n) => (
                <Link
                  key={n.id}
                  href={`/maliyet/kar-zarar?nokta=${n.id}&yil=${yil}&ay=${ay}`}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    n.id === secili.id
                      ? 'border-vurgu bg-vurgu font-semibold text-white'
                      : 'border-cizgi bg-white hover:bg-slate-50'
                  }`}
                >
                  {n.ad}
                </Link>
              ))}
            </div>

            <KisiSayisiEkrani
              key={`${secili.id}-${yil}-${ay}`}
              noktaId={secili.id}
              noktaAdi={secili.ad}
              listesizMi={!secili.liste_id}
              yil={yil}
              ay={ay}
              kisiler={kisiler}
              gunMaliyetleri={gunMaliyetleri}
            />
          </div>
        )
      )}
    </div>
  )
}

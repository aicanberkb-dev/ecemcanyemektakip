import Link from 'next/link'

import { DonemSecici } from '@/components/DonemSecici'
import { YazdirButonu } from '@/components/Yazdir'
import { donemCoz, donemParametreleri } from '@/lib/donem'
import { AY_ADLARI, para, tarih as tarihBicim } from '@/lib/format'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import type { OkulsuzGun } from '../../okulsuz-actions'

import {
  PorsiyonEkrani,
  type GunKalemleri,
  type GunlukCikan,
  type GunlukKisi,
  type OkulGunu,
  type AyGideri,
  type SatisFiyati,
} from './PorsiyonEkrani'

export const metadata = { title: 'Kâr / Zarar — Yemek Takip' }

type KarZarar = {
  hizmet_noktasi: string
  kaynak: 'okul' | 'manuel'
  gun_sayisi: number
  /** Ayın açık iş günü sayısı — genel giderin bölündüğü sayı */
  is_gunu: number
  toplam_kisi: number
  misafir: number
  cikan_porsiyon: number
  ciro: number | string
  malzeme_maliyeti: number | string
  genel_gider: number | string
  toplam_maliyet: number | string
  kar: number | string
  kisi_basi_maliyet: number | string
  kisi_basi_kar: number | string
  cikansiz_gun: number
}

type Nokta = {
  id: string
  ad: string
  liste_id: string | null
  okul_id: string | null
  varsayilan_kisi_sayisi: number
  varsayilan_cikan_porsiyon: number
}

export default async function KarZararPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; bas?: string; bit?: string; nokta?: string }>
}) {
  const q = await searchParams
  const donem = donemCoz(q)
  const { bas, bit, yil, ay } = donem

  // Aralık iki ayı kapsayabilir; genel gider aylık tanımlandığı için her ayın
  // günlük payı ayrı hesaplanır.
  const aylar: { yil: number; ay: number }[] = []
  for (
    let d = new Date(Number(bas.slice(0, 4)), Number(bas.slice(5, 7)) - 1, 1);
    d <= new Date(Number(bit.slice(0, 4)), Number(bit.slice(5, 7)) - 1, 1);
    d.setMonth(d.getMonth() + 1)
  ) {
    aylar.push({ yil: d.getFullYear(), ay: d.getMonth() + 1 })
  }

  const supabase = await supabaseServer()

  const [{ data: raporVeri }, { data: noktaVeri }] = await Promise.all([
    supabase.rpc('kar_zarar', { p_bas: bas, p_bit: bit, p_bugun: await bugunSunucu() }),
    supabase
      .from('hizmet_noktalari')
      .select('id, ad, liste_id, okul_id, varsayilan_kisi_sayisi, varsayilan_cikan_porsiyon')
      .eq('aktif', true)
      .order('sira'),
  ])

  const rapor = (raporVeri ?? []) as KarZarar[]
  const noktalar = (noktaVeri ?? []) as Nokta[]

  const secili = noktalar.find((n) => n.id === q.nokta) ?? noktalar[0] ?? null

  // Seçili yerin o ayki verileri: okula bağlıysa yiyen gün sonundan gelir
  const [
    { data: kisiVeri },
    { data: kalemVeri },
    { data: okulVeri },
    { data: cikanVeri },
    { data: fiyatVeri },
    { data: giderVeri },
    { data: okulsuzVeri },
  ] = await Promise.all([
      secili
        ? supabase
            .from('gunluk_hizmet')
            .select('tarih, kisi_sayisi')
            .eq('hizmet_noktasi_id', secili.id)
            .gte('tarih', bas)
            .lte('tarih', bit)
        : Promise.resolve({ data: null }),
      secili?.liste_id
        ? supabase.rpc('ay_menu_kalemleri', {
            p_liste_id: secili.liste_id,
            p_bas: bas,
            p_bit: bit,
          })
        : Promise.resolve({ data: null }),
      secili?.okul_id
        ? supabase.rpc('okul_gunluk_ozet', { p_okul_id: secili.okul_id, p_bas: bas, p_bit: bit })
        : Promise.resolve({ data: null }),
      secili
        ? supabase
            .from('gunluk_cikan')
            .select('tarih, yemek_adi, porsiyon')
            .eq('hizmet_noktasi_id', secili.id)
            .gte('tarih', bas)
            .lte('tarih', bit)
        : Promise.resolve({ data: null }),
      // Dış hizmet yerlerinin günlük cirosu bu tarihli fiyatlardan çıkar
      secili && !secili.okul_id
        ? supabase
            .from('hizmet_fiyatlari')
            .select('gecerli_baslangic, kisi_basi_fiyat')
            .eq('hizmet_noktasi_id', secili.id)
            .order('gecerli_baslangic', { ascending: false })
        : Promise.resolve({ data: null }),
      // Günlük genel gider payı: gün satırlarında malzemenin üstüne eklenir
      secili
        ? Promise.all(
            aylar.map(async (a) => {
              const { data } = await supabase.rpc('aylik_gider_ozeti', {
                p_nokta_id: secili.id,
                p_yil: a.yil,
                p_ay: a.ay,
              })
              const o = (data ?? [])[0]
              return {
                anahtar: `${a.yil}-${String(a.ay).padStart(2, '0')}`,
                toplam: Number(o?.toplam ?? 0),
                hizmetGunu: Number(o?.hizmet_gunu ?? 0),
                gunlukGider: Number(o?.gunluk_gider ?? 0),
              }
            }),
          ).then((data) => ({ data }))
        : Promise.resolve({ data: null }),
      // Kapalı günler: bu yere özel geziler + tüm yerleri kapatan resmi tatiller
      secili
        ? supabase
            .from('okulsuz_gunler')
            .select('id, tarih, hizmet_noktasi_id, sebep')
            .or(`hizmet_noktasi_id.is.null,hizmet_noktasi_id.eq.${secili.id}`)
            .gte('tarih', bas)
            .lte('tarih', bit)
            .order('tarih')
        : Promise.resolve({ data: null }),
    ])

  const okulsuz = (okulsuzVeri ?? []) as OkulsuzGun[]
  const kisiler = (kisiVeri ?? []) as GunlukKisi[]
  const kalemler = (kalemVeri ?? []) as GunKalemleri[]
  const okulGunleri = (okulVeri ?? []) as OkulGunu[]
  const cikanlar = (cikanVeri ?? []) as GunlukCikan[]
  const fiyatlar = (fiyatVeri ?? []) as SatisFiyati[]
  const giderler = (giderVeri ?? []) as AyGideri[]

  const toplam = rapor.reduce(
    (t, r) => ({
      kisi: t.kisi + Number(r.toplam_kisi),
      misafir: t.misafir + Number(r.misafir),
      cikan: t.cikan + Number(r.cikan_porsiyon),
      ciro: t.ciro + Number(r.ciro),
      malzeme: t.malzeme + Number(r.malzeme_maliyeti),
      gider: t.gider + Number(r.genel_gider),
      maliyet: t.maliyet + Number(r.toplam_maliyet),
      kar: t.kar + Number(r.kar),
    }),
    { kisi: 0, misafir: 0, cikan: 0, ciro: 0, malzeme: 0, gider: 0, maliyet: 0, kar: 0 },
  )

  const cikansizGun = rapor.reduce((t, r) => t + Number(r.cikansiz_gun), 0)

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle">
        <h1 className="baslik">Kâr / Zarar</h1>
        <p className="text-sm text-solgun">
          <strong>Maliyet = malzeme + genel gider.</strong> Malzeme, yemekhaneden çıkan porsiyondan hesaplanır — her yemek
          kendi porsiyonuyla: aynı gün 50 kişilik ıspanak, 100 kişilik tatlı çıkabilir.
          Ciro yiyen/faturalanan kişiden gelir; okullarda yiyen sayısı gün sonundan, fiyat
          ücret tarifesinden okunur.
        </p>
      </div>

      {cikansizGun > 0 && (
        <p className="yazdirma-gizle rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{cikansizGun}</strong> günün çıkan porsiyonu girilmemiş; o günlerde
          maliyet yiyen kişiden hesaplandı, yani <strong>israf hiç görünmüyor</strong> ve kâr
          olduğundan yüksek. Her yer için bir kez{' '}
          <Link href="/maliyet/yerler" className="underline">
            çıkan porsiyon
          </Link>{' '}
          tanımlayın, yemek bazında farklı olanı aşağıdan düzeltin.
        </p>
      )}

      <DonemSecici
        donem={donem}
        temizleYolu={`/maliyet/kar-zarar${secili ? `?nokta=${secili.id}` : ''}`}
        ekstra={{ nokta: secili?.id }}
        sag={<YazdirButonu />}
      />

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
          {donem.ozel ? 'Seçili aralık' : `${AY_ADLARI[ay - 1]} ${yil}`} —{' '}
          {tarihBicim(bas)} / {tarihBicim(bit)}
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Hizmet Yeri</th>
              <th className="text-right">İş Günü</th>
              <th className="text-right">Hizmet Günü</th>
              <th className="text-right">Çıkan Porsiyon</th>
              <th className="text-right">Yiyen (misafir)</th>
              <th className="text-right">Ciro</th>
              <th className="text-right">Malzeme</th>
              <th className="text-right">Genel Gider</th>
              <th className="text-right">Toplam Maliyet</th>
              <th className="text-right">Kâr / Zarar</th>
              <th className="text-right">Kişi Başı Maliyet</th>
            </tr>
          </thead>
          <tbody>
            {rapor.map((r) => (
              <tr key={r.hizmet_noktasi}>
                <td className="font-medium">
                  {r.hizmet_noktasi}
                  <span
                    className={`rozet ml-2 ${
                      r.kaynak === 'okul'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {r.kaynak === 'okul' ? 'otomatik' : 'elle'}
                  </span>
                </td>
                <td className="text-right tabular-nums text-violet-700" title="Hafta içi, okulun açık olduğu gün sayısı — genel gider buna bölünür">
                  {r.is_gunu}
                </td>
                <td
                  className="text-right tabular-nums"
                  title="Gerçekten yemek çıkan / yiyen olan gün sayısı"
                >
                  {r.gun_sayisi}
                  {r.is_gunu > r.gun_sayisi && (
                    <span className="ml-1 text-xs text-solgun">
                      ({r.is_gunu - r.gun_sayisi} boş)
                    </span>
                  )}
                </td>
                <td className="text-right font-semibold tabular-nums">
                  {r.cikan_porsiyon}
                  {r.cikansiz_gun > 0 && (
                    <span
                      className="ml-1 text-amber-700"
                      title={`${r.cikansiz_gun} günün çıkanı girilmemiş`}
                    >
                      ?
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {r.toplam_kisi}
                  {r.misafir > 0 && <span className="text-solgun"> ({r.misafir})</span>}
                </td>
                <td className="text-right tabular-nums">{para(r.ciro)}</td>
                <td className="text-right tabular-nums">{para(r.malzeme_maliyeti)}</td>
                <td className="text-right tabular-nums text-violet-700">
                  {para(r.genel_gider)}
                </td>
                <td className="text-right font-semibold tabular-nums">
                  {para(r.toplam_maliyet)}
                </td>
                <td
                  className={`text-right font-semibold tabular-nums ${
                    Number(r.kar) < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {para(r.kar)}
                </td>
                <td className="text-right tabular-nums">{para(r.kisi_basi_maliyet)}</td>
              </tr>
            ))}
            {rapor.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-solgun">
                  Bu ayda hesaplanacak veri yok.
                </td>
              </tr>
            )}
          </tbody>
          {rapor.length > 0 && (
            <tfoot>
              <tr>
                <td className="font-semibold">Toplam</td>
                <td />
                <td />
                <td className="text-right font-semibold tabular-nums">{toplam.cikan}</td>
                <td className="text-right font-semibold tabular-nums">
                  {toplam.kisi}
                  {toplam.misafir > 0 && (
                    <span className="font-normal text-solgun"> ({toplam.misafir})</span>
                  )}
                </td>
                <td className="text-right font-semibold tabular-nums">{para(toplam.ciro)}</td>
                <td className="text-right font-semibold tabular-nums">{para(toplam.malzeme)}</td>
                <td className="text-right font-semibold tabular-nums text-violet-700">
                  {para(toplam.gider)}
                </td>
                <td className="text-right font-semibold tabular-nums">{para(toplam.maliyet)}</td>
                <td
                  className={`text-right font-bold tabular-nums ${
                    toplam.kar < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {para(toplam.kar)}
                </td>
                <td className="text-right font-semibold tabular-nums">
                  {toplam.kisi > 0 ? para(toplam.maliyet / toplam.kisi) : '—'}
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
                  href={`/maliyet/kar-zarar?nokta=${n.id}&${donemParametreleri(donem)}`}
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

            <PorsiyonEkrani
              key={`${secili.id}-${yil}-${ay}`}
              noktaId={secili.id}
              noktaAdi={secili.ad}
              okulaBagliMi={!!secili.okul_id}
              varsayilanKisi={secili.varsayilan_kisi_sayisi}
              varsayilanCikan={secili.varsayilan_cikan_porsiyon}
              listesizMi={!secili.liste_id}
              bas={bas}
              bit={bit}
              kisiler={kisiler}
              kalemler={kalemler}
              cikanlar={cikanlar}
              okulGunleri={okulGunleri}
              fiyatlar={fiyatlar}
              giderler={giderler}
              okulsuz={okulsuz}
            />
          </div>
        )
      )}
    </div>
  )
}

import { TarihAraligi } from '@/components/TarihAraligi'
import { ayBasiISO, saat, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { KayitsizOgun } from '@/lib/types'

import { IsaretButonu } from './IsaretButonu'

export const metadata = { title: 'Kayıtsız Öğrenciler — Yemek Takip' }

/**
 * Sisteme kayıtlı olmadan yemek yiyen öğrenciler.
 *
 * Yemekhanede adı yazılıp geçilen çocuklar burada gün gün duruyor. Ücret
 * tahsil edilmediği için takip elle yapılıyor: velisiyle görüşüldü mü,
 * ücreti alındı mı. İşaretler yalnızca bu raporda anlam taşır; öğün
 * kaydına ya da kasaya dokunmaz.
 */
export default async function KayitsizPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const { bas: basQ, bit: bitQ } = await searchParams
  const bas = basQ || ayBasiISO()
  const bit = bitQ || (await bugunSunucu())

  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('kayitsiz_ogunler')
    .select('*')
    .eq('okul_id', okul.id)
    .gte('tarih', bas)
    .lte('tarih', bit)
    .order('tarih', { ascending: false })
    .order('created_at', { ascending: false })

  const satirlar = (data ?? []) as KayitsizOgun[]

  const bekleyenVeli = satirlar.filter((s) => !s.veli_arandi).length
  const bekleyenUcret = satirlar.filter((s) => !s.ucret_alindi).length

  // Aynı çocuk birden fazla gün gelmiş olabilir; kaç ayrı isim var
  const kisiSayisi = new Set(satirlar.map((s) => s.ad_soyad)).size

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Kayıtsız Öğrenciler</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <p className="text-sm text-solgun">
        Sisteme kaydı olmadan yemekhaneye gelen öğrenciler. Yemek yiyen sayısına
        dahiller ama <strong>ücret tahsil edilmedi</strong>. Aşağıdaki işaretler
        yalnızca burada durur; yemekhane ekranını ya da kasayı değiştirmez.
      </p>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/kayitsiz" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Öğün kaydı" deger={String(satirlar.length)} alt={`${kisiSayisi} ayrı isim`} />
        <Ozet
          baslik="Velisi aranmadı"
          deger={String(bekleyenVeli)}
          renk={bekleyenVeli > 0 ? 'text-amber-700' : 'text-emerald-700'}
        />
        <Ozet
          baslik="Ücreti alınmadı"
          deger={String(bekleyenUcret)}
          renk={bekleyenUcret > 0 ? 'text-red-600' : 'text-emerald-700'}
        />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>Not</th>
              <th className="text-right">Veli</th>
              <th className="text-right">Ücret</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.id} className={s.ucret_alindi ? undefined : 'bg-amber-50/40'}>
                <td className="whitespace-nowrap">
                  {tarihBicim(s.tarih)}
                  <span className="block text-xs text-solgun">
                    {saat(s.created_at)}
                  </span>
                </td>
                <td className="font-medium">{s.ad_soyad}</td>
                <td>{s.sinif ?? '—'}</td>
                <td className="text-solgun">{s.aciklama ?? '—'}</td>
                <td className="text-right">
                  <IsaretButonu
                    id={s.id}
                    alan="veli_arandi"
                    deger={s.veli_arandi}
                    acikAd="İletişime geçildi"
                    kapaliAd="Veliyle iletişime geçildi"
                  />
                </td>
                <td className="text-right">
                  <IsaretButonu
                    id={s.id}
                    alan="ucret_alindi"
                    deger={s.ucret_alindi}
                    acikAd="Ücreti alındı"
                    kapaliAd="Ücreti alındı"
                  />
                </td>
              </tr>
            ))}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  Bu aralıkta kayıtsız öğrenci öğünü yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Ozet({
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

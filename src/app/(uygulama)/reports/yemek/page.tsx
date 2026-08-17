import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Yemek Katılımı — Yemek Takip' }

type Satir = {
  ana_yemek: string
  gun_sayisi: number
  toplam_ogun: number
  ortalama: number
}

/**
 * Hangi yemekte kaç kişi geliyor.
 *
 * Menüdeki ana yemek ile o günün öğün sayısı eşleştirilir. Menü girilmemiş
 * günler hesaba katılmaz; yemek girildikçe tablo anlamlanır.
 */
export default async function YemekKatilimiPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('yemek_katilimi', { p_okul_id: okul.id })
  const satirlar = (data ?? []) as Satir[]

  const genelOrtalama =
    satirlar.length > 0
      ? satirlar.reduce((t, s) => t + s.toplam_ogun, 0) /
        satirlar.reduce((t, s) => t + s.gun_sayisi, 0)
      : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Yemek Katılımı</h1>
          <p className="text-sm text-solgun">
            Ana yemeğe göre ortalama katılım. Menü girilen günler hesaba katılır.
          </p>
        </div>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      {satirlar.length === 0 ? (
        <div className="kart p-6 text-center">
          <p className="text-solgun">
            Henüz hesaplanacak veri yok. Menü girilen ve yemek kaydı olan günler
            biriktikçe burası dolar.
          </p>
          <Link href="/menu" className="btn-birincil mt-3">
            Yemek listesine git
          </Link>
        </div>
      ) : (
        <>
          <div className="kart p-4 text-sm">
            <strong>{satirlar.length}</strong> farklı ana yemek ·{' '}
            <strong>{genelOrtalama.toFixed(1)}</strong> kişi genel ortalama
          </div>

          <div className="kart overflow-x-auto">
            <table className="tablo">
              <thead>
                <tr>
                  <th>Ana Yemek</th>
                  <th className="text-right">Kaç gün</th>
                  <th className="text-right">Toplam öğün</th>
                  <th className="text-right">Ortalama katılım</th>
                  <th>Genel ortalamaya göre</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => {
                  const fark = Number(s.ortalama) - genelOrtalama
                  const yuzde = genelOrtalama > 0 ? (fark / genelOrtalama) * 100 : 0
                  return (
                    <tr key={s.ana_yemek}>
                      <td className="font-medium">{s.ana_yemek}</td>
                      <td className="text-right tabular-nums text-solgun">{s.gun_sayisi}</td>
                      <td className="text-right tabular-nums text-solgun">{s.toplam_ogun}</td>
                      <td className="text-right font-semibold tabular-nums">{s.ortalama}</td>
                      <td>
                        {Math.abs(yuzde) < 5 ? (
                          <span className="text-solgun">ortalama civarı</span>
                        ) : yuzde > 0 ? (
                          <span className="rozet bg-emerald-100 text-emerald-800">
                            %{yuzde.toFixed(0)} üzerinde
                          </span>
                        ) : (
                          <span className="rozet bg-red-100 text-red-800">
                            %{Math.abs(yuzde).toFixed(0)} altında
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-solgun">
            Tek bir güne dayanan satırlar yanıltıcı olabilir; &quot;kaç gün&quot; sütunu
            düşük olanları ihtiyatla okuyun. Ortalamanın belirgin altında kalan yemekler
            menüden çıkarma ya da seyreltme adayıdır.
          </p>
        </>
      )}
    </div>
  )
}

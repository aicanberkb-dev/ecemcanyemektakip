import Link from 'next/link'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { SezonUyarisi } from '@/components/SezonUyarisi'
import { YazdirButonu } from '@/components/Yazdir'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import {
  OGRENCI_TIPI_ADLARI,
  PLANLI_OGRENCI_TIPLERI,
  type TaksitDurumu,
  type TaksitPlani,
} from '@/lib/types'

import { TaksitListesi } from './TaksitListesi'

export const metadata = { title: 'Taksit Takibi — Yemek Takip' }

export default async function TaksitPage({
  searchParams,
}: {
  searchParams: Promise<{ sezon?: string }>
}) {
  const { sezon: sezonQ } = await searchParams

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const liste = await sezonlariGetir(okul.id)
  const sezon = sezonSec(liste, sezonQ)

  if (!sezon) {
    return (
      <div className="space-y-4">
        <h1 className="baslik">Taksit Takibi</h1>
        <div className="kart p-6 text-center">
          <p className="text-solgun">
            {okul.ad} için sezon tanımlı değil. Taksit takibi sezon üzerinden çalışır.
          </p>
          <Link href="/admin/settings" className="btn-birincil mt-3">
            Sezon tanımla
          </Link>
        </div>
      </div>
    )
  }

  const [{ data, error }, { data: planVeri }] = await Promise.all([
    supabase.rpc('taksit_durumu', { p_sezon_id: sezon.id, p_tarih: await bugunSunucu() }),
    supabase
      .from('taksit_plani')
      .select('*')
      .eq('sezon_id', sezon.id)
      .order('vade_tarihi'),
  ])

  const satirlar = (data ?? []) as TaksitDurumu[]
  const plan = (planVeri ?? []) as TaksitPlani[]

  const bugun = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <CiktiBasligi
        baslik="Taksit Takibi"
        okul={okul.ad}
        donem={`${sezon.ad} sezonu (${tarihBicim(sezon.baslangic)} – ${tarihBicim(sezon.bitis)})`}
      />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="baslik">Taksit Takibi — {sezon.ad}</h1>
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {liste.length > 1 && (
            <form className="flex items-end gap-2">
              <div>
                <label className="etiket" htmlFor="sezon">
                  Sezon
                </label>
                <select id="sezon" name="sezon" defaultValue={sezon.id} className="girdi">
                  {liste.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-birincil">Göster</button>
            </form>
          )}
          <YazdirButonu />
          <a href={`/reports/taksit/csv?sezon=${sezon.id}`} className="btn-ikincil">
            CSV indir
          </a>
        </div>
      </div>

      <p className="yazdirma-gizle text-sm text-solgun">
        Sezon aralığı: {tarihBicim(sezon.baslangic)} – {tarihBicim(sezon.bitis)}. Bu
        aralıkta yapılan tüm tahsilat sezona sayılır; yaz aylarındaki geç ödemeler de
        dahildir.
      </p>

      <SezonUyarisi sezon={sezon} plan={plan} />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      {plan.length === 0 ? (
        <div className="kart p-6 text-center">
          <p className="text-solgun">
            {okul.ad} için {sezon.ad} sezonu taksit planı tanımlı değil.
          </p>
          <Link href="/admin/settings" className="btn-birincil mt-3">
            Taksit planı tanımla
          </Link>
        </div>
      ) : (
        <>
          {/* Plan özeti — her öğrenci tipi kendi tablosunda.
              Tek tabloda birleştirilince farklı tiplerin taksitleri iç içe
              görünüyor ve hangi rakamın kime ait olduğu anlaşılmıyordu. */}
          {PLANLI_OGRENCI_TIPLERI.map((tip) => {
            const tipinPlani = plan.filter((p) => p.ogrenci_tipi === tip)
            if (tipinPlani.length === 0) return null
            const tipToplam = tipinPlani.reduce((t, p) => t + Number(p.tutar), 0)
            const tipOgrenci = satirlar.filter(
              (s) => (s.ogrenci_tipi === 'birinci_sinif' ? 'standart' : s.ogrenci_tipi) === tip,
            ).length

            return (
              <div key={tip} className="kart overflow-x-auto">
                <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cizgi px-4 py-3">
                  <span className="font-semibold">
                    {OGRENCI_TIPI_ADLARI[tip]} — {sezon.ad} Taksit Planı
                  </span>
                  <span className="text-sm font-normal text-solgun">
                    {tipinPlani.length} taksit · yıllık {para(tipToplam)} · {tipOgrenci} öğrenci
                    {tip === 'standart' && ' (1. sınıflar dahil)'}
                  </span>
                </h2>
                <table className="tablo">
                  <thead>
                    <tr>
                      <th>Taksit</th>
                      <th>Vade</th>
                      <th className="text-right">Tutar</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tipinPlani.map((t) => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.ad}</td>
                        <td>{tarihBicim(t.vade_tarihi)}</td>
                        <td className="text-right tabular-nums">{para(t.tutar)}</td>
                        <td>
                          {t.vade_tarihi <= bugun ? (
                            <span className="rozet bg-slate-200 text-slate-700">Vadesi geçti</span>
                          ) : (
                            <span className="rozet bg-blue-100 text-blue-800">Beklemede</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        {OGRENCI_TIPI_ADLARI[tip]} yıllık toplam
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{para(tipToplam)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}

          <p className="yazdirma-gizle text-xs text-solgun">
            Yukarıdakiler tiplerin varsayılan planlarıdır. Öğrenciye özel tutar veya tarih
            tanımlanmışsa aşağıdaki listede &quot;özel plan&quot; etiketiyle görünür ve
            hesaplama o öğrencinin kendi planı üzerinden yapılır.
          </p>

          <TaksitListesi satirlar={satirlar} />

          <p className="yazdirma-gizle text-xs text-solgun">
            Kümülatif hesap: vadesi gelen taksitlerin toplamı, yıl içinde yapılan tüm
            tahsilatla karşılaştırılır. Geç yapılan kısmi ödeme borcu azaltır ama
            tamamlamıyorsa öğrenci borçlu görünmeye devam eder.
          </p>
        </>
      )}
    </div>
  )
}

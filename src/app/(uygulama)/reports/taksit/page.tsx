import Link from 'next/link'

import { CiktiBasligi } from '@/components/CiktiBasligi'
import { OgrenciTipiRozeti } from '@/components/Rozetler'
import { SezonUyarisi } from '@/components/SezonUyarisi'
import { YazdirButonu } from '@/components/Yazdir'
import { para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { TaksitDurumu, TaksitPlani } from '@/lib/types'

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
    supabase.rpc('taksit_durumu', { p_sezon_id: sezon.id }),
    supabase
      .from('taksit_plani')
      .select('*')
      .eq('sezon_id', sezon.id)
      .order('vade_tarihi'),
  ])

  const satirlar = (data ?? []) as TaksitDurumu[]
  const plan = (planVeri ?? []) as TaksitPlani[]

  const borclu = satirlar.filter((s) => s.odeme_alinmali)
  const toplamEksik = borclu.reduce((t, s) => t + Number(s.eksik), 0)
  const toplamOdenen = satirlar.reduce((t, s) => t + Number(s.odenen), 0)
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
          {/* Plan özeti */}
          <div className="kart overflow-x-auto">
            <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
              {sezon.ad} Taksit Planı
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
                {plan.map((t) => (
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
                    Yıllık toplam
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {para(plan.reduce((t, p) => t + Number(p.tutar), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <p className="yazdirma-gizle border-t border-cizgi px-4 py-2 text-xs text-solgun">
              Bu, okulun varsayılan planıdır. Öğrenciye özel tutar veya tarih
              tanımlanmışsa aşağıdaki tabloda &quot;özel plan&quot; etiketiyle görünür ve
              hesaplama o öğrencinin kendi planı üzerinden yapılır.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Ozet baslik="Aylıkçı öğrenci" deger={String(satirlar.length)} />
            <Ozet baslik="Toplanan" deger={para(toplamOdenen)} renk="text-emerald-700" />
            <Ozet
              baslik="Ödeme alınmalı"
              deger={para(toplamEksik)}
              alt={`${borclu.length} öğrenci`}
              renk="text-red-600"
            />
          </div>

          <div className="kart overflow-x-auto">
            <table className="tablo">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Ad Soyad</th>
                  <th>Sınıf</th>
                  <th>Tip</th>
                  <th className="text-right">Yıllık</th>
                  <th className="text-right">Vadesi Gelen</th>
                  <th className="text-right">Ödenen</th>
                  <th className="text-right">Eksik</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.student_id} className={s.odeme_alinmali ? 'bg-red-50/60' : ''}>
                    <td className="tabular-nums text-solgun">{s.ogrenci_no}</td>
                    <td>
                      <Link
                        href={`/students/${s.student_id}`}
                        className="font-medium text-vurgu hover:underline"
                      >
                        {s.ad_soyad}
                      </Link>
                      {s.ozel_plan && (
                        <span
                          className="rozet ml-2 bg-amber-100 text-amber-800"
                          title="Bu öğrencinin taksit planı okul planından farklı"
                        >
                          özel plan
                        </span>
                      )}
                    </td>
                    <td>{s.sinif ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {s.ogrenci_tipi === 'standart' ? (
                        <span className="text-solgun">Standart</span>
                      ) : (
                        <OgrenciTipiRozeti tip={s.ogrenci_tipi} />
                      )}
                    </td>
                    <td className="text-right tabular-nums">{para(s.yillik_toplam)}</td>
                    <td className="text-right tabular-nums">{para(s.vadesi_gelen)}</td>
                    <td className="text-right tabular-nums text-emerald-700">
                      {para(s.odenen)}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {Number(s.eksik) > 0 ? (
                        <span className="text-red-600">{para(s.eksik)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      {s.odeme_alinmali ? (
                        <span className="rozet bg-red-600 text-white">ÖDEME ALINMALI</span>
                      ) : (
                        <span className="rozet bg-emerald-100 text-emerald-800">Güncel</span>
                      )}
                    </td>
                  </tr>
                ))}
                {satirlar.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-solgun">
                      Aylıkçı öğrenci yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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

import { TarihAraligi } from '@/components/TarihAraligi'
import { ayBasiISO, bugunISO, para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { NakitSatiri } from '@/lib/types'

export const metadata = { title: 'Nakit Raporu — Yemek Takip' }

export default async function NakitPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>
}) {
  const { bas: basQ, bit: bitQ } = await searchParams
  const bas = basQ || ayBasiISO()
  const bit = bitQ || bugunISO()

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const { data, error } = await supabase.rpc('nakit_raporu', {
    p_okul_id: okul.id,
    p_bas: bas,
    p_bit: bit,
  })
  const satirlar = (data ?? []) as NakitSatiri[]

  const toplam = satirlar.reduce(
    (t, s) => ({
      tahsilat: t.tahsilat + Number(s.tahsilat_tutar),
      tahsilatAdet: t.tahsilatAdet + Number(s.tahsilat_adet),
      ucretli: t.ucretli + Number(s.ucretli_tutar),
      ucretliAdet: t.ucretliAdet + Number(s.ucretli_adet),
      genel: t.genel + Number(s.toplam),
    }),
    { tahsilat: 0, tahsilatAdet: 0, ucretli: 0, ucretliAdet: 0, genel: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Kasaya Giren Nakit</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/nakit" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Ozet baslik="Tahsilatlar" deger={para(toplam.tahsilat)} alt={`${toplam.tahsilatAdet} işlem`} />
        <Ozet
          baslik="Ücretli öğünler"
          deger={para(toplam.ucretli)}
          alt={`${toplam.ucretliAdet} öğün`}
        />
        <Ozet baslik="Toplam" deger={para(toplam.genel)} renk="text-emerald-700" alt="dönem geneli" />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th className="text-right">Tahsilat</th>
              <th className="text-right">Adet</th>
              <th className="text-right">Ücretli öğün</th>
              <th className="text-right">Adet</th>
              <th className="text-right">Günün toplamı</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.tarih}>
                <td className="whitespace-nowrap">{tarihBicim(s.tarih)}</td>
                <td className="text-right tabular-nums text-emerald-700">
                  {para(s.tahsilat_tutar)}
                </td>
                <td className="text-right tabular-nums text-solgun">{s.tahsilat_adet}</td>
                <td className="text-right tabular-nums">{para(s.ucretli_tutar)}</td>
                <td className="text-right tabular-nums text-solgun">{s.ucretli_adet}</td>
                <td className="text-right font-semibold tabular-nums">{para(s.toplam)}</td>
              </tr>
            ))}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  Bu aralıkta kasaya para girişi yok.
                </td>
              </tr>
            )}
          </tbody>
          {satirlar.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2">TOPLAM</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.tahsilat)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{toplam.tahsilatAdet}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.ucretli)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{toplam.ucretliAdet}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.genel)}</td>
              </tr>
            </tfoot>
          )}
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

import { TarihAraligi } from '@/components/TarihAraligi'
import { ayBasiISO, para, tarih as tarihBicim } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { KasaSatiri } from '@/lib/types'

import { TeslimButonu } from './TeslimButonu'

export const metadata = { title: 'Okul Kasa Takibi — Yemek Takip' }

/**
 * Okulda biriken paranın gün gün takibi.
 *
 * İki para birbirinden ayrı izleniyor: nakit fiilen okulda duruyor ve
 * elden teslim alınması gerekiyor; kredi kartı ertesi gün hesaba geçtiği
 * için teslim alınacak bir şey yok ama akşam bakıldığında ertesi gün ne
 * kadar yatacağının bilinmesi gerekiyor. Havale zaten doğrudan hesaba
 * geldiği için ayrı sütunda, toplamların dışında tutuluyor.
 */
export default async function KasaPage({
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
  const { data, error } = await supabase.rpc('kasa_raporu', {
    p_okul_id: okul.id,
    p_bas: bas,
    p_bit: bit,
  })
  const satirlar = (data ?? []) as KasaSatiri[]

  const toplam = satirlar.reduce(
    (t, s) => ({
      ogunNakit: t.ogunNakit + Number(s.ogun_nakit),
      ogunKart: t.ogunKart + Number(s.ogun_kart),
      tahsilatNakit: t.tahsilatNakit + Number(s.tahsilat_nakit) + Number(s.tahsilat_belirsiz),
      tahsilatKart: t.tahsilatKart + Number(s.tahsilat_kart),
      havale: t.havale + Number(s.tahsilat_havale),
      giris: t.giris + Number(s.kasa_giris),
      cikis: t.cikis + Number(s.kasa_cikis),
      nakit: t.nakit + Number(s.nakit_toplam),
      kart: t.kart + Number(s.kart_toplam),
      genel: t.genel + Number(s.genel_toplam),
      // Teslim alınmamış günlerin nakiti hâlâ okulda duruyor
      bekleyen: t.bekleyen + (s.teslim_alindi ? 0 : Number(s.nakit_toplam)),
    }),
    {
      ogunNakit: 0,
      ogunKart: 0,
      tahsilatNakit: 0,
      tahsilatKart: 0,
      havale: 0,
      giris: 0,
      cikis: 0,
      nakit: 0,
      kart: 0,
      genel: 0,
      bekleyen: 0,
    },
  )

  // En son günün kartı yarın hesaba geçecek olan; akşam bakılan rakam bu
  const sonGun = satirlar[0] ?? null

  // İki hafta sonra gelip biriken kasayı topluca almak için: her satır,
  // o güne kadar teslim alınmamış günlerin sayısını ve toplamını bilir.
  // Teslim alınmış günler zaten atlanır, yani bu "son teslimden bu yana".
  const bekleyenler: Record<string, number> = {}
  const bekleyenTutarlar: Record<string, number> = {}
  for (const s of satirlar) {
    const oncekiler = satirlar.filter(
      (d) => d.tarih <= s.tarih && !d.teslim_alindi && Number(d.nakit_toplam) !== 0,
    )
    bekleyenler[s.tarih] = oncekiler.length
    bekleyenTutarlar[s.tarih] = oncekiler.reduce((t, d) => t + Number(d.nakit_toplam), 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Okul Kasa Takibi</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <p className="text-sm text-solgun">
        Nakit okulda birikir ve elden teslim alınır; kredi kartı ertesi gün hesaba
        geçer. Teslim alınmamış her gün, o paranın hâlâ okulda durduğu anlamına
        gelir. Havale doğrudan hesaba geldiği için toplamların dışındadır.
      </p>

      <TarihAraligi bas={bas} bit={bit} temizleYolu="/reports/kasa" />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Ozet
          baslik="Teslim alınmayı bekleyen nakit"
          deger={para(toplam.bekleyen)}
          renk="text-amber-700"
          alt="şu anda okulda duran para"
        />
        <Ozet
          baslik="Dönemin nakiti"
          deger={para(toplam.nakit)}
          renk="text-emerald-700"
          alt={`öğün ${para(toplam.ogunNakit)} · tahsilat ${para(toplam.tahsilatNakit)}`}
        />
        <Ozet
          baslik="Dönemin kredi kartı"
          deger={para(toplam.kart)}
          alt={`öğün ${para(toplam.ogunKart)} · tahsilat ${para(toplam.tahsilatKart)}`}
        />
        <Ozet
          baslik={sonGun ? `${tarihBicim(sonGun.tarih)} kartı` : 'Son günün kartı'}
          deger={para(sonGun?.kart_toplam ?? 0)}
          alt="ertesi gün hesaba geçecek"
        />
      </div>

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th className="text-right">Öğün nakit</th>
              <th className="text-right">Öğün kart</th>
              <th className="text-right">Tahsilat nakit</th>
              <th className="text-right">Tahsilat kart</th>
              <th className="text-right">Kasa giriş/çıkış</th>
              <th className="text-right">KART</th>
              <th className="text-right">Havale</th>
              <th className="bg-emerald-50 text-right text-emerald-900">
                TESLİM ALINACAK TOPLAM TUTAR
              </th>
              <th className="text-right">Teslim</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.tarih} className={s.teslim_alindi ? undefined : 'bg-amber-50/40'}>
                <td className="font-medium whitespace-nowrap">{tarihBicim(s.tarih)}</td>
                <td className="text-right tabular-nums">{para(s.ogun_nakit)}</td>
                <td className="text-right tabular-nums">{para(s.ogun_kart)}</td>
                <td className="text-right tabular-nums">
                  {para(Number(s.tahsilat_nakit) + Number(s.tahsilat_belirsiz))}
                </td>
                <td className="text-right tabular-nums">{para(s.tahsilat_kart)}</td>
                <td className="text-right tabular-nums text-solgun">
                  {Number(s.kasa_giris) === 0 && Number(s.kasa_cikis) === 0
                    ? '—'
                    : `${para(s.kasa_giris)} / ${para(s.kasa_cikis)}`}
                </td>
                <td className="text-right font-semibold tabular-nums text-indigo-700">
                  {para(s.kart_toplam)}
                </td>
                <td className="text-right tabular-nums text-solgun">
                  {Number(s.tahsilat_havale) === 0 ? '—' : para(s.tahsilat_havale)}
                </td>
                {/* Elden alınacak para: nakit öğün + nakit tahsilat + kasa girişi − çıkış */}
                <td className="bg-emerald-50/60 text-right text-lg font-bold tabular-nums text-emerald-800">
                  {para(s.nakit_toplam)}
                </td>
                <td className="text-right">
                  <TeslimButonu
                    tarih={s.tarih}
                    tutar={Number(s.nakit_toplam)}
                    alindi={s.teslim_alindi}
                    alinanTutar={Number(s.teslim_tutar)}
                    bekleyenGun={bekleyenler[s.tarih] ?? 0}
                    bekleyenTutar={bekleyenTutarlar[s.tarih] ?? 0}
                  />
                </td>
              </tr>
            ))}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-solgun">
                  Bu aralıkta kasa hareketi yok.
                </td>
              </tr>
            )}
          </tbody>
          {satirlar.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2">TOPLAM</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.ogunNakit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.ogunKart)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.tahsilatNakit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(toplam.tahsilatKart)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-solgun">
                  {para(toplam.giris)} / {para(toplam.cikis)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-indigo-700">
                  {para(toplam.kart)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-solgun">
                  {para(toplam.havale)}
                </td>
                <td className="bg-emerald-50 px-3 py-2 text-right text-lg tabular-nums text-emerald-800">
                  {para(toplam.nakit)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-amber-700">
                  {para(toplam.bekleyen)} bekliyor
                </td>
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

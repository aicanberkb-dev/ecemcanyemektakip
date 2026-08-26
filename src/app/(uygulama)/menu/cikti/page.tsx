import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Yemek Listesi Çıktısı — Yemek Takip' }

type Gun = {
  tarih: string
  corba: string | null
  ana_yemek: string | null
  yardimci: string | null
  ek: string | null
}

const GUN_ADI = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ']

/**
 * Velilere gönderilecek aylık yemek listesi afişi.
 *
 * Ekrandaki düzenleme tablosu veri girişi için; bu sayfa okunmak için.
 * Haftalar ayrı bloklar hâlinde, her gün bir kutu. Renkler kâğıda da bassın
 * diye print-color-adjust açık; ekran görüntüsü alıp WhatsApp'tan paylaşmak
 * da aynı düzeni verir.
 */
export default async function MenuCiktiPage({
  searchParams,
}: {
  searchParams: Promise<{ liste?: string; yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const supabase = await supabaseServer()

  const { data: listeler } = await supabase
    .from('menu_listeleri')
    .select('id, ad, havuz_grubu, satir_sayisi')
    .eq('aktif', true)
    .order('sira')

  const liste =
    (listeler ?? []).find((l) => l.id === q.liste) ?? (listeler ?? [])[0]
  if (!liste) return null

  const bas = `${yil}-${String(ay).padStart(2, '0')}-01`
  const bit = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`

  const [{ data }, { data: okulsuzVeri }] = await Promise.all([
    supabase
      .from('menu_gunleri')
      .select('tarih, corba, ana_yemek, yardimci, ek')
      .eq('liste_id', liste.id)
      .gte('tarih', bas)
      .lte('tarih', bit)
      .order('tarih'),
    // Resmi tatil ve okulun olmadigi gunler: afiste menu yerine aciklama yazar
    supabase
      .from('okulsuz_gunler')
      .select('tarih, sebep')
      .is('hizmet_noktasi_id', null)
      .gte('tarih', bas)
      .lte('tarih', bit),
  ])

  const kapaliHarita = new Map<string, string | null>(
    ((okulsuzVeri ?? []) as { tarih: string; sebep: string | null }[]).map((o) => [
      o.tarih,
      o.sebep,
    ]),
  )

  const gunler = (data ?? []) as Gun[]

  /**
   * Afiste gorunecek gunler.
   *
   * Kapali gun menusu olsa da olmasa da listeye girer: veli afiste 12'sini
   * gorup 13'unu goremezse gunun unutuldugunu sanar. Kapali gunde menu degil
   * "okul yok" ve nedeni yazar.
   */
  const dolu: Gun[] = []
  for (const g of gunler) {
    if (kapaliHarita.has(g.tarih) || g.corba || g.ana_yemek || g.yardimci || g.ek) {
      dolu.push(g)
    }
  }
  for (const [tarih] of kapaliHarita) {
    if (tarih < bas || tarih > bit) continue
    const h = new Date(`${tarih}T00:00:00`).getDay()
    if (h === 0 || h === 6) continue
    if (!dolu.some((g) => g.tarih === tarih)) {
      dolu.push({ tarih, corba: null, ana_yemek: null, yardimci: null, ek: null })
    }
  }
  dolu.sort((a, b) => a.tarih.localeCompare(b.tarih))

  // Haftalara böl: pazartesiden pazartesiye
  const haftalar: Gun[][] = []
  let acikHafta: Gun[] = []
  let oncekiHaftaGunu = -1
  for (const g of dolu) {
    const h = new Date(g.tarih).getDay()
    if (acikHafta.length > 0 && h <= oncekiHaftaGunu) {
      haftalar.push(acikHafta)
      acikHafta = []
    }
    acikHafta.push(g)
    oncekiHaftaGunu = h
  }
  if (acikHafta.length > 0) haftalar.push(acikHafta)

  const dortSatir = (liste.satir_sayisi ?? 4) >= 4

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <Link href={`/menu?liste=${liste.id}&yil=${yil}&ay=${ay}`} className="text-sm text-vurgu hover:underline">
          ← Yemek listesine dön
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-solgun">
            {dolu.length} gün · {haftalar.length} hafta
          </span>
          <YazdirButonu etiket="Yazdır / PDF kaydet" />
        </div>
      </div>

      {dolu.length === 0 && (
        <p className="yazdirma-gizle rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {AY_ADLARI[ay - 1]} {yil} için <strong>{liste.ad}</strong> listesinde menü yok.
        </p>
      )}

      <div className="afis mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl bg-white shadow-sm print:shadow-none">
        {/* Başlık şeridi */}
        <div className="relative bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 px-6 py-5 text-white">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase opacity-90">
            {liste.ad}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {AY_ADLARI[ay - 1].toLocaleUpperCase('tr')} {yil} YEMEK LİSTESİ
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Afiyet olsun · Menüde mevsim ve tedarik koşullarına göre değişiklik olabilir
          </p>
          <div className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -right-4 bottom-[-2.5rem] h-24 w-24 rounded-full bg-white/10" />
        </div>

        <div className="space-y-3 p-4">
          {haftalar.map((hafta, i) => (
            <section key={i} className="break-inside-avoid">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {i + 1}. HAFTA
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid grid-cols-5 gap-2">
                {hafta.map((g) => {
                  const d = new Date(g.tarih)
                  const kalemler = [g.corba, g.ana_yemek, g.yardimci, g.ek].filter(
                    (x): x is string => !!x && x.trim() !== '',
                  )
                  const kapali = kapaliHarita.has(g.tarih)

                  // Kapalı günde menü basılmaz; velinin görmesi gereken şey o
                  // gün okul olmadığı ve nedeni.
                  if (kapali) {
                    return (
                      <div
                        key={g.tarih}
                        className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50"
                      >
                        <div className="bg-slate-200 px-2 py-1 text-center">
                          <div className="text-lg leading-none font-black text-slate-700 tabular-nums">
                            {d.getDate()}
                          </div>
                          <div className="text-[9px] font-bold tracking-wide text-slate-600">
                            {GUN_ADI[d.getDay()]}
                          </div>
                        </div>
                        <div className="px-2 py-3 text-center">
                          <p className="text-[11px] font-bold text-slate-700">OKUL YOK</p>
                          {kapaliHarita.get(g.tarih) && (
                            <p className="mt-0.5 text-[10px] leading-tight text-slate-600">
                              {kapaliHarita.get(g.tarih)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={g.tarih}
                      className="overflow-hidden rounded-lg border border-emerald-200"
                    >
                      <div className="bg-emerald-50 px-2 py-1 text-center">
                        <div className="text-lg leading-none font-black text-emerald-900 tabular-nums">
                          {d.getDate()}
                        </div>
                        <div className="text-[9px] font-bold tracking-wide text-emerald-700">
                          {GUN_ADI[d.getDay()]}
                        </div>
                      </div>
                      <ul className="space-y-1 px-2 py-2">
                        {kalemler.map((k, j) => (
                          <li
                            key={j}
                            className="flex gap-1.5 text-[11px] leading-tight font-medium text-slate-800"
                          >
                            <span
                              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                                ['bg-orange-400', 'bg-red-400', 'bg-amber-400', 'bg-sky-400'][
                                  j % 4
                                ]
                              }`}
                            />
                            <span>{k}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                {/* Hafta beş günden kısaysa hizayı koru */}
                {Array.from({ length: Math.max(0, 5 - hafta.length) }).map((_, j) => (
                  <div key={`bos-${j}`} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Alt şerit */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 text-[10px] text-slate-600">
          <span className="flex flex-wrap gap-3">
            {(dortSatir
              ? [
                  ['bg-orange-400', 'Çorba'],
                  ['bg-red-400', 'Ana Yemek'],
                  ['bg-amber-400', 'Yardımcı'],
                  ['bg-sky-400', '4. Kalem'],
                ]
              : [
                  ['bg-orange-400', '1. Kalem'],
                  ['bg-red-400', '2. Kalem'],
                  ['bg-amber-400', '3. Kalem'],
                ]
            ).map(([renk, etiket]) => (
              <span key={etiket} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${renk}`} />
                {etiket}
              </span>
            ))}
          </span>
          <span className="font-semibold">Ecem Can Yemekhane Hizmetleri</span>
        </div>
      </div>

      {/* Renkler kâğıda da bassın; afiş rengi olmadan anlamını yitirir. */}
      <style>{`
        @media print {
          .afis, .afis * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}

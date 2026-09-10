import { Fraunces } from 'next/font/google'

import { AY_ADLARI } from '@/lib/format'

/**
 * Başlık ve tarihler için tırnaklı yazı: afiş veliye gidiyor, bir menü kartı
 * gibi okunmalı. latin-ext Türkçe harfler (ş, ğ, İ) için şart.
 */
const serif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export type AfisGunu = {
  tarih: string
  corba: string | null
  ana_yemek: string | null
  yardimci: string | null
  ek: string | null
}

const GUN_ADI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

/**
 * Kart köşesindeki kısaltmalar. İlk üç harfi kesmek "Pazartesi"yi "Paz"
 * yapıyordu — Pazar gibi okunuyor. Türkçede yerleşik kısaltmalar kullanılıyor.
 */
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

/** Afiş renkleri — koyu yeşil mürekkep, krem kâğıt, soluk altın çizgi. */
const R = {
  murekkep: '#1d3b2f',
  kagit: '#fbf8f1',
  altin: '#a8864f',
  soluk: '#6b7a72',
  cizgi: '#e4dccb',
}

/** Menüsü olan ya da okulun kapalı olduğu hafta içi günler, tarih sırasıyla. */
export function afisGunleri(gunler: AfisGunu[], kapali: Set<string>): AfisGunu[] {
  const harita = new Map<string, AfisGunu>()
  for (const g of gunler) {
    if (kapali.has(g.tarih) || g.corba || g.ana_yemek || g.yardimci || g.ek) {
      harita.set(g.tarih, g)
    }
  }
  for (const tarih of kapali) {
    const h = new Date(`${tarih}T00:00:00`).getDay()
    if (h === 0 || h === 6 || harita.has(tarih)) continue
    harita.set(tarih, { tarih, corba: null, ana_yemek: null, yardimci: null, ek: null })
  }
  return [...harita.values()].sort((a, b) => a.tarih.localeCompare(b.tarih))
}

/**
 * Günleri haftalara böler; her hafta beş sütun (pazartesi–cuma) ve her gün
 * kendi sütununa oturur. Hafta çarşamba başlıyorsa ilk kart çarşamba
 * sütunundadır, pazartesinin altına kaymaz.
 */
function haftalaraBol(gunler: AfisGunu[]): (AfisGunu | null)[][] {
  const haftalar: (AfisGunu | null)[][] = []
  let acik: (AfisGunu | null)[] | null = null
  let oncekiGun = 7
  for (const g of gunler) {
    const h = new Date(`${g.tarih}T00:00:00`).getDay() // 1..5
    if (!acik || h <= oncekiGun) {
      acik = [null, null, null, null, null]
      haftalar.push(acik)
    }
    acik[h - 1] = g
    oncekiGun = h
  }
  return haftalar
}

/**
 * Velilere gönderilecek aylık yemek listesi afişi.
 *
 * Okulun olmadığı günler yazısız, taralı kartla gösteriliyor. Gün tamamen
 * atlanırsa veli 12'sini görüp 13'ünü göremeyince unutulduğunu sanıyor;
 * "okul yok" yazısı ise afişi kalabalıklaştırıyordu.
 *
 * Afişte okul ya da liste adı yok: afiş zaten o okulun velilerine gidiyor.
 */
export function MenuAfisi({
  yil,
  ay,
  gunler,
  kapali,
  dortSatir,
}: {
  yil: number
  ay: number
  /** afisGunleri() çıktısı */
  gunler: AfisGunu[]
  kapali: Set<string>
  dortSatir: boolean
}) {
  const haftalar = haftalaraBol(gunler)

  return (
    <>
      <div
        className="afis mx-auto w-full max-w-[210mm] overflow-hidden rounded-sm shadow-sm print:shadow-none"
        style={{ backgroundColor: R.kagit, color: R.murekkep }}
      >
        <div className="px-8 pt-8 pb-6">
          <header className="text-center">
            <div className="mx-auto flex max-w-xs items-center gap-3">
              <span className="h-px flex-1" style={{ backgroundColor: R.altin }} />
              <span
                className="text-[10px] font-semibold tracking-[0.35em] uppercase"
                style={{ color: R.altin }}
              >
                Yemek Listesi
              </span>
              <span className="h-px flex-1" style={{ backgroundColor: R.altin }} />
            </div>
            <h1
              className={`${serif.className} mt-3 text-5xl leading-none font-semibold tracking-tight`}
            >
              {AY_ADLARI[ay - 1]} <span style={{ color: R.altin }}>{yil}</span>
            </h1>
            <p
              className={`${serif.className} mt-2 text-base italic`}
              style={{ color: R.soluk }}
            >
              Afiyet olsun
            </p>
          </header>

          {/* Gün başlıkları */}
          <div className="mt-7 grid grid-cols-5 gap-2.5">
            {GUN_ADI.slice(1, 6).map((g) => (
              <div
                key={g}
                className="text-center text-[9px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: R.soluk }}
              >
                {g}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2.5">
            {haftalar.map((hafta, i) => (
              <div key={i} className="grid break-inside-avoid grid-cols-5 gap-2.5">
                {hafta.map((g, sutun) =>
                  g ? (
                    <GunKarti
                      key={g.tarih}
                      gun={g}
                      kapali={kapali.has(g.tarih)}
                      dortSatir={dortSatir}
                    />
                  ) : (
                    <div key={`bos-${i}-${sutun}`} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex justify-end border-t px-8 py-3" style={{ borderColor: R.cizgi }}>
          <span className={`${serif.className} text-sm font-semibold tracking-wide`}>
            Ecem Can Gıda
          </span>
        </footer>
      </div>

      {/* Renkler kâğıda da bassın; krem zemin ve altın çizgi olmadan afiş sönük kalır. */}
      <style>{`
        @media print {
          .afis, .afis * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  )
}

function GunKarti({
  gun,
  kapali,
  dortSatir,
}: {
  gun: AfisGunu
  kapali: boolean
  dortSatir: boolean
}) {
  const d = new Date(`${gun.tarih}T00:00:00`)

  const tarihBasligi = (
    <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1.5">
      <span
        className={`${serif.className} text-2xl leading-none font-semibold tabular-nums`}
        style={{ color: kapali ? R.soluk : R.murekkep }}
      >
        {d.getDate()}
      </span>
      <span
        className="text-[8px] font-semibold tracking-[0.18em] uppercase"
        style={{ color: kapali ? '#a3aca7' : R.altin }}
      >
        {GUN_KISA[d.getDay()]}
      </span>
    </div>
  )

  // Kapalı gün: yazı yok, yalnızca tarih ve tarama. Veli günün atlanmadığını
  // görür, afiş kalabalıklaşmaz.
  if (kapali) {
    return (
      <div
        className="min-h-[92px] overflow-hidden rounded-sm border"
        style={{
          borderColor: R.cizgi,
          backgroundImage: 'repeating-linear-gradient(135deg, #f1ecdf 0 5px, #f8f5ee 5px 10px)',
        }}
      >
        {tarihBasligi}
      </div>
    )
  }

  const kalemler = [gun.corba, gun.ana_yemek, gun.yardimci, gun.ek]

  return (
    <div className="min-h-[92px] overflow-hidden rounded-sm border bg-white" style={{ borderColor: R.cizgi }}>
      {tarihBasligi}
      <div className="mx-2.5 h-px" style={{ backgroundColor: R.cizgi }} />
      <ul className="space-y-1 px-2.5 pt-1.5 pb-2.5">
        {kalemler.map((k, j) => {
          if (!k || k.trim() === '') return null
          // Dört satırlı listede ikinci kalem ana yemek: öne çıkar.
          const ana = dortSatir && j === 1
          return (
            <li
              key={j}
              className={`leading-tight ${ana ? 'text-[11px] font-bold' : 'text-[10px] font-medium'}`}
              style={{ color: ana ? R.murekkep : '#3d4d45' }}
            >
              {k}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

import { Archivo, Zilla_Slab } from 'next/font/google'

import { AY_ADLARI } from '@/lib/format'

import s from './MenuAfisi.module.css'

/**
 * Başlık ve tarihler tırnaklı ağır bir yazıyla (logodaki Rockwell'in akrabası),
 * yemekler dar olmayan sade bir yazıyla. latin-ext Türkçe harfler için şart.
 */
const slab = Zilla_Slab({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--afis-slab',
})
const sans = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--afis-sans',
})

export type AfisGunu = {
  tarih: string
  corba: string | null
  ana_yemek: string | null
  yardimci: string | null
  ek: string | null
}

/** afis: renkli, paylaşılan görsel. cikti: siyah-beyaz yazıcı için. */
export type AfisTuru = 'afis' | 'cikti'

const GUN_ADI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']

/**
 * Menüsü olan ya da okulun kapalı olduğu hafta içi günler, tarih sırasıyla.
 * `kapali`: tarih → okul-yok açıklaması (boş olabilir).
 */
export function afisGunleri(
  gunler: AfisGunu[],
  kapali: Map<string, string | null>,
): AfisGunu[] {
  const harita = new Map<string, AfisGunu>()
  for (const g of gunler) {
    if (kapali.has(g.tarih) || g.corba || g.ana_yemek || g.yardimci || g.ek) {
      harita.set(g.tarih, g)
    }
  }
  for (const tarih of kapali.keys()) {
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
 * Velilere gönderilecek aylık yemek listesi afişi — Sarı Bant düzeni.
 *
 * Kutuda yalnız gün numarası var; gün adı sütun başlığında. Okulun olmadığı
 * günlerde "OKUL YOK" yazmıyor; menü ekranında o güne girilen açıklama
 * ("İlk gün yemek çıkmayacaktır") kartın içinde görünüyor.
 *
 * Afişte okul ya da liste adı yok: afiş zaten o okulun velilerine gidiyor.
 */
export function MenuAfisi({
  yil,
  ay,
  gunler,
  kapali,
  dortSatir,
  tur,
}: {
  yil: number
  ay: number
  /** afisGunleri() çıktısı */
  gunler: AfisGunu[]
  kapali: Map<string, string | null>
  dortSatir: boolean
  tur: AfisTuru
}) {
  const haftalar = haftalaraBol(gunler)
  const renkli = tur === 'afis'

  return (
    <article
      className={`${s.poster} ${renkli ? s.renkli : s.siyahBeyaz} ${slab.variable} ${sans.variable}`}
      style={{ ['--fd' as string]: 'var(--afis-slab), Rockwell, serif', ['--fb' as string]: 'var(--afis-sans), system-ui, sans-serif' }}
    >
      <div className={s.cerceve}>
        <header className={s.bant}>
          {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo, görsel olarak dışa aktarılırken de aynen çizilmeli */}
          <img
            src={renkli ? '/logo/logo-kirmizi-beyaz.svg' : '/logo/logo-siyah-beyaz.svg'}
            alt="Ecem Can Gıda"
            className={s.logo}
          />
          <div className={s.baslik}>
            <div className={s.ustYazi}>Yemek Listesi</div>
            <h1 className={s.ay}>
              {AY_ADLARI[ay - 1]} <span>{yil}</span>
            </h1>
            <div className={s.altYazi}>Afiyet olsun</div>
          </div>
        </header>

        <div className={s.gunler}>
          {GUN_ADI.map((g) => (
            <div key={g}>{g}</div>
          ))}
        </div>

        <div className={s.haftalar}>
          {haftalar.map((hafta, i) => (
            <div key={i} className={s.hafta}>
              {hafta.map((g, sutun) =>
                g ? (
                  <GunKarti
                    key={g.tarih}
                    gun={g}
                    kapali={kapali.has(g.tarih)}
                    aciklama={kapali.get(g.tarih) ?? null}
                    dortSatir={dortSatir}
                  />
                ) : (
                  <div key={`bos-${i}-${sutun}`} />
                ),
              )}
            </div>
          ))}
        </div>

        <footer className={s.alt}>Ecem Can Gıda</footer>
      </div>
    </article>
  )
}

function GunKarti({
  gun,
  kapali,
  aciklama,
  dortSatir,
}: {
  gun: AfisGunu
  kapali: boolean
  aciklama: string | null
  dortSatir: boolean
}) {
  const ust = (
    <div className={s.kartUst}>
      <b className={s.no}>{new Date(`${gun.tarih}T00:00:00`).getDate()}</b>
    </div>
  )

  // Kapalı gün: menü yok; varsa menü ekranında girilen açıklama yazar.
  if (kapali) {
    return (
      <div className={`${s.kart} ${s.kapali}`}>
        {ust}
        {aciklama && (
          <p className={s.not}>
            <span>{aciklama}</span>
          </p>
        )}
      </div>
    )
  }

  // 3 çeşit veren yerin afişinde 4. kalem yok
  const kalemler = dortSatir
    ? [gun.corba, gun.ana_yemek, gun.yardimci, gun.ek]
    : [gun.corba, gun.ana_yemek, gun.yardimci]

  return (
    <div className={s.kart}>
      {ust}
      <ul>
        {kalemler.map((k, j) => {
          if (!k || k.trim() === '') return null
          // Dört satırlı listede ikinci kalem ana yemek: öne çıkar.
          return (
            <li key={j} className={dortSatir && j === 1 ? s.ana : undefined}>
              {k}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Afişin ekrandaki ve kâğıttaki kabı; yazdırmada A4 genişliğine oturur. */
export const KAGIT_SINIFI = s.kagit

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { para } from '@/lib/format'
import { kiraKirilimi } from '@/lib/kira-hesap'

import { hesaplaDoldur, kiraKaydet, odendiDegistir, tutarYay } from './actions'

export type KiraSatiri = {
  id: string
  birim: string
  kalem: Kalem
  sira: number
  tutar: number | string
  odeme_tarihi: string | null
  belge_no: string | null
  odendi: boolean
}

type Kalem = 'kira' | 'il_payi' | 'ilce_payi' | 'uc_aylik'

const KALEM_ADLARI: Record<Kalem, string> = {
  kira: 'Kira',
  il_payi: 'İl Payı',
  ilce_payi: 'İlçe Payı',
  uc_aylik: '3 Aylık Arz',
}

/**
 * Ekrandaki bir kutu.
 *
 * `anahtar` veritabanındaki birim adı, `ad` ekranda yazan başlık. İkisi
 * ayrı: AKBABA'da il/ilçe payı ve üç aylık arz iki okul için ortak ödeniyor,
 * yalnızca kira ayrı yatıyor. Ortak kalemler İLKOKUL anahtarında duruyor —
 * gerçek kayıtlar orada açılmıştı, taşımaya gerek yok.
 */
type Bolum = {
  ad: string
  anahtar: string
  zemin: string
  baslik: string
  kalemler: Kalem[]
}

/**
 * Bir kira bedelinden beslenen ödeme grubu.
 *
 * Tek bir taban rakam var, kalemler ondan çıkıyor. Kira birden fazla birime
 * bölünebiliyor (AKBABA'da ilkokul + ortaokul), paylar ise tek birimde
 * duruyor — ödeme de öyle yapılıyor.
 */
type Grup = {
  /** Taban kira bedelinin saklandığı anahtar */
  anahtar: string
  ad: string
  /** Kira bu birimlere eşit bölünür */
  kiraAnahtarlari: string[]
  /** İl payı, ilçe payı ve arz bu birimde durur */
  paylarAnahtari: string
  bolumler: Bolum[]
}

const TUM_KALEMLER: Kalem[] = ['kira', 'il_payi', 'ilce_payi', 'uc_aylik']
const ORTAK_KALEMLER: Kalem[] = ['il_payi', 'ilce_payi', 'uc_aylik']

const OKULLAR: { ad: string; gruplar: Grup[] }[] = [
  {
    ad: 'GÖKSU',
    gruplar: [
      {
        anahtar: 'GÖKSU KANTİN',
        ad: 'Kantin kira bedeli',
        kiraAnahtarlari: ['GÖKSU KANTİN'],
        paylarAnahtari: 'GÖKSU KANTİN',
        bolumler: [
          {
            ad: 'GÖKSU KANTİN',
            anahtar: 'GÖKSU KANTİN',
            zemin: 'bg-amber-50/70',
            baslik: 'bg-amber-100 text-amber-900',
            kalemler: TUM_KALEMLER,
          },
        ],
      },
      {
        anahtar: 'GÖKSU YEMEKHANE',
        ad: 'Yemekhane kira bedeli',
        kiraAnahtarlari: ['GÖKSU YEMEKHANE'],
        paylarAnahtari: 'GÖKSU YEMEKHANE',
        bolumler: [
          {
            ad: 'GÖKSU YEMEKHANE',
            anahtar: 'GÖKSU YEMEKHANE',
            zemin: 'bg-teal-50/70',
            baslik: 'bg-teal-100 text-teal-900',
            kalemler: TUM_KALEMLER,
          },
        ],
      },
    ],
  },
  {
    ad: 'AKBABA',
    gruplar: [
      {
        // Kira iki okula bölünüyor, paylar tek ödeme olarak yatıyor
        anahtar: 'AKBABA',
        ad: 'Kantin kira bedeli (ilkokul + ortaokul)',
        kiraAnahtarlari: ['AKBABA KANTİN İLKOKUL', 'AKBABA KANTİN ORTAOKUL'],
        paylarAnahtari: 'AKBABA KANTİN İLKOKUL',
        bolumler: [
          {
            ad: 'AKBABA KANTİN İLKOKUL — Kira',
            anahtar: 'AKBABA KANTİN İLKOKUL',
            zemin: 'bg-sky-50/70',
            baslik: 'bg-sky-100 text-sky-900',
            kalemler: ['kira'],
          },
          {
            ad: 'AKBABA KANTİN ORTAOKUL — Kira',
            anahtar: 'AKBABA KANTİN ORTAOKUL',
            zemin: 'bg-indigo-50/70',
            baslik: 'bg-indigo-100 text-indigo-900',
            kalemler: ['kira'],
          },
          {
            // İki okul için tek ödeme yapılıyor; ayrı ayrı girilmiyor
            ad: 'AKBABA — ORTAK (ilkokul + ortaokul)',
            anahtar: 'AKBABA KANTİN İLKOKUL',
            zemin: 'bg-violet-50/70',
            baslik: 'bg-violet-100 text-violet-900',
            kalemler: ORTAK_KALEMLER,
          },
        ],
      },
    ],
  },
  {
    ad: 'AHMET MİTHAT',
    gruplar: [
      {
        anahtar: 'AHMET MİTHAT YEMEKHANE',
        ad: 'Yemekhane kira bedeli',
        kiraAnahtarlari: ['AHMET MİTHAT YEMEKHANE'],
        paylarAnahtari: 'AHMET MİTHAT YEMEKHANE',
        bolumler: [
          {
            ad: 'AHMET MİTHAT YEMEKHANE',
            anahtar: 'AHMET MİTHAT YEMEKHANE',
            zemin: 'bg-rose-50/70',
            baslik: 'bg-rose-100 text-rose-900',
            kalemler: TUM_KALEMLER,
          },
        ],
      },
    ],
  },
]

/**
 * Kira, il payı ve ilçe payı sekiz taksit olarak yatıyor; ay takvimiyle
 * ilgisi yok, bu yüzden dönem değil taksit sırası tutuluyor.
 */
const TAKSITLER = [1, 2, 3, 4, 5, 6, 7, 8]
/** Üç aylık arz yılda üç kez */
const ARZ_TAKSITLERI = [1, 2, 3]

function taksitleri(kalem: Kalem) {
  return kalem === 'uc_aylik' ? ARZ_TAKSITLERI : TAKSITLER
}

function etiket(kalem: Kalem, sira: number) {
  return kalem === 'uc_aylik' ? `${sira}. 3 Aylık Arz` : `${sira}. Taksit`
}

/** Satır anahtarı: birim + kalem + taksit sırası */
function anahtar(birim: string, kalem: Kalem, sira: number) {
  return `${birim}|${kalem}|${sira}`
}

export function KiraEkrani({
  satirlar,
  tabanlar,
  bugun,
}: {
  satirlar: KiraSatiri[]
  /** Grup anahtarına göre kayıtlı kira bedelleri */
  tabanlar: Record<string, number>
  /** Sunucunun bugünü — boş tarih kutularına varsayılan olarak yazılır */
  bugun: string
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)

  const mevcut = useMemo(() => {
    const m = new Map<string, KiraSatiri>()
    for (const s of satirlar) m.set(anahtar(s.birim, s.kalem, s.sira), s)
    return m
  }, [satirlar])

  function kaydet(
    birim: string,
    kalem: Kalem,
    sira: number,
    alan: 'tutar' | 'odeme_tarihi' | 'belge_no',
    deger: string,
  ) {
    const s = mevcut.get(anahtar(birim, kalem, sira))
    const gonder = {
      birim,
      kalem,
      sira,
      tutar: alan === 'tutar' ? deger : String(s?.tutar ?? 0).replace('.', ','),
      odeme_tarihi: alan === 'odeme_tarihi' ? deger : (s?.odeme_tarihi ?? null),
      belge_no: alan === 'belge_no' ? deger : (s?.belge_no ?? ''),
    }

    baslat(async () => {
      const sonuc = await kiraKaydet(gonder)
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj(null)
      router.refresh()
    })
  }

  function odendi(birim: string, kalem: Kalem, sira: number) {
    const s = mevcut.get(anahtar(birim, kalem, sira))
    baslat(async () => {
      const sonuc = await odendiDegistir({ birim, kalem, sira }, !s?.odendi, bugun)
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj(null)
      router.refresh()
    })
  }

  /** Kira bedelini saklar, bütün kalemleri ondan hesaplayıp yazar */
  function hesapla(grup: Grup, taban: string) {
    baslat(async () => {
      const sonuc = await hesaplaDoldur({
        tabanAnahtari: grup.anahtar,
        kiraAnahtarlari: grup.kiraAnahtarlari,
        paylarAnahtari: grup.paylarAnahtari,
        taban,
        taksitler: TAKSITLER,
        arzTaksitleri: ARZ_TAKSITLERI,
      })
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj({ tip: 'ok', metin: `${grup.ad}: ${sonuc.basari ?? 'Hesaplandı.'}` })
      router.refresh()
    })
  }

  /** Girilen tutarı sonraki taksitlere yayar; ödenmiş satırlara dokunmaz */
  function yay(birim: string, kalem: Kalem, tutar: number, hedefler: number[]) {
    baslat(async () => {
      const sonuc = await tutarYay(birim, kalem, tutar, hedefler)
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {mesaj && (
        <p
          className={`rounded-md px-4 py-3 text-sm ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      {/* Okullar yan yana; dar ekranda alt alta iner */}
      <div className="grid gap-4 xl:grid-cols-3">
        {OKULLAR.map((okul) => (
          <section key={okul.ad} className="kart overflow-hidden">
            <h2 className="border-b border-cizgi bg-slate-50 px-4 py-2.5 font-semibold">
              {okul.ad}
            </h2>

            <div className="space-y-4 p-3">
              {okul.gruplar.map((grup) => (
                <div key={grup.anahtar} className="space-y-3">
                  <TabanKutusu
                    grup={grup}
                    taban={tabanlar[grup.anahtar] ?? 0}
                    bekliyor={bekliyor}
                    hesapla={hesapla}
                  />

                  {grup.bolumler.map((b) => (
                    <div key={b.ad} className={`rounded-lg border border-cizgi ${b.zemin}`}>
                      <h3
                        className={`border-b border-cizgi px-3 py-2 text-sm font-semibold ${b.baslik}`}
                      >
                        {b.ad}
                      </h3>

                      <div className="space-y-3 p-3">
                        {b.kalemler.map((kalem) => (
                          <Kutu
                            key={kalem}
                            baslik={KALEM_ADLARI[kalem]}
                            siralar={taksitleri(kalem)}
                            birim={b.anahtar}
                            kalem={kalem}
                            mevcut={mevcut}
                            bekliyor={bekliyor}
                            bugun={bugun}
                            kaydet={kaydet}
                            odendi={odendi}
                            yay={yay}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * Kira bedeli ve ondan çıkan kırılım.
 *
 * Rakam yazıldıkça kırılım anında güncelleniyor; kaydetmek için düğmeye
 * basmak gerekiyor çünkü bütün taksitleri yeniden yazıyor.
 */
function TabanKutusu({
  grup,
  taban,
  bekliyor,
  hesapla,
}: {
  grup: Grup
  taban: number
  bekliyor: boolean
  hesapla: (grup: Grup, taban: string) => void
}) {
  const [deger, setDeger] = useState(taban > 0 ? String(taban).replace('.', ',') : '')

  const sayi = Number(deger.replace(/\./g, '').replace(',', '.'))
  const gecerli = Number.isFinite(sayi) && sayi > 0
  const k = gecerli ? kiraKirilimi(sayi, grup.kiraAnahtarlari.length) : null
  const bolunuyor = grup.kiraAnahtarlari.length > 1

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <label className="block text-xs font-semibold text-slate-700">{grup.ad}</label>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={deger}
          onChange={(e) => setDeger(e.target.value)}
          placeholder="Kira bedeli"
          className="girdi w-32 !py-1 text-right text-sm tabular-nums"
        />
        <button
          type="button"
          disabled={bekliyor || !gecerli}
          onClick={() => {
            if (
              window.confirm(
                `${grup.ad}: ${para(sayi)} üzerinden bütün taksitler yeniden yazılacak. ` +
                  'Ödendi işaretli satırlara dokunulmayacak. Onaylıyor musun?',
              )
            ) {
              hesapla(grup, deger)
            }
          }}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-40"
        >
          Hesapla ve doldur
        </button>
      </div>

      {k && (
        <dl className="mt-2 space-y-0.5 text-xs text-slate-700">
          <Satir
            ad="Arz payı"
            deger={para(k.arzTaksit)}
            not={`taksit başına · %3 · ödemeler ${k.arzOdemeleri.map((o) => para(o)).join(' · ')}`}
          />
          <Satir ad="İl Payı" deger={para(k.ilPayi)} not="taksit başına" />
          <Satir ad="İlçe Payı" deger={para(k.ilcePayi)} not="taksit başına" />
          <Satir
            ad="Okula kira"
            deger={para(k.kiraToplam)}
            not={
              bolunuyor ? `taksit başına · birim başına ${para(k.kiraBirimBasina)}` : 'taksit başına'
            }
          />
          <Satir
            ad="Taksit toplamı"
            deger={para(k.taksitToplami)}
            not={`8 taksit · yıllık ${para(k.yillikToplam)}`}
            kalin
          />
        </dl>
      )}
    </div>
  )
}

function Satir({
  ad,
  deger,
  not,
  kalin,
}: {
  ad: string
  deger: string
  not: string
  kalin?: boolean
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 ${
        kalin ? 'border-t border-slate-300 pt-1 font-semibold' : ''
      }`}
    >
      <dt className="w-24 shrink-0">{ad}</dt>
      <dd className="tabular-nums">{deger}</dd>
      <dd className="text-[11px] text-solgun">{not}</dd>
    </div>
  )
}

/** Bir kalemin bütün taksitleri; başlıkta ödenen toplam durur */
function Kutu({
  baslik,
  siralar,
  birim,
  kalem,
  mevcut,
  bekliyor,
  bugun,
  kaydet,
  odendi,
  yay,
}: {
  baslik: string
  siralar: number[]
  birim: string
  kalem: Kalem
  mevcut: Map<string, KiraSatiri>
  bekliyor: boolean
  bugun: string
  kaydet: (
    birim: string,
    kalem: Kalem,
    sira: number,
    alan: 'tutar' | 'odeme_tarihi' | 'belge_no',
    deger: string,
  ) => void
  odendi: (birim: string, kalem: Kalem, sira: number) => void
  yay: (birim: string, kalem: Kalem, tutar: number, hedefler: number[]) => void
}) {
  // Bütün kalemler kapalı açılır: dört kalem × beş birim açık olunca ekran
  // okunmuyordu. Başlıktaki özet zaten durumu söylüyor.
  const [acik, setAcik] = useState(false)

  const kayitlar = siralar.map((s) => mevcut.get(anahtar(birim, kalem, s)))
  const toplam = kayitlar.reduce((t, k) => t + Number(k?.tutar ?? 0), 0)
  const odenenSayi = kayitlar.filter((k) => k?.odendi).length

  // Kalem kutusu beyaz zeminde: birimin rengi arkada kalsın, rakamlar okunsun
  return (
    <div className="rounded-md border border-cizgi bg-white/55">
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"
      >
        <span>{acik ? '▾' : '▸'}</span>
        <span>{baslik}</span>
        <span className="ml-auto text-xs font-normal text-solgun">
          {odenenSayi}/{siralar.length} ödendi · {para(toplam)}
        </span>
      </button>

      {acik && (
        <div className="space-y-1 border-t border-cizgi p-2">
          {siralar.map((sira, i) => {
            const k = mevcut.get(anahtar(birim, kalem, sira))
            // Bu satırdan sonrası: tutar girilince aynı rakam oraya da yazılır
            const sonrakiler = siralar.slice(i + 1)
            return (
              <div
                key={sira}
                className={`flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1 ${
                  k?.odendi ? 'bg-emerald-100' : ''
                }`}
              >
                <span className="w-28 shrink-0 text-xs leading-tight font-medium">
                  {etiket(kalem, sira)}
                </span>

                <input
                  inputMode="decimal"
                  defaultValue={
                    k && Number(k.tutar) > 0 ? String(Number(k.tutar)).replace('.', ',') : ''
                  }
                  placeholder="Tutar"
                  onBlur={(e) => {
                    const yeni = e.target.value.trim()
                    const eski =
                      k && Number(k.tutar) > 0 ? String(Number(k.tutar)).replace('.', ',') : ''
                    if (yeni === eski) return
                    kaydet(birim, kalem, sira, 'tutar', yeni || '0')

                    // Aynı rakam sonraki taksitlere de yazılır; ortada zam
                    // gelirse o taksitten sonrası yeni rakama döner.
                    const sayi = Number(yeni.replace(/\./g, '').replace(',', '.'))
                    if (Number.isFinite(sayi) && sayi > 0 && sonrakiler.length > 0) {
                      yay(birim, kalem, sayi, sonrakiler)
                    }
                  }}
                  className="girdi w-24 !py-1 text-right text-xs tabular-nums"
                />

                <input
                  type="date"
                  /* Ödenmemiş satırda kutu bugünle gelir: tarihi her
                     seferinde elle yazmak gerekmesin. */
                  defaultValue={k?.odeme_tarihi ?? (k?.odendi ? '' : bugun)}
                  onBlur={(e) => {
                    if (e.target.value !== (k?.odeme_tarihi ?? ''))
                      kaydet(birim, kalem, sira, 'odeme_tarihi', e.target.value)
                  }}
                  className="girdi w-32 !py-1 text-xs"
                />

                <input
                  defaultValue={k?.belge_no ?? ''}
                  placeholder="Belge no"
                  onBlur={(e) => {
                    if (e.target.value !== (k?.belge_no ?? ''))
                      kaydet(birim, kalem, sira, 'belge_no', e.target.value)
                  }}
                  className="girdi w-24 !py-1 text-xs"
                />

                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => odendi(birim, kalem, sira)}
                  className={`ml-auto rounded px-2 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50 ${
                    k?.odendi
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-cizgi bg-white text-solgun hover:bg-slate-50'
                  }`}
                >
                  {k?.odendi ? '✓ Ödendi' : 'Ödendi'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AY_ADLARI, para } from '@/lib/format'

import { kiraKaydet, odendiDegistir, tutarYay } from './actions'

export type KiraSatiri = {
  id: string
  birim: string
  kalem: Kalem
  donem: string | null
  sira: number | null
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

/** Aylık kalemler; üç aylık kalem ayrı çünkü dönem yerine taksit sırası var */
const AYLIK_KALEMLER: Kalem[] = ['kira', 'il_payi', 'ilce_payi']

/**
 * Okullar ve altlarındaki birimler.
 *
 * Yan yana sütun başına bir okul, altında o okulun birimleri. Yeni bir birim
 * açılırsa buraya eklemek yeterli — veritabanında önceden satır yok.
 */
const OKULLAR: { ad: string; birimler: Birim[] }[] = [
  {
    ad: 'GÖKSU',
    birimler: [
      { ad: 'GÖKSU KANTİN', zemin: 'bg-amber-50/70', baslik: 'bg-amber-100 text-amber-900' },
      {
        ad: 'GÖKSU YEMEKHANE',
        zemin: 'bg-teal-50/70',
        baslik: 'bg-teal-100 text-teal-900',
      },
    ],
  },
  {
    ad: 'AKBABA',
    birimler: [
      {
        ad: 'AKBABA KANTİN İLKOKUL',
        zemin: 'bg-sky-50/70',
        baslik: 'bg-sky-100 text-sky-900',
      },
      {
        ad: 'AKBABA KANTİN ORTAOKUL',
        zemin: 'bg-indigo-50/70',
        baslik: 'bg-indigo-100 text-indigo-900',
      },
    ],
  },
  {
    ad: 'AHMET MİTHAT',
    birimler: [
      {
        ad: 'AHMET MİTHAT YEMEKHANE',
        zemin: 'bg-rose-50/70',
        baslik: 'bg-rose-100 text-rose-900',
      },
    ],
  },
]

/** Her birimin kendi soluk zemini: sütunlar birbirine karışmasın */
type Birim = { ad: string; zemin: string; baslik: string }

/**
 * Dönemler ikişer aylık: Eylül–Ekim, Ekim–Kasım, … Mayıs–Haziran.
 *
 * Sezon Eylül 2026 – Haziran 2027 olduğu için ardışık ay çiftleri dokuz
 * tane. Kayıtta dönem olarak çiftin ilk ayı tutuluyor; ad yalnızca ekranda.
 */
function donemler(): { iso: string; ad: string }[] {
  const liste: { iso: string; ad: string }[] = []
  for (let i = 0; i < 9; i++) {
    const bas = 8 + i // 8 = Eylül (0 tabanlı)
    const basYil = 2026 + Math.floor(bas / 12)
    const basAy = bas % 12
    const son = bas + 1
    const sonYil = 2026 + Math.floor(son / 12)
    const sonAy = son % 12

    // Yıl değişiyorsa iki yıl da yazılır: "Aralık 2026 – Ocak 2027"
    const ad =
      basYil === sonYil
        ? `${AY_ADLARI[basAy]}–${AY_ADLARI[sonAy]} ${basYil}`
        : `${AY_ADLARI[basAy]} ${basYil} – ${AY_ADLARI[sonAy]} ${sonYil}`

    liste.push({ iso: `${basYil}-${String(basAy + 1).padStart(2, '0')}-01`, ad })
  }
  return liste
}

const DONEMLER = donemler()
const TAKSITLER = [1, 2, 3]

/** Satır anahtarı: aylıkta dönem, üç aylıkta sıra ayırt eder */
function anahtar(birim: string, kalem: Kalem, donem: string | null, sira: number | null) {
  return `${birim}|${kalem}|${donem ?? ''}|${sira ?? ''}`
}

export function KiraEkrani({
  satirlar,
  bugun,
}: {
  satirlar: KiraSatiri[]
  /** Sunucunun bugünü — boş tarih kutularına varsayılan olarak yazılır */
  bugun: string
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)

  const mevcut = useMemo(() => {
    const m = new Map<string, KiraSatiri>()
    for (const s of satirlar) m.set(anahtar(s.birim, s.kalem, s.donem, s.sira), s)
    return m
  }, [satirlar])

  function kaydet(
    birim: string,
    kalem: Kalem,
    donem: string | null,
    sira: number | null,
    alan: 'tutar' | 'odeme_tarihi' | 'belge_no',
    deger: string,
  ) {
    const s = mevcut.get(anahtar(birim, kalem, donem, sira))
    const gonder = {
      birim,
      kalem,
      donem,
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

  function odendi(birim: string, kalem: Kalem, donem: string | null, sira: number | null) {
    const s = mevcut.get(anahtar(birim, kalem, donem, sira))
    baslat(async () => {
      const sonuc = await odendiDegistir({ birim, kalem, donem, sira }, !s?.odendi, bugun)
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj(null)
      router.refresh()
    })
  }

  /** Girilen tutarı sonraki dönemlere yayar; ödenmiş satırlara dokunmaz */
  function yay(
    birim: string,
    kalem: Kalem,
    tutar: number,
    hedefler: { donem: string | null; sira: number | null }[],
  ) {
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
              {okul.birimler.map((b) => {
                const birim = b.ad
                return (
                <div key={birim} className={`rounded-lg border border-cizgi ${b.zemin}`}>
                  <h3
                    className={`border-b border-cizgi px-3 py-2 text-sm font-semibold ${b.baslik}`}
                  >
                    {birim}
                  </h3>

                  <div className="space-y-3 p-3">
                    {AYLIK_KALEMLER.map((kalem) => (
                      <Bolum
                        key={kalem}
                        baslik={KALEM_ADLARI[kalem]}
                        satirlar={DONEMLER.map((d) => ({
                          etiket: d.ad,
                          donem: d.iso,
                          sira: null,
                        }))}
                        birim={birim}
                        kalem={kalem}
                        mevcut={mevcut}
                        bekliyor={bekliyor}
                        bugun={bugun}
                        kaydet={kaydet}
                        odendi={odendi}
                        yay={yay}
                      />
                    ))}

                    {/* Üç aylık kalem: dönem yok, 1./2./3. taksit var */}
                    <Bolum
                      baslik={KALEM_ADLARI.uc_aylik}
                      satirlar={TAKSITLER.map((t) => ({
                        etiket: `${t}. 3 Aylık Arz`,
                        donem: null,
                        sira: t,
                      }))}
                      birim={birim}
                      kalem="uc_aylik"
                      mevcut={mevcut}
                      bekliyor={bekliyor}
                      bugun={bugun}
                      kaydet={kaydet}
                      odendi={odendi}
                      yay={yay}
                    />
                  </div>
                </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Bir kalemin bütün dönem satırları; başlıkta ödenen toplam durur */
function Bolum({
  baslik,
  satirlar,
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
  satirlar: { etiket: string; donem: string | null; sira: number | null }[]
  birim: string
  kalem: Kalem
  mevcut: Map<string, KiraSatiri>
  bekliyor: boolean
  bugun: string
  kaydet: (
    birim: string,
    kalem: Kalem,
    donem: string | null,
    sira: number | null,
    alan: 'tutar' | 'odeme_tarihi' | 'belge_no',
    deger: string,
  ) => void
  odendi: (birim: string, kalem: Kalem, donem: string | null, sira: number | null) => void
  yay: (
    birim: string,
    kalem: Kalem,
    tutar: number,
    hedefler: { donem: string | null; sira: number | null }[],
  ) => void
}) {
  // Bütün kalemler kapalı açılır: dört kalem × beş birim açık olunca ekran
  // okunmuyordu. Başlıktaki özet zaten durumu söylüyor.
  const [acik, setAcik] = useState(false)

  const kayitlar = satirlar.map((s) => mevcut.get(anahtar(birim, kalem, s.donem, s.sira)))
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
          {odenenSayi}/{satirlar.length} ödendi · {para(toplam)}
        </span>
      </button>

      {acik && (
        <div className="space-y-1 border-t border-cizgi p-2">
          {satirlar.map((s, i) => {
            const k = mevcut.get(anahtar(birim, kalem, s.donem, s.sira))
            // Bu satırdan sonrası: tutar girilince aynı rakam oraya da yazılır
            const sonrakiler = satirlar.slice(i + 1).map((d) => ({ donem: d.donem, sira: d.sira }))
            return (
              <div
                key={s.etiket}
                className={`flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1 ${
                  k?.odendi ? 'bg-emerald-100' : ''
                }`}
              >
                {/* Dönem adı iki ay taşıyor: "Aralık 2026 – Ocak 2027" sığsın */}
                <span className="w-40 shrink-0 text-xs leading-tight font-medium">
                  {s.etiket}
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
                    kaydet(birim, kalem, s.donem, s.sira, 'tutar', yeni || '0')

                    // Aynı rakam sonraki dönemlere de yazılır; ortada zam
                    // gelirse o aydan sonrası yeni rakama döner.
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
                      kaydet(birim, kalem, s.donem, s.sira, 'odeme_tarihi', e.target.value)
                  }}
                  className="girdi w-32 !py-1 text-xs"
                />

                <input
                  defaultValue={k?.belge_no ?? ''}
                  placeholder="Belge no"
                  onBlur={(e) => {
                    if (e.target.value !== (k?.belge_no ?? ''))
                      kaydet(birim, kalem, s.donem, s.sira, 'belge_no', e.target.value)
                  }}
                  className="girdi w-24 !py-1 text-xs"
                />

                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => odendi(birim, kalem, s.donem, s.sira)}
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

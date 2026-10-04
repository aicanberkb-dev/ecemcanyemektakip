'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { para } from '@/lib/format'
import { kademeAraliklari, type Kademe, kiraKirilimi, TAKSIT_SAYISI } from '@/lib/kira-hesap'

import { hesaplaDoldur, kademeSil, kiraKaydet, odendiDegistir, tutarYay } from './actions'

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

/** Kalem adı; `uc_aylik` kodu eski adından kalma, ekranda Arz Bedeli */
const KALEM_ADLARI: Record<Kalem, string> = {
  kira: 'Kira',
  il_payi: 'İl Payı',
  ilce_payi: 'İlçe Payı',
  uc_aylik: 'Arz Bedeli',
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
  /** İl payı, ilçe payı ve arz bu birimlere eşit bölünür */
  paylarAnahtarlari: string[]
  bolumler: Bolum[]
}

const TUM_KALEMLER: Kalem[] = ['kira', 'il_payi', 'ilce_payi', 'uc_aylik']
const ORTAK_KALEMLER: Kalem[] = ['il_payi', 'ilce_payi', 'uc_aylik']

const OKULLAR: { ad: string; gruplar: Grup[] }[] = [
  {
    ad: 'GÖKSU',
    gruplar: [
      {
        // Kira kantin ve yemekhane için ortak, tek kalemde yatıyor; il,
        // ilçe ve arz ise her birim için ayrı ayrı ödeniyor. AKBABA'nın
        // tam tersi, orada kira bölünüyor paylar birleşiyor.
        anahtar: 'GÖKSU',
        ad: 'Kira Bedeli (Yemekhane + Kantin)',
        kiraAnahtarlari: ['GÖKSU'],
        paylarAnahtarlari: ['GÖKSU KANTİN', 'GÖKSU YEMEKHANE'],
        bolumler: [
          {
            ad: 'GÖKSU — Kira (Yemekhane + Kantin)',
            anahtar: 'GÖKSU',
            zemin: 'bg-amber-50/70',
            baslik: 'bg-amber-100 text-amber-900',
            kalemler: ['kira'],
          },
          {
            ad: 'GÖKSU KANTİN — Paylar',
            anahtar: 'GÖKSU KANTİN',
            zemin: 'bg-lime-50/70',
            baslik: 'bg-lime-100 text-lime-900',
            kalemler: ORTAK_KALEMLER,
          },
          {
            ad: 'GÖKSU YEMEKHANE — Paylar',
            anahtar: 'GÖKSU YEMEKHANE',
            zemin: 'bg-teal-50/70',
            baslik: 'bg-teal-100 text-teal-900',
            kalemler: ORTAK_KALEMLER,
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
        ad: 'Kantin Kira Bedeli (İlkokul + Ortaokul)',
        kiraAnahtarlari: ['AKBABA KANTİN İLKOKUL', 'AKBABA KANTİN ORTAOKUL'],
        paylarAnahtarlari: ['AKBABA KANTİN İLKOKUL'],
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
            ad: 'AKBABA — Ortak (İlkokul + Ortaokul)',
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
        ad: 'Yemekhane Kira Bedeli',
        kiraAnahtarlari: ['AHMET MİTHAT YEMEKHANE'],
        paylarAnahtarlari: ['AHMET MİTHAT YEMEKHANE'],
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
 * Bütün kalemler sekiz taksit; ay takvimiyle ilgisi yok, bu yüzden dönem
 * değil taksit sırası tutuluyor. Arz bedeli de aynı: üç taksiti birden
 * yatıran, üç satırı tek tek ödendi işaretler.
 */
const TAKSITLER = Array.from({ length: TAKSIT_SAYISI }, (_, i) => i + 1)

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
  /** Grup anahtarına göre kayıtlı kira bedeli kademeleri */
  tabanlar: Record<string, Kademe[]>
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

  /** Kira bedelini saklar, o taksitten sonrasını ondan hesaplayıp yazar */
  function hesapla(grup: Grup, taban: string, baslangic: number) {
    baslat(async () => {
      const sonuc = await hesaplaDoldur({
        tabanAnahtari: grup.anahtar,
        kiraAnahtarlari: grup.kiraAnahtarlari,
        paylarAnahtarlari: grup.paylarAnahtarlari,
        taban,
        baslangic,
      })
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else setMesaj({ tip: 'ok', metin: `${grup.ad}: ${sonuc.basari ?? 'Hesaplandı.'}` })
      router.refresh()
    })
  }

  /**
   * Bir kira değişikliğini kaldırır ve önceki kirayı o taksitlere yazar.
   *
   * Yalnız kademeyi silmek yetmiyordu: kaldırılan rakamla yazılmış taksitler
   * ekranda öylece kalıyor, hangi kiradan geldiği anlaşılmıyordu. Artık
   * önceki kademe kendi uzamış aralığını yeniden hesaplıyor.
   */
  function kademeKaldir(grup: Grup, sira: number, onceki?: Kademe) {
    baslat(async () => {
      const sonuc = await kademeSil(grup.anahtar, sira)
      if (sonuc.hata) {
        setMesaj({ tip: 'hata', metin: sonuc.hata })
        router.refresh()
        return
      }

      let metin = sonuc.basari ?? 'Kaldırıldı.'
      if (onceki) {
        const yeniden = await hesaplaDoldur({
          tabanAnahtari: grup.anahtar,
          kiraAnahtarlari: grup.kiraAnahtarlari,
          paylarAnahtarlari: grup.paylarAnahtarlari,
          taban: String(onceki.tutar).replace('.', ','),
          baslangic: onceki.sira,
        })
        metin = yeniden.hata ? yeniden.hata : `${metin} ${yeniden.basari ?? ''}`.trim()
      }

      setMesaj({ tip: 'ok', metin: `${grup.ad}: ${metin}` })
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
              <OkulOzeti okul={okul} satirlar={satirlar} />

              {okul.gruplar.map((grup) => (
                <div key={grup.anahtar} className="space-y-3">
                  <TabanKutusu
                    grup={grup}
                    kademeler={tabanlar[grup.anahtar] ?? []}
                    bekliyor={bekliyor}
                    hesapla={hesapla}
                    kademeKaldir={kademeKaldir}
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
                            siralar={TAKSITLER}
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
 * Okulun yıllık toplamı: ödenecek, ödenen, kalan.
 *
 * Kapalı açılır; kalem kutularında taksit taksit duran rakamların tek
 * yerden görünmesi için. Toplam, o okulun bütün birimlerindeki satırlardan
 * çıkıyor — hangi kalem olduğu burada önemli değil, kasadan çıkacak para
 * sorusunun cevabı.
 */
function OkulOzeti({
  okul,
  satirlar,
}: {
  okul: (typeof OKULLAR)[number]
  satirlar: KiraSatiri[]
}) {
  const [acik, setAcik] = useState(false)

  const { odenecek, odenen } = useMemo(() => {
    const birimler = new Set(
      okul.gruplar.flatMap((g) => [
        ...g.kiraAnahtarlari,
        ...g.paylarAnahtarlari,
        ...g.bolumler.map((b) => b.anahtar),
      ]),
    )

    let odenecek = 0
    let odenen = 0
    for (const s of satirlar) {
      if (!birimler.has(s.birim)) continue
      const tutar = Number(s.tutar)
      odenecek += tutar
      if (s.odendi) odenen += tutar
    }
    return { odenecek, odenen }
  }, [okul, satirlar])

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span>{acik ? '▾' : '▸'}</span>
        <span>Yıllık Özet</span>
      </button>

      {acik && (
        <dl className="space-y-0.5 border-t border-slate-300 p-3 text-xs text-slate-700">
          <Satir ad="Ödenecek" deger={para(odenecek)} not="8 taksit · bütün kalemler" />
          <Satir
            ad="Ödenen"
            deger={para(odenen)}
            not="ödendi işaretli satırlar"
            renk="yesil"
          />
          <Satir
            ad="Kalan"
            deger={para(odenecek - odenen)}
            not="ödenmemiş satırlar"
            renk="kirmizi"
            kalin
          />
        </dl>
      )}
    </div>
  )
}

/** "5–8. taksit" ya da tek taksitse "5. taksit" */
function aralikAdi(baslangic: number, bitis: number) {
  return baslangic === bitis ? `${baslangic}. taksit` : `${baslangic}–${bitis}. taksit`
}

/**
 * Kira bedeli ve ondan çıkan kırılım.
 *
 * Kira yıl içinde değişebildiği için tek rakam değil kademe listesi var:
 * "1–3. taksit 15.000", "4–8. taksit 18.000". Eski rakam gözden kaybolmasın
 * diye hepsi listede duruyor; tıklanınca o kademenin kırılımı açılıyor.
 */
function TabanKutusu({
  grup,
  kademeler,
  bekliyor,
  hesapla,
  kademeKaldir,
}: {
  grup: Grup
  kademeler: Kademe[]
  bekliyor: boolean
  hesapla: (grup: Grup, taban: string, baslangic: number) => void
  kademeKaldir: (grup: Grup, sira: number, onceki?: Kademe) => void
}) {
  const araliklar = kademeAraliklari(kademeler)
  // Kutu kapalı açılır: kalem kutuları gibi, ekran kalabalıklaşmasın.
  // Başlıkta geçerli kira zaten yazıyor.
  const [kutuAcik, setKutuAcik] = useState(false)
  const [formAcik, setFormAcik] = useState(araliklar.length === 0)
  const [secili, setSecili] = useState(() => Math.max(0, araliklar.length - 1))
  const [deger, setDeger] = useState('')
  const [baslangic, setBaslangic] = useState(() => (araliklar.length === 0 ? 1 : 2))

  const sayi = Number(deger.replace(/\./g, '').replace(',', '.'))
  const gecerli = Number.isFinite(sayi) && sayi > 0
  const bolunuyor = grup.kiraAnahtarlari.length > 1
  const acik = araliklar[secili]
  // Başlıktaki özet: yürürlükteki kira, yani son kademe
  const son = araliklar.at(-1)

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50">
      <button
        type="button"
        onClick={() => setKutuAcik(!kutuAcik)}
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        <span>{kutuAcik ? '▾' : '▸'}</span>
        <span>{grup.ad}</span>
        <span className="ml-auto font-normal text-solgun">
          {son
            ? `${para(son.tutar)}${araliklar.length > 1 ? ` · ${araliklar.length} kademe` : ''}`
            : 'girilmedi'}
        </span>
      </button>

      {kutuAcik && (
        <div className="border-t border-slate-300 p-3">
          {araliklar.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {araliklar.map((a, i) => (
                <li
                  key={a.baslangic}
                  className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 text-xs ${
                    i === secili ? 'bg-white ring-1 ring-slate-300' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSecili(i)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="w-24 shrink-0 font-medium">
                      {aralikAdi(a.baslangic, a.bitis)}
                    </span>
                    <span className="font-semibold tabular-nums">{para(a.tutar)}</span>
                  </button>

                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      disabled={bekliyor}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${grup.ad}: ${aralikAdi(a.baslangic, a.bitis)} ${para(a.tutar)} ` +
                              'üzerinden yeniden yazılacak. Ödendi işaretli satırlara ' +
                              'dokunulmayacak. Onaylıyor musun?',
                          )
                        ) {
                          hesapla(grup, String(a.tutar).replace('.', ','), a.baslangic)
                        }
                      }}
                      className="rounded border border-cizgi bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Hesapla
                    </button>
                    {a.baslangic > 1 && (
                      <button
                        type="button"
                        disabled={bekliyor}
                        onClick={() => {
                          const onceki = araliklar[i - 1]
                          if (
                            window.confirm(
                              `${a.baslangic}. taksitteki kira değişikliği kaldırılsın mı? ` +
                                `${aralikAdi(a.baslangic, a.bitis)} yeniden ` +
                                `${para(onceki.tutar)} üzerinden hesaplanacak; ödendi ` +
                                'işaretli satırlara dokunulmayacak.',
                            )
                          ) {
                            kademeKaldir(grup, a.baslangic, {
                              sira: onceki.baslangic,
                              tutar: onceki.tutar,
                            })
                          }
                        }}
                        className="rounded px-1.5 py-0.5 text-[11px] text-solgun hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        aria-label={`${a.baslangic}. taksitteki değişikliği kaldır`}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {acik && <Kirilim taban={acik.tutar} grup={grup} bolunuyor={bolunuyor} aralik={acik} />}

          {formAcik ? (
            <div className="mt-2 space-y-2 rounded-md border border-slate-300 bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  inputMode="decimal"
                  value={deger}
                  onChange={(e) => setDeger(e.target.value)}
                  placeholder="Yeni Kira Bedeli"
                  className="girdi w-32 !py-1 text-right text-sm tabular-nums"
                  aria-label="Yeni kira bedeli"
                />
                <select
                  value={baslangic}
                  onChange={(e) => setBaslangic(Number(e.target.value))}
                  className="girdi !py-1 text-xs"
                  aria-label="Yeni kiranın geçerli olduğu ilk taksit"
                >
                  {TAKSITLER.map((t) => (
                    <option key={t} value={t}>
                      {t}. taksitten itibaren
                    </option>
                  ))}
                </select>
              </div>

              {gecerli && (
                <p className="text-[11px] text-solgun">
                  {aralikAdi(baslangic, TAKSIT_SAYISI)} {para(sayi)} üzerinden yazılacak.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bekliyor || !gecerli}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${grup.ad}: ${baslangic}. taksitten itibaren kira ${para(sayi)} olacak ve ` +
                          'o taksitler yeniden yazılacak. Öncesine ve ödendi işaretli satırlara ' +
                          'dokunulmayacak. Onaylıyor musun?',
                      )
                    ) {
                      hesapla(grup, deger, baslangic)
                      setDeger('')
                      if (araliklar.length > 0) setFormAcik(false)
                    }
                  }}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-40"
                >
                  Kaydet ve Hesapla
                </button>
                {araliklar.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormAcik(false)
                      setDeger('')
                    }}
                    className="rounded-md px-2 py-1.5 text-xs text-solgun hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormAcik(true)}
              className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              + Kira Değişikliği
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Bir kademenin taksit başına kırılımı */
function Kirilim({
  taban,
  grup,
  bolunuyor,
  aralik,
}: {
  taban: number
  grup: Grup
  bolunuyor: boolean
  aralik: { baslangic: number; bitis: number }
}) {
  const k = kiraKirilimi(taban, grup.kiraAnahtarlari.length, grup.paylarAnahtarlari.length)
  const adet = aralik.bitis - aralik.baslangic + 1
  // Paylar birden çok birimde ayrı yatıyorsa birim başına düşeni de yaz
  const paylarBolunuyor = grup.paylarAnahtarlari.length > 1
  const payNotu = (birim: number) =>
    paylarBolunuyor ? `taksit başına · birim başına ${para(birim)}` : 'taksit başına'

  return (
    <dl className="mt-2 space-y-0.5 text-xs text-slate-700">
      <Satir
        ad="Arz Bedeli"
        deger={para(k.arzTaksit)}
        not={`${payNotu(k.arzBirim)} · %3`}
      />
      <Satir ad="İl Payı" deger={para(k.ilPayi)} not={payNotu(k.ilPayiBirim)} />
      <Satir ad="İlçe Payı" deger={para(k.ilcePayi)} not={payNotu(k.ilcePayiBirim)} />
      <Satir
        ad="Okula Kira"
        deger={para(k.kiraToplam)}
        not={bolunuyor ? `taksit başına · birim başına ${para(k.kiraBirimBasina)}` : 'taksit başına'}
      />
      <Satir
        ad="Taksit Toplamı"
        deger={para(k.taksitToplami)}
        not={`${aralikAdi(aralik.baslangic, aralik.bitis)} · ${adet} taksit · toplam ${para(
          k.taksitToplami * adet,
        )}`}
        kalin
      />
    </dl>
  )
}

function Satir({
  ad,
  deger,
  not,
  kalin,
  renk,
}: {
  ad: string
  deger: string
  not: string
  kalin?: boolean
  /** Ödenen yeşil, ödenmemiş kalan kırmızı */
  renk?: 'yesil' | 'kirmizi'
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 ${
        kalin ? 'border-t border-slate-300 pt-1 font-semibold' : ''
      }`}
    >
      <dt className="w-24 shrink-0">{ad}</dt>
      <dd
        className={`font-semibold tabular-nums ${
          renk === 'yesil' ? 'text-emerald-700' : renk === 'kirmizi' ? 'text-red-700' : ''
        }`}
      >
        {deger}
      </dd>
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
  const odenen = kayitlar.reduce((t, k) => t + (k?.odendi ? Number(k.tutar) : 0), 0)
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
        {/* Kapalıyken de kalem bazında durum görünsün: toplam, ödenen,
            kalan. Üstteki yıllık özetin kalem kalem dağılımı bu. */}
        <span className="ml-auto flex flex-wrap items-baseline justify-end gap-x-2 text-xs font-normal">
          <span className="text-solgun">
            {odenenSayi}/{siralar.length} ödendi
          </span>
          <span className="tabular-nums">{para(toplam)}</span>
          <span className="text-emerald-700 tabular-nums">{para(odenen)}</span>
          <span className="text-red-700 tabular-nums">{para(toplam - odenen)}</span>
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
                  {sira}. Taksit
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

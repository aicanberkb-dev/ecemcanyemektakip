'use client'

import { useState } from 'react'

import { AY_ADLARI, para, tarih as tarihBicim } from '@/lib/format'
import { OGRENCI_TIPI_ADLARI, type OgrenciTipi, type TaksitPlani } from '@/lib/types'

/** 1. sınıfın ayrı planı yok — standart planın satırlarını kullanır. */
function planTipi(tip: OgrenciTipi): OgrenciTipi {
  return tip === 'birinci_sinif' ? 'standart' : tip
}

/**
 * Formun başlığı okulun resmî adıyla yazılır: veli kâğıdı eline aldığında
 * hangi okulun formu olduğunu görmeli. Sistemdeki okul adı kısaltma ("GÖKSU"),
 * bu yüzden burada eşleniyor; tanımsız bir okul için makul bir başlık üretilir.
 */
/** Başlık iki satır: üstte okulun adı, altında formun adı. Satırlar kırılmaz. */
const FORM_BASLIKLARI: Record<string, [string, string]> = {
  GÖKSU: ['Göksu Şehit Er Ersin Güner Okulu', 'Yemekhane Kayıt Formu'],
  'AHMET MİTHAT': ['Beykoz Ahmet Mithat Efendi Okulu', 'Kayıt Formu'],
}

function formBasligi(okulAdi: string): [string, string] {
  return FORM_BASLIKLARI[okulAdi.trim()] ?? [`${okulAdi} Okulu`, 'Yemekhane Kayıt Formu']
}

/**
 * Okula göre banka ve iletişim bilgisi, ve kayıt tipi açıklamaları.
 *
 * Okullar farklı hesaba ödeme alıyor. AHMET MİTHAT'ta veliye iki kayıt tipi
 * arasındaki fark kâğıt üzerinde açıkça anlatılıyor; önceki dönemlerde ay
 * başında bakiye hesaplayıp veliyi arama usulü bırakıldı.
 */
type OkulBilgisi = {
  iban: string
  alici: string
  iletisim: { ad: string; tel: string }[]
  /**
   * Kayıt bilgilerinde günlükçü / aylıkçı açıklamaları yazılsın mı. Açıklamalar
   * yer kapladığı için bu formda aralıklar da daralıyor: form tek A4'e sığsın.
   * Tablonun altındaki ödeme cümlesi de "Taksit ödemeleri" diye başlıyor:
   * günlükçüden havale alınmadığı için "ödemeler" genel kalıp karışıyordu.
   */
  kayitAciklamasi: boolean
}

const VARSAYILAN_BILGI: OkulBilgisi = {
  iban: 'TR40 0001 0005 3202 6049 0950 02',
  alici: 'EKREM BAŞLANTI',
  iletisim: [
    { ad: 'Ecem Can Gıda', tel: '0551 514 18 46' },
    { ad: 'Ayşe Hanım', tel: '0553 985 67 68' },
  ],
  kayitAciklamasi: false,
}

const OKUL_BILGILERI: Record<string, OkulBilgisi> = {
  GÖKSU: VARSAYILAN_BILGI,
  'AHMET MİTHAT': {
    iban: 'TR34 0001 0005 3202 6049 0950 13',
    alici: 'EKREM BAŞLANTI',
    iletisim: [
      { ad: 'Ecem Can Gıda', tel: '0551 514 18 46' },
      { ad: 'Meltem Hanım', tel: '0541 349 79 71' },
      { ad: 'Ayşe Hanım', tel: '0553 985 67 68' },
    ],
    kayitAciklamasi: true,
  },
}

function okulBilgisi(okulAdi: string): OkulBilgisi {
  return OKUL_BILGILERI[okulAdi.trim()] ?? VARSAYILAN_BILGI
}

/**
 * Başlıktaki ikinci satır: anasınıfı formları uzaktan ayırt edilebilsin.
 *
 * Standart ve 1. sınıf formlarında yok — okul adı yeterli. Anasınıfının iki
 * çeşidi ise birbirine benziyor, kâğıt masada karıştığında hangisi olduğu
 * ancak taksit tablosuna bakınca anlaşılıyordu.
 */
const BASLIK_ALT: Partial<Record<OgrenciTipi, string>> = {
  anasinifi: 'ANASINIFI',
  anasinifi_etut: 'Anasınıfı Etüt Yemeği',
}

/**
 * Etüt formunda yalnız etüt yemeğinin taksitleri yazılır.
 *
 * Plandaki etüt satırları öğle yemeğiyle birleşik tutuluyor (aralık ve şubat
 * taksitleri 20.000 ₺: 13.000 yemek + 7.000 etüt). Formda etüt payı ayrı
 * görünmeli ama velinin o gün ödeyeceği toplam da kaybolmamalı. Etüt payı,
 * aynı vadeli anasınıfı (yemek) taksitinden çıkarılarak bulunuyor; rakam
 * forma elle yazılmıyor ki fiyat değişince çıktı da doğru kalsın.
 */
type EtutSatiri = {
  id: string
  ad: string
  vade_tarihi: string
  tutar: number
  /** O vadede yemek taksitiyle birlikte ödenecek toplam */
  birlikte: number | null
}

function etutSatirlari(etutPlani: TaksitPlani[], yemekPlani: TaksitPlani[]): EtutSatiri[] {
  return etutPlani
    .map((t) => {
      const yemek = yemekPlani.find((y) => y.vade_tarihi === t.vade_tarihi)
      const birlesik = Number(t.tutar)
      const etut = birlesik - Number(yemek?.tutar ?? 0)
      return {
        id: t.id,
        ad: t.ad,
        vade_tarihi: t.vade_tarihi,
        tutar: etut,
        birlikte: yemek ? birlesik : null,
      }
    })
    // Yalnız yemeğe ait satır (etüt payı sıfır) etüt formunda yer almaz
    .filter((s) => s.tutar > 0)
    .map((s, i) => ({ ...s, ad: `${i + 1}. Taksit` }))
}

/**
 * Taksitin vadesi veliye tarihten çok sözle anlatılıyor: "aralık sonu" akılda
 * kalıyor, 31.12.2026 kalmıyor. İlk taksit kayıt anında alındığı için onun
 * tarihi hiç yazılmaz.
 *
 * Etiket tarihten türetiliyor, sabit yazılmıyor: planlar okula ve tipe göre
 * farklı (kimi ayın 15'i, kimi ay sonu, kimi 4 taksit). Sabit bir liste bir
 * planda doğru, öbüründe veliye yanlış tarih söylerdi.
 */
function vadeEtiketi(isoTarih: string, sira: number): string {
  if (sira === 0) return 'KAYIT ESNASINDA'

  const d = new Date(isoTarih)
  if (Number.isNaN(d.getTime())) return ''

  const ay = AY_ADLARI[d.getMonth()].toLocaleUpperCase('tr')
  const gun = d.getDate()
  const ayinSonGunu = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

  if (gun >= ayinSonGunu - 2) return `${ay} SONU`
  if (gun <= 3) return `${ay} BAŞI`
  if (gun >= 13 && gun <= 17) return `${ay} ORTASI`
  return `${ay} AYINDA`
}

/**
 * Veli kayda geldiğinde doldurulan basılı form.
 *
 * Taksit tarihleri ve tutarları sistemdeki plandan gelir; elle yazılan bir
 * fiyat listesi zamanla gerçekle ayrışır.
 */

/** Her tipin kendi rengi var: kâğıtlar masada karışmasın. */
const TIP_GORUNUM: Record<
  OgrenciTipi,
  { kenar: string; zemin: string; yazi: string; serit: string }
> = {
  standart: {
    kenar: 'border-slate-800',
    zemin: 'bg-slate-100',
    yazi: 'text-slate-900',
    serit: 'bg-slate-800',
  },
  birinci_sinif: {
    kenar: 'border-rose-600',
    zemin: 'bg-rose-100',
    yazi: 'text-rose-900',
    serit: 'bg-rose-600',
  },
  anasinifi: {
    kenar: 'border-amber-600',
    zemin: 'bg-amber-100',
    yazi: 'text-amber-900',
    serit: 'bg-amber-500',
  },
  anasinifi_etut: {
    kenar: 'border-violet-600',
    zemin: 'bg-violet-100',
    yazi: 'text-violet-900',
    serit: 'bg-violet-600',
  },
}

export function KayitFormuCiktisi({
  okulAdi,
  sezonAdi,
  plan,
  tipler,
}: {
  okulAdi: string
  sezonAdi: string
  plan: TaksitPlani[]
  tipler: OgrenciTipi[]
}) {
  const [secili, setSecili] = useState<OgrenciTipi[]>(tipler)

  const yazdirilacak = tipler.filter((t) => secili.includes(t))

  return (
    <>
      <div className="kart yazdirma-gizle flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium">Yazdırılacak formlar:</span>
        {tipler.map((t) => {
          const g = TIP_GORUNUM[t]
          const isaretli = secili.includes(t)
          return (
            <label
              key={t}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                isaretli ? `${g.kenar} ${g.zemin} font-semibold ${g.yazi}` : 'border-cizgi'
              }`}
            >
              <input
                type="checkbox"
                checked={isaretli}
                onChange={(e) =>
                  setSecili((o) =>
                    e.target.checked ? [...o, t] : o.filter((x) => x !== t),
                  )
                }
              />
              {OGRENCI_TIPI_ADLARI[t]}
              <span className="text-xs font-normal text-solgun">
                {plan.filter((p) => p.ogrenci_tipi === planTipi(t)).length} taksit
                {t === 'birinci_sinif' && ' (standart)'}
              </span>
            </label>
          )
        })}
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-birincil ml-auto"
          disabled={yazdirilacak.length === 0}
        >
          Yazdır ({yazdirilacak.length} form)
        </button>
      </div>

      {yazdirilacak.map((tip, i) => (
        <Form
          key={tip}
          tip={tip}
          okulAdi={okulAdi}
          sezonAdi={sezonAdi}
          taksitler={plan
            .filter((p) => p.ogrenci_tipi === planTipi(tip))
            .sort((a, b) => a.vade_tarihi.localeCompare(b.vade_tarihi))}
          yemekPlani={plan
            .filter((p) => p.ogrenci_tipi === 'anasinifi')
            .sort((a, b) => a.vade_tarihi.localeCompare(b.vade_tarihi))}
          sonMu={i === yazdirilacak.length - 1}
        />
      ))}
    </>
  )
}

function Form({
  tip,
  okulAdi,
  sezonAdi,
  taksitler,
  yemekPlani,
  sonMu,
}: {
  tip: OgrenciTipi
  okulAdi: string
  sezonAdi: string
  taksitler: TaksitPlani[]
  /** Anasınıfı (öğle yemeği) planı — etüt payını ayırmak için */
  yemekPlani: TaksitPlani[]
  sonMu: boolean
}) {
  const g = TIP_GORUNUM[tip]
  const bilgi = okulBilgisi(okulAdi)
  const etutMu = tip === 'anasinifi_etut' && yemekPlani.length > 0
  const satirlar: EtutSatiri[] = etutMu
    ? etutSatirlari(taksitler, yemekPlani)
    : taksitler.map((t) => ({
        id: t.id,
        ad: t.ad,
        vade_tarihi: t.vade_tarihi,
        tutar: Number(t.tutar),
        birlikte: null,
      }))
  const toplam = satirlar.reduce((t, x) => t + x.tutar, 0)
  // Anasınıfında günlükçü diye bir şey yok; ödeme şekli sorulmuyor.
  const anasinifiMi = tip === 'anasinifi' || tip === 'anasinifi_etut'
  // Açıklamalı formda bölümler arası boşluk dar: yoksa form ikinci sayfaya taşıyor
  const sikisik = bilgi.kayitAciklamasi

  return (
    <div className="space-y-2" style={sonMu ? undefined : { breakAfter: 'page' }}>
      <section className={`kart kayit-formu-kagit border-2 p-0 ${g.kenar}`}>
        {/* Okul başlığı kâğıdın en üstünde; renk şeridi tipleri ayırt ettiriyor.
            Logo solda: veli kâğıdı kimin verdiğini görsün. */}
        <div className={`${g.serit} flex items-center gap-3 px-4 py-3 text-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo */}
          <img
            src="/logo/logo-kirmizi-beyaz.svg"
            alt=""
            className="h-24 w-auto max-w-[24%] shrink-0 object-contain drop-shadow-[0_3px_6px_rgb(0_0_0/0.45)]"
          />
          <div className="min-w-0 flex-1 text-center">
          {/* İki satır: üstte okul, altında formun adı; ikisi de kırılmaz */}
          <span className="block text-lg leading-tight font-black tracking-wide whitespace-nowrap">
            {formBasligi(okulAdi)[0]}
          </span>
          <span className="block text-lg leading-tight font-black tracking-wide whitespace-nowrap">
            {formBasligi(okulAdi)[1]}
          </span>
          {BASLIK_ALT[tip] && (
            <div className="mt-2">
              <span className="inline-block rounded border-2 border-white px-4 py-0.5 text-lg font-black tracking-[0.2em]">
                {BASLIK_ALT[tip]}
              </span>
            </div>
          )}
          {/* Tek satır: dar ekranda "GIDA" alta düşüyordu */}
          <div className="mt-1 text-xs font-semibold tracking-[0.12em] whitespace-nowrap opacity-90">
            EKREM BAŞLANTI - ECEM CAN GIDA
          </div>
          </div>
          {/* Sağda ikinci logo: başlık iki logonun ortasında kalır */}
          {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo */}
          <img
            src="/logo/logo-kirmizi-beyaz.svg"
            alt=""
            className="h-24 w-auto max-w-[24%] shrink-0 object-contain drop-shadow-[0_3px_6px_rgb(0_0_0/0.45)]"
          />
        </div>

        <div className={`${sikisik ? 'space-y-3' : 'space-y-5'} p-5`}>
          <div className="border-b border-slate-300 pb-2 text-center text-sm font-semibold">
            {sezonAdi} Eğitim Öğretim Yılı
          </div>

          {/* Öğrenci */}
          <div>
            <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>ÖĞRENCİ BİLGİLERİ</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Satir etiket="Adı Soyadı" />
              <Satir etiket="Sınıfı" />
            </div>
          </div>

          {/* Veli */}
          <div>
            <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>VELİ BİLGİLERİ</h3>
            {/* Üçüncü sütun T.C. no: fatura kesilirken gereken tek alan bu.
                Etüt formunda veli bilgisi asıl anasınıfı formunda zaten
                alınıyor; burada yalnız ad soyad soruluyor. */}
            {etutMu ? (
              <div className="grid grid-cols-3 gap-x-6">
                <div className="col-span-2">
                  <Satir etiket="1. Veli Adı Soyadı" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <Satir etiket="1. Veli Adı Soyadı" />
                <Satir etiket="1. Veli Telefon" />
                <Satir etiket="Fatura için TC Kimlik No" />
                <Satir etiket="2. Veli Adı Soyadı" />
                <Satir etiket="2. Veli Telefon" />
                <Satir etiket="Fatura için TC Kimlik No" />
              </div>
            )}
          </div>

          {/* Abone tipi — anasınıfında seçenek yok, hepsi taksitli */}
          {!anasinifiMi && (
            <div>
              <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>KAYIT BİLGİLERİ</h3>
              {bilgi.kayitAciklamasi ? (
                <KayitTipiAciklamalari />
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-700">Ödeme Şekli</p>
                  <div className="mt-1 flex gap-12 text-sm">
                    <Kutucuk etiket="Aylıkçı (Taksitli)" />
                    <Kutucuk etiket="Günlükçü (Yemek Başına)" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Taksit planı */}
          <div>
            <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>
              {etutMu
                ? 'Etüt Yemeği Taksit Planı'
                : `${OGRENCI_TIPI_ADLARI[tip].toLocaleUpperCase('tr')} TAKSİT PLANI`}
              {tip === 'birinci_sinif' && (
                <span className="ml-2 text-xs font-normal text-slate-600">
                  (standart ücret tarifesi)
                </span>
              )}
            </h3>
            {satirlar.length === 0 ? (
              <p className="rounded border border-dashed border-slate-400 px-3 py-4 text-center text-sm text-slate-600">
                Bu tip için {sezonAdi} sezonunda taksit tanımlı değil.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={g.zemin}>
                    <th className="border border-slate-400 px-2 py-1.5 text-left">
                      Taksit
                    </th>
                    <th className="border border-slate-400 px-2 py-1.5 text-left">
                      Son Ödeme
                    </th>
                    <th className="border border-slate-400 px-2 py-1.5 text-right">
                      Tutar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((t, i) => {
                    const etiket = vadeEtiketi(t.vade_tarihi, i)
                    // İlk taksit kayıt anında alınıyor; tarih yazmak kafa karıştırır.
                    const tarihGoster = i > 0
                    return (
                      <tr key={t.id}>
                        <td className="border border-slate-400 px-2 py-1.5">{t.ad}</td>
                        <td className="border border-slate-400 px-2 py-1.5">
                          {tarihGoster && (
                            <span className="mr-2">{tarihBicim(t.vade_tarihi)}</span>
                          )}
                          {etiket && (
                            <strong className="font-bold tracking-wide">{etiket}</strong>
                          )}
                        </td>
                        <td className="border border-slate-400 px-2 py-1.5 text-right font-medium tabular-nums">
                          {para(t.tutar)}
                          {t.birlikte !== null && (
                            <span className="mt-1 block rounded border border-violet-400 bg-violet-100 px-1.5 py-1 text-xs leading-tight font-bold text-violet-900">
                              Anasınıfı Öğle Yemeği taksitiyle
                              <br />
                              birlikte {para(t.birlikte)} ödenir
                              <span className="mt-0.5 block font-semibold">
                                ({para(t.birlikte - t.tutar)} Öğle Yemeği {i + 1}. taksit +{' '}
                                {para(t.tutar)} Etüt Yemeği {i + 1}. taksit)
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className={`${g.zemin} font-bold`}>
                    <td className="border border-slate-400 px-2 py-1.5" colSpan={2}>
                      {etutMu ? 'Etüt Yemeği Yıllık Toplam' : 'YILLIK TOPLAM'} (
                      {satirlar.length} Taksit)
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">
                      {para(toplam)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="mt-2 text-xs text-slate-600">
              {bilgi.kayitAciklamasi ? 'Taksit ödemeleri' : 'Ödemeler'} banka havalesi, nakit
              veya kredi kartı ile yapılabilir. Havale açıklamasına{' '}
              <strong>öğrencinin adı</strong> yazılması ödemenin doğru öğrenciye işlenmesi
              için önemlidir.
            </p>

            {/* Banka ve iletişim — velinin formu elinden bırakmadan bakacağı bilgiler */}
            <div className="mt-3 rounded border border-slate-400 px-3 py-2.5 text-sm">
              <p className="text-slate-700">
                Taksit ödemelerinizi aşağıdaki banka hesabına yapmanızı rica ederiz.
              </p>
              <p className="mt-1.5 font-bold tracking-wide tabular-nums">IBAN: {bilgi.iban}</p>
              <p className="font-semibold">Alıcı: {bilgi.alici}</p>
              <p className="mt-2 text-slate-700">
                {bilgi.iletisim.map((k, i) => (
                  <span key={k.ad}>
                    {i > 0 && <span className="mx-2 text-slate-400">•</span>}
                    <strong>{k.ad}:</strong> {k.tel}
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Veli imzası — sağ altta, kâğıdın kapanışı */}
          <div className="flex justify-end">
            <div className="w-64">
              <p className="text-xs font-semibold text-slate-700">Veli İmza</p>
              <div className={`${sikisik ? 'mt-8' : 'mt-10'} border-b border-slate-500`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * İki kayıt tipi ve farkları (AHMET MİTHAT). Günlükçü önce: veliye önce en
 * esnek seçenek anlatılıyor, havale kabul edilmediği açıkça yazıyor.
 *
 * Bakiye hesaplanıp veliyi arama usulünün bittiği cümle kalın ve büyük: eski
 * alışkanlıkla bekleyen veli bunu kaçırmamalı.
 */
function KayitTipiAciklamalari() {
  return (
    <div className="space-y-1.5">
      <p className="text-xs leading-snug text-slate-700">
        Öğrencilerimiz 2 farklı kayıt tipinden birini seçerek yemekhaneden faydalanabilir.{' '}
        <strong className="text-sm font-bold text-slate-900">
          Geçmiş dönemlerde uyguladığımız “aybaşlarında öğrencinin bakiyesinin hesaplanıp
          veliyle iletişime geçilmesi” şeklinde ilerlemeyeceğiz.
        </strong>
      </p>
      <div>
        <Kutucuk etiket="Günlükçü (Yemek Başına)" kalin />
        <p className="mt-0.5 ml-[1.375rem] text-xs leading-snug text-slate-700">
          Öğrenci yemeğe katılmak istediği günlerde güncel günlük yemek ücretini nakit
          veya kredi kartı ile ödeyebilir. <strong>Banka havalesi kabul edilmeyecektir.</strong>{' '}
          Günlük yemek ücreti Eylül 2026 itibarıyla <strong>240 TL</strong>’dir. 2. dönem
          başlangıcında fiyat güncellenecektir.
        </p>
      </div>
      <div>
        <Kutucuk etiket="Aylıkçı (Taksitli)" kalin />
        <p className="mt-0.5 ml-[1.375rem] text-xs leading-snug text-slate-700">
          Öğrenci sabit bir yıllık ücretle yemekhaneye kayıt edilecektir. Yıl içinde
          herhangi bir fiyat değişikliği olmayacaktır. Ücret, ilk taksiti kayıt esnasında
          olmak üzere dönem başına 2 taksit, toplam <strong>4 eşit taksit</strong> halinde
          ödenecektir.
        </p>
      </div>
    </div>
  )
}

function Satir({
  etiket,
  ipucu,
  genis,
}: {
  etiket: string
  ipucu?: string
  genis?: boolean
}) {
  return (
    <div className={genis ? 'col-span-2' : undefined}>
      <p className="text-xs font-semibold text-slate-700">
        {etiket}
        {ipucu && <span className="ml-1 font-normal text-slate-500">({ipucu})</span>}
      </p>
      <div className="mt-4 border-b border-slate-400" />
    </div>
  )
}

function Kutucuk({ etiket, kalin }: { etiket: string; kalin?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${kalin ? 'text-sm font-bold' : ''}`}>
      <span className="inline-block h-4 w-4 shrink-0 border border-slate-600" />
      {etiket}
    </span>
  )
}

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
const FORM_BASLIKLARI: Record<string, string> = {
  GÖKSU: 'Göksu Şehit Er Ersin Güner Okulu Yemekhane Kayıt Formu',
  'AHMET MİTHAT': 'Beykoz Ahmet Mithat Okulu Kayıt Formu',
}

function formBasligi(okulAdi: string): string {
  return FORM_BASLIKLARI[okulAdi.trim()] ?? `${okulAdi} Okulu Yemekhane Kayıt Formu`
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
  sonMu,
}: {
  tip: OgrenciTipi
  okulAdi: string
  sezonAdi: string
  taksitler: TaksitPlani[]
  sonMu: boolean
}) {
  const g = TIP_GORUNUM[tip]
  const toplam = taksitler.reduce((t, x) => t + Number(x.tutar), 0)

  return (
    <div className="space-y-2" style={sonMu ? undefined : { breakAfter: 'page' }}>
      <section className={`kart kayit-formu-kagit border-2 p-0 ${g.kenar}`}>
        {/* Okul başlığı kâğıdın en üstünde; renk şeridi tipleri ayırt ettiriyor */}
        <div className={`${g.serit} px-5 py-4 text-center text-white`}>
          <span className="text-xl font-black tracking-wide">
            {formBasligi(okulAdi)}
          </span>
        </div>

        <div className="space-y-5 p-5">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Satir etiket="1. Veli Adı Soyadı" />
              <Satir etiket="1. Veli Telefon" />
              <Satir etiket="2. Veli Adı Soyadı" />
              <Satir etiket="2. Veli Telefon" />
            </div>
          </div>

          {/* Abone tipi */}
          <div>
            <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>KAYIT BİLGİLERİ</h3>
            <p className="text-xs font-semibold text-slate-700">Ödeme Şekli</p>
            <div className="mt-1 flex gap-12 text-sm">
              <Kutucuk etiket="Aylıkçı (Taksitli)" />
              <Kutucuk etiket="Günlükçü (Yemek Başına)" />
            </div>
          </div>

          {/* Taksit planı */}
          <div>
            <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>
              {OGRENCI_TIPI_ADLARI[tip].toLocaleUpperCase('tr')} TAKSİT PLANI
              {tip === 'birinci_sinif' && (
                <span className="ml-2 text-xs font-normal text-slate-600">
                  (standart ücret tarifesi)
                </span>
              )}
            </h3>
            {taksitler.length === 0 ? (
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
                  {taksitler.map((t, i) => {
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className={`${g.zemin} font-bold`}>
                    <td className="border border-slate-400 px-2 py-1.5" colSpan={2}>
                      YILLIK TOPLAM ({taksitler.length} taksit)
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">
                      {para(toplam)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Ödemeler banka havalesi, nakit veya kredi kartı ile yapılabilir. Havale
              açıklamasına <strong>öğrencinin adı</strong> yazılması ödemenin doğru
              öğrenciye işlenmesi için önemlidir.
            </p>

            {/* Banka ve iletişim — velinin formu elinden bırakmadan bakacağı bilgiler */}
            <div className="mt-3 rounded border border-slate-400 px-3 py-2.5 text-sm">
              <p className="text-slate-700">
                Taksit ödemelerinizi aşağıdaki banka hesabına yapmanızı rica ederiz.
              </p>
              <p className="mt-1.5 font-bold tracking-wide tabular-nums">
                IBAN: TR40 0001 0005 3202 6049 0950 02
              </p>
              <p className="font-semibold">Alıcı: EKREM BAŞLANTI</p>
              <p className="mt-2 text-slate-700">
                <strong>Ecem Can Gıda:</strong> 0551 514 18 46
                <span className="mx-2 text-slate-400">•</span>
                <strong>Ayşe Hanım:</strong> 0553 985 67 68
              </p>
            </div>
          </div>

          {/* Veli imzası — sağ altta, kâğıdın kapanışı */}
          <div className="flex justify-end">
            <div className="w-64">
              <p className="text-xs font-semibold text-slate-700">Veli İmza</p>
              <div className="mt-10 border-b border-slate-500" />
            </div>
          </div>
        </div>
      </section>
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

function Kutucuk({ etiket }: { etiket: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-4 w-4 border border-slate-600" />
      {etiket}
    </span>
  )
}

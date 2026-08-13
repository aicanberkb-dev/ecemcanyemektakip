'use client'

import { useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import { OGRENCI_TIPI_ADLARI, type OgrenciTipi, type TaksitPlani } from '@/lib/types'

/** 1. sınıfın ayrı planı yok — standart planın satırlarını kullanır. */
function planTipi(tip: OgrenciTipi): OgrenciTipi {
  return tip === 'birinci_sinif' ? 'standart' : tip
}

/**
 * Veli kayda geldiğinde doldurulan basılı form.
 *
 * Taksit tarihleri ve tutarları sistemdeki plandan gelir; elle yazılan bir
 * fiyat listesi zamanla gerçekle ayrışır. Alanlar birebir sistemdeki öğrenci
 * kaydına karşılık gelir, böylece form kâğıttan ekrana eksiksiz geçer.
 */

/** Her tipin kendi rengi var: kâğıtlar masada karışmasın. */
const TIP_GORUNUM: Record<
  OgrenciTipi,
  { kenar: string; zemin: string; yazi: string; serit: string; kisa: string }
> = {
  standart: {
    kenar: 'border-slate-800',
    zemin: 'bg-slate-100',
    yazi: 'text-slate-900',
    serit: 'bg-slate-800',
    kisa: 'STANDART',
  },
  birinci_sinif: {
    kenar: 'border-rose-600',
    zemin: 'bg-rose-100',
    yazi: 'text-rose-900',
    serit: 'bg-rose-600',
    kisa: '1. SINIF',
  },
  anasinifi: {
    kenar: 'border-amber-600',
    zemin: 'bg-amber-100',
    yazi: 'text-amber-900',
    serit: 'bg-amber-500',
    kisa: 'ANASINIFI',
  },
  anasinifi_etut: {
    kenar: 'border-violet-600',
    zemin: 'bg-violet-100',
    yazi: 'text-violet-900',
    serit: 'bg-violet-600',
    kisa: 'ANASINIFI + ETÜT',
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
    <section
      className={`kart border-2 p-0 ${g.kenar}`}
      style={sonMu ? undefined : { breakAfter: 'page' }}
    >
      {/* Tip şeridi — kâğıdın en üstünde, uzaktan ayırt edilsin */}
      <div className={`${g.serit} px-5 py-3 text-white`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-2xl font-black tracking-wide">{g.kisa}</span>
          <span className="text-sm font-semibold">KAYIT FORMU</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-300 pb-2">
          <span className="text-lg font-bold">{okulAdi}</span>
          <span className="text-sm">{sezonAdi} Eğitim Öğretim Yılı</span>
        </div>

        {/* Öğrenci */}
        <div>
          <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>ÖĞRENCİ BİLGİLERİ</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Satir etiket="Adı Soyadı" genis />
            <Satir etiket="Sınıfı" />
            <Satir etiket="T.C. Kimlik No" />
            <Satir etiket="Kart / Kimlik No" ipucu="yemekhane turnikesi" />
            <Satir etiket="Doğum Tarihi" />
          </div>
        </div>

        {/* Veli */}
        <div>
          <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>VELİ BİLGİLERİ</h3>
          <p className="mb-2 text-xs text-slate-600">
            Banka havalesi yapan kişi(ler)in adını <strong>bankadaki yazımıyla</strong>{' '}
            yazınız — ödemeler bu ada göre öğrenciyle eşleştirilir.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Satir etiket="1. Veli Adı Soyadı" />
            <Satir etiket="1. Veli Telefon" />
            <Satir etiket="2. Veli Adı Soyadı" ipucu="ödeme yapabilecek diğer kişi" />
            <Satir etiket="2. Veli Telefon" />
            <Satir etiket="Adres" genis />
          </div>
        </div>

        {/* Kardeş ve abone tipi */}
        <div>
          <h3 className={`mb-2 text-sm font-bold ${g.yazi}`}>KAYIT BİLGİLERİ</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Satir etiket="Okulda kardeşi var mı?" ipucu="varsa adı soyadı ve sınıfı" genis />
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-700">Ödeme Şekli</p>
              <div className="mt-1 flex gap-6 text-sm">
                <Kutucuk etiket="Aylıkçı (taksitli)" />
                <Kutucuk etiket="Günlükçü (yemek başına)" />
              </div>
            </div>
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
                  <th className="border border-slate-400 px-2 py-1.5 text-left">Taksit</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left">Son Ödeme</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">Tutar</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center">Ödendi</th>
                </tr>
              </thead>
              <tbody>
                {taksitler.map((t) => (
                  <tr key={t.id}>
                    <td className="border border-slate-400 px-2 py-1.5">{t.ad}</td>
                    <td className="border border-slate-400 px-2 py-1.5">
                      {tarihBicim(t.vade_tarihi)}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-right font-medium tabular-nums">
                      {para(t.tutar)}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">☐</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`${g.zemin} font-bold`}>
                  <td className="border border-slate-400 px-2 py-1.5" colSpan={2}>
                    YILLIK TOPLAM ({taksitler.length} taksit)
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">
                    {para(toplam)}
                  </td>
                  <td className="border border-slate-400" />
                </tr>
              </tfoot>
            </table>
          )}
          <p className="mt-2 text-xs text-slate-600">
            Ödemeler banka havalesi, nakit veya kredi kartı ile yapılabilir. Havale
            açıklamasına <strong>öğrencinin adı ve sınıfı</strong> yazılması ödemenin
            doğru öğrenciye işlenmesi için önemlidir.
          </p>
        </div>

        {/* İmza */}
        <div className="grid grid-cols-2 gap-8 border-t border-slate-300 pt-4">
          <div>
            <p className="text-xs text-slate-600">
              Yukarıdaki bilgilerin doğruluğunu ve taksit planını kabul ediyorum.
            </p>
            <p className="mt-6 text-sm font-semibold">Veli Adı Soyadı / İmza</p>
            <div className="mt-1 h-12 border-b border-slate-500" />
          </div>
          <div>
            <p className="text-xs text-slate-600">Kayıt tarihi ve kaydı alan görevli.</p>
            <p className="mt-6 text-sm font-semibold">Tarih / Görevli / İmza</p>
            <div className="mt-1 h-12 border-b border-slate-500" />
          </div>
        </div>
      </div>
    </section>
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

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugun, useBugunTarihi } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import { artiEksiKaydet, artiEksiSil, type FinansDurumu } from '../actions'

type Yon = 'arti' | 'eksi'
type Yontem = 'nakit' | 'havale'

export type ArtiEksiSatiri = {
  id: string
  yon: Yon
  tarih: string
  tutar: number | string
  yontem: Yontem
  aciklama: string | null
}

type Taslak = { tarih: string; tutar: string; yontem: Yontem; aciklama: string }

const YONTEM_ADLARI: Record<Yontem, string> = { nakit: 'Nakit', havale: 'Havale' }

/**
 * İki sütunlu defter: solda artılar, sağda eksiler.
 *
 * Tarih aralığı boşsa her şey sayılır; doldurulursa hem listeler hem fark o
 * aralığa göre hesaplanır.
 */
export function ArtiEksiEkrani({ satirlar }: { satirlar: ArtiEksiSatiri[] }) {
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')

  const suzulmus = useMemo(
    () =>
      satirlar.filter((s) => (!bas || s.tarih >= bas) && (!bit || s.tarih <= bit)),
    [satirlar, bas, bit],
  )

  const artilar = suzulmus.filter((s) => s.yon === 'arti')
  const eksiler = suzulmus.filter((s) => s.yon === 'eksi')
  const topla = (liste: ArtiEksiSatiri[], yontem?: Yontem) =>
    liste
      .filter((s) => !yontem || s.yontem === yontem)
      .reduce((t, s) => t + Number(s.tutar), 0)

  const fark = topla(artilar) - topla(eksiler)
  const nakitFark = topla(artilar, 'nakit') - topla(eksiler, 'nakit')
  const havaleFark = topla(artilar, 'havale') - topla(eksiler, 'havale')

  return (
    <div className="space-y-4">
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket text-xs" htmlFor="ae-bas">
            Başlangıç
          </label>
          <input
            id="ae-bas"
            type="date"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="ae-bit">
            Bitiş
          </label>
          <input
            id="ae-bit"
            type="date"
            value={bit}
            onChange={(e) => setBit(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        {(bas || bit) && (
          <button
            type="button"
            className="btn-ikincil !py-1.5"
            onClick={() => {
              setBas('')
              setBit('')
            }}
          >
            Tüm tarihler
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kart bg-emerald-50 p-4 text-emerald-800">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Artılar</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(topla(artilar))}</p>
          <p className="mt-0.5 text-xs opacity-75">{artilar.length} satır</p>
        </div>
        <div className="kart bg-red-50 p-4 text-red-800">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Eksiler</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(topla(eksiler))}</p>
          <p className="mt-0.5 text-xs opacity-75">{eksiler.length} satır</p>
        </div>
        <div
          className={`kart p-4 ${fark >= 0 ? 'bg-slate-100 text-slate-900' : 'bg-red-100 text-red-900'}`}
        >
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
            Fark (artı − eksi)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{para(fark)}</p>
          <p className="mt-0.5 text-xs tabular-nums opacity-75">
            Nakit {para(nakitFark)} · Havale {para(havaleFark)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Sutun yon="arti" satirlar={artilar} toplam={topla(artilar)} />
        <Sutun yon="eksi" satirlar={eksiler} toplam={topla(eksiler)} />
      </div>
    </div>
  )
}

function Sutun({
  yon,
  satirlar,
  toplam,
}: {
  yon: Yon
  satirlar: ArtiEksiSatiri[]
  toplam: number
}) {
  const arti = yon === 'arti'
  const renk = arti ? 'text-emerald-700' : 'text-red-700'

  return (
    <div className="kart min-w-0 overflow-hidden">
      <div
        className={`flex items-baseline justify-between border-b border-cizgi px-4 py-3 ${
          arti ? 'bg-emerald-50' : 'bg-red-50'
        }`}
      >
        <h2 className={`font-semibold ${renk}`}>{arti ? 'Artılar' : 'Eksiler'}</h2>
        <span className={`font-bold tabular-nums ${renk}`}>{para(toplam)}</span>
      </div>

      <YeniSatir yon={yon} />

      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th className="text-right">Tutar</th>
              <th>Yöntem</th>
              <th>Açıklama</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <Satir key={s.id} satir={s} renk={renk} />
            ))}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-solgun">
                  Henüz satır yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tarih, tutar, yöntem, açıklama kutuları — ekleme ve düzenlemede ortak. */
function Kutular({
  taslak,
  degistir,
  alanlar,
  kimlik,
}: {
  taslak: Taslak
  degistir: (t: Taslak) => void
  alanlar?: Record<string, string>
  kimlik: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_7rem_6.5rem_1fr] [&>div]:min-w-0">
      <div>
        <label className="etiket text-xs" htmlFor={`${kimlik}-tarih`}>
          Tarih
        </label>
        <input
          id={`${kimlik}-tarih`}
          type="date"
          value={taslak.tarih}
          onChange={(e) => degistir({ ...taslak, tarih: e.target.value })}
          className="girdi !py-1.5"
        />
        {alanlar?.tarih && <p className="mt-0.5 text-xs text-red-600">{alanlar.tarih}</p>}
      </div>
      <div>
        <label className="etiket text-xs" htmlFor={`${kimlik}-tutar`}>
          Tutar
        </label>
        <input
          id={`${kimlik}-tutar`}
          inputMode="decimal"
          value={taslak.tutar}
          onChange={(e) => degistir({ ...taslak, tutar: e.target.value })}
          placeholder="0,00"
          className="girdi !py-1.5 text-right tabular-nums"
        />
        {alanlar?.tutar && <p className="mt-0.5 text-xs text-red-600">{alanlar.tutar}</p>}
      </div>
      <div>
        <label className="etiket text-xs" htmlFor={`${kimlik}-yontem`}>
          Yöntem
        </label>
        <select
          id={`${kimlik}-yontem`}
          value={taslak.yontem}
          onChange={(e) => degistir({ ...taslak, yontem: e.target.value as Yontem })}
          className="girdi !py-1.5"
        >
          <option value="nakit">Nakit</option>
          <option value="havale">Havale</option>
        </select>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="etiket text-xs" htmlFor={`${kimlik}-aciklama`}>
          Açıklama
        </label>
        <input
          id={`${kimlik}-aciklama`}
          value={taslak.aciklama}
          onChange={(e) => degistir({ ...taslak, aciklama: e.target.value })}
          className="girdi !py-1.5"
        />
      </div>
    </div>
  )
}

function YeniSatir({ yon }: { yon: Yon }) {
  const bugun = useBugun()
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [tarih, setTarih] = useBugunTarihi()
  const [kalan, setKalan] = useState<Omit<Taslak, 'tarih'>>({
    tutar: '',
    yontem: 'nakit',
    aciklama: '',
  })
  const taslak: Taslak = { ...kalan, tarih }
  const setTaslak = ({ tarih: yeniTarih, ...digerleri }: Taslak) => {
    setTarih(yeniTarih)
    setKalan(digerleri)
  }
  const [durum, setDurum] = useState<FinansDurumu>({})

  function ekle(e: React.FormEvent) {
    e.preventDefault()
    baslat(async () => {
      const sonuc = await artiEksiKaydet(null, { yon, ...taslak })
      setDurum(sonuc)
      if (sonuc.basari) {
        // Tarih yeniden bugün, yöntem kalsın
        setTaslak({ ...taslak, tarih: bugun, tutar: '', aciklama: '' })
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={ekle} className="space-y-2 border-b border-cizgi p-4">
      <Kutular taslak={taslak} degistir={setTaslak} alanlar={durum.alanlar} kimlik={`yeni-${yon}`} />
      <div className="flex items-center gap-3">
        <button className="btn-birincil !py-1.5" disabled={bekliyor}>
          {bekliyor ? 'Ekleniyor…' : yon === 'arti' ? '+ Artı ekle' : '− Eksi ekle'}
        </button>
        {durum.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
        {durum.basari && !bekliyor && (
          <span className="text-sm text-emerald-700">{durum.basari}</span>
        )}
      </div>
    </form>
  )
}

function Satir({ satir, renk }: { satir: ArtiEksiSatiri; renk: string }) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [duzenle, setDuzenle] = useState(false)
  const [durum, setDurum] = useState<FinansDurumu>({})
  const [taslak, setTaslak] = useState<Taslak>(() => ({
    tarih: satir.tarih,
    tutar: String(Number(satir.tutar)).replace('.', ','),
    yontem: satir.yontem,
    aciklama: satir.aciklama ?? '',
  }))

  if (duzenle) {
    return (
      <tr>
        <td colSpan={5} className="bg-slate-50">
          <div className="space-y-2 py-1">
            <Kutular
              taslak={taslak}
              degistir={setTaslak}
              alanlar={durum.alanlar}
              kimlik={`satir-${satir.id}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-birincil !py-1 text-xs"
                disabled={bekliyor}
                onClick={() =>
                  baslat(async () => {
                    const sonuc = await artiEksiKaydet(satir.id, { yon: satir.yon, ...taslak })
                    setDurum(sonuc)
                    if (sonuc.basari) {
                      setDuzenle(false)
                      router.refresh()
                    }
                  })
                }
              >
                Kaydet
              </button>
              <button
                type="button"
                className="btn-ikincil !py-1 text-xs"
                onClick={() => {
                  setDuzenle(false)
                  setDurum({})
                }}
              >
                Vazgeç
              </button>
              {durum.hata && <span className="text-xs text-red-600">{durum.hata}</span>}
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={bekliyor ? 'opacity-50' : ''}>
      <td className="whitespace-nowrap">{tarihBicim(satir.tarih)}</td>
      <td className={`text-right font-medium whitespace-nowrap tabular-nums ${renk}`}>
        {para(satir.tutar)}
      </td>
      <td>
        <span className="rozet bg-slate-100 text-slate-700">{YONTEM_ADLARI[satir.yontem]}</span>
      </td>
      <td className="text-solgun">{satir.aciklama ?? '—'}</td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          className="text-xs text-vurgu hover:underline"
          onClick={() => setDuzenle(true)}
        >
          Düzenle
        </button>
        <button
          type="button"
          className="ml-3 text-xs text-red-600 hover:underline"
          disabled={bekliyor}
          onClick={() => {
            if (!confirm(`${tarihBicim(satir.tarih)} · ${para(satir.tutar)} silinsin mi?`)) return
            baslat(async () => {
              const sonuc = await artiEksiSil(satir.id)
              if (sonuc.hata) alert(sonuc.hata)
              else router.refresh()
            })
          }}
        >
          Sil
        </button>
      </td>
    </tr>
  )
}

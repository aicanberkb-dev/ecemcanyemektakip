'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugun, useBugunTarihi } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import { defterKaydet, defterSil, type FinansDurumu } from '../actions'

type Yon = 'arti' | 'eksi'

export type DefterSatiri = {
  id: string
  yon: Yon
  tarih: string
  tutar: number | string
  firma: string | null
  aciklama: string | null
}

type Taslak = { tarih: string; tutar: string; firma: string; aciklama: string }

/** Firma kutusundaki öneri listesinin kimliği — iki sütun aynı listeyi kullanır */
const FIRMA_LISTESI = 'defter-firmalar'

/**
 * Günlük defter: solda artılar, sağda eksiler; her satırda firma.
 *
 * Artı / Eksi defterinden farkı nakit/havale yerine firma olması. Firma
 * bazlı özet, bir firmaya toplam ne yazıldığını (ör. Eti'den alınan mal ile
 * Eti'ye yapılan ödeme) yan yana gösterir.
 */
export function DefterEkrani({ satirlar }: { satirlar: DefterSatiri[] }) {
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')
  const [firma, setFirma] = useState('')

  const firmalar = useMemo(
    () =>
      [...new Set(satirlar.map((s) => s.firma).filter((f): f is string => !!f))].sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [satirlar],
  )

  // Tarih aralığı hem listeye hem firma özetine uygulanır; firma seçimi yalnız
  // listeye (özet tablosu hep bütün firmaları gösterir)
  const aralikta = useMemo(
    () => satirlar.filter((s) => (!bas || s.tarih >= bas) && (!bit || s.tarih <= bit)),
    [satirlar, bas, bit],
  )
  const suzulmus = firma ? aralikta.filter((s) => s.firma === firma) : aralikta

  const artilar = suzulmus.filter((s) => s.yon === 'arti')
  const eksiler = suzulmus.filter((s) => s.yon === 'eksi')
  const topla = (liste: DefterSatiri[]) => liste.reduce((t, s) => t + Number(s.tutar), 0)
  const fark = topla(artilar) - topla(eksiler)

  const firmaOzeti = useMemo(() => {
    const m = new Map<string, { arti: number; eksi: number; adet: number }>()
    for (const s of aralikta) {
      if (!s.firma) continue
      const o = m.get(s.firma) ?? { arti: 0, eksi: 0, adet: 0 }
      o[s.yon] += Number(s.tutar)
      o.adet += 1
      m.set(s.firma, o)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [aralikta])

  return (
    <div className="space-y-4">
      <datalist id={FIRMA_LISTESI}>
        {firmalar.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket text-xs" htmlFor="df-bas">
            Başlangıç
          </label>
          <input
            id="df-bas"
            type="date"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="df-bit">
            Bitiş
          </label>
          <input
            id="df-bit"
            type="date"
            value={bit}
            onChange={(e) => setBit(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div className="min-w-48">
          <label className="etiket text-xs" htmlFor="df-firma">
            Firma
          </label>
          <select
            id="df-firma"
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            className="girdi !py-1.5"
          >
            <option value="">Tüm firmalar</option>
            {firmalar.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        {(bas || bit || firma) && (
          <button
            type="button"
            className="btn-ikincil !py-1.5"
            onClick={() => {
              setBas('')
              setBit('')
              setFirma('')
            }}
          >
            Temizle
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
          <p className="mt-0.5 text-xs opacity-75">{firma || 'Tüm firmalar'}</p>
        </div>
      </div>

      {firmaOzeti.length > 0 && (
        <div className="kart overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">Firma Özeti</h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Firma</th>
                <th className="text-right">Artı</th>
                <th className="text-right">Eksi</th>
                <th className="text-right">Fark</th>
                <th className="text-right">Satır</th>
              </tr>
            </thead>
            <tbody>
              {firmaOzeti.map(([ad, o]) => (
                <tr key={ad} className={ad === firma ? 'bg-amber-50' : ''}>
                  <td>
                    <button
                      type="button"
                      className="font-medium text-vurgu hover:underline"
                      onClick={() => setFirma(ad === firma ? '' : ad)}
                    >
                      {ad}
                    </button>
                  </td>
                  <td className="text-right tabular-nums text-emerald-700">{para(o.arti)}</td>
                  <td className="text-right tabular-nums text-red-700">{para(o.eksi)}</td>
                  <td
                    className={`text-right font-semibold tabular-nums ${
                      o.arti - o.eksi < 0 ? 'text-red-700' : ''
                    }`}
                  >
                    {para(o.arti - o.eksi)}
                  </td>
                  <td className="text-right tabular-nums text-solgun">{o.adet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Sutun yon="arti" satirlar={artilar} toplam={topla(artilar)} secilenFirma={firma} />
        <Sutun yon="eksi" satirlar={eksiler} toplam={topla(eksiler)} secilenFirma={firma} />
      </div>
    </div>
  )
}

function Sutun({
  yon,
  satirlar,
  toplam,
  secilenFirma,
}: {
  yon: Yon
  satirlar: DefterSatiri[]
  toplam: number
  secilenFirma: string
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

      <YeniSatir yon={yon} secilenFirma={secilenFirma} />

      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              <th className="text-right">Tutar</th>
              <th>Firma</th>
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

/** Tarih, tutar, firma, açıklama kutuları — ekleme ve düzenlemede ortak. */
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_7rem_1fr_1fr] [&>div]:min-w-0">
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
        <label className="etiket text-xs" htmlFor={`${kimlik}-firma`}>
          Firma
        </label>
        <input
          id={`${kimlik}-firma`}
          list={FIRMA_LISTESI}
          value={taslak.firma}
          onChange={(e) => degistir({ ...taslak, firma: e.target.value })}
          placeholder="Seç ya da yaz"
          autoComplete="off"
          className="girdi !py-1.5"
        />
      </div>
      <div>
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

function YeniSatir({ yon, secilenFirma }: { yon: Yon; secilenFirma: string }) {
  const bugun = useBugun()
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [tarih, setTarih] = useBugunTarihi()
  const [kalan, setKalan] = useState<Omit<Taslak, 'tarih'>>({
    tutar: '',
    firma: '',
    aciklama: '',
  })
  // Üstte bir firma seçiliyse yeni satırın firması boşken o gelir
  const [izlenenFirma, setIzlenenFirma] = useState(secilenFirma)
  if (secilenFirma !== izlenenFirma) {
    setIzlenenFirma(secilenFirma)
    if (!kalan.firma || kalan.firma === izlenenFirma) setKalan({ ...kalan, firma: secilenFirma })
  }
  const taslak: Taslak = { ...kalan, tarih }
  const setTaslak = ({ tarih: yeniTarih, ...digerleri }: Taslak) => {
    setTarih(yeniTarih)
    setKalan(digerleri)
  }
  const [durum, setDurum] = useState<FinansDurumu>({})

  function ekle(e: React.FormEvent) {
    e.preventDefault()
    baslat(async () => {
      const sonuc = await defterKaydet(null, { yon, ...taslak })
      setDurum(sonuc)
      if (sonuc.basari) {
        setTaslak({ tarih: bugun, tutar: '', firma: secilenFirma, aciklama: '' })
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

function Satir({ satir, renk }: { satir: DefterSatiri; renk: string }) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [duzenle, setDuzenle] = useState(false)
  const [durum, setDurum] = useState<FinansDurumu>({})
  const [taslak, setTaslak] = useState<Taslak>(() => ({
    tarih: satir.tarih,
    tutar: String(Number(satir.tutar)).replace('.', ','),
    firma: satir.firma ?? '',
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
                    const sonuc = await defterKaydet(satir.id, { yon: satir.yon, ...taslak })
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
      <td className="font-medium">{satir.firma ?? '—'}</td>
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
              const sonuc = await defterSil(satir.id)
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

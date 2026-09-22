'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugun, useBugunTarihi } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import { gunlukGiderKaydet, gunlukGiderSil, type FinansDurumu } from '../actions'

export type GiderSatiri = {
  id: string
  tarih: string
  tutar: number | string
  aciklama: string | null
}

/**
 * Günlük gider defteri.
 *
 * Günlük Defter'den farkı: firma, eşleştirme, borç hesabı yok. Gün içinde ne
 * harcandıysa not gibi düşülür; tek gruplama gün, tek hesap günün toplamı.
 */
export function GiderEkrani({ satirlar }: { satirlar: GiderSatiri[] }) {
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')

  const suzulmus = useMemo(
    () => satirlar.filter((s) => (!bas || s.tarih >= bas) && (!bit || s.tarih <= bit)),
    [satirlar, bas, bit],
  )

  // Gün gün gruplanır; en yeni gün üstte
  const gunler = useMemo(() => {
    const m = new Map<string, GiderSatiri[]>()
    for (const s of suzulmus) m.set(s.tarih, [...(m.get(s.tarih) ?? []), s])
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [suzulmus])

  const toplam = suzulmus.reduce((t, s) => t + Number(s.tutar), 0)
  const gunToplami = (liste: GiderSatiri[]) => liste.reduce((t, s) => t + Number(s.tutar), 0)

  return (
    <div className="space-y-4">
      <YeniGider />

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket text-xs" htmlFor="gd-bas">
            Başlangıç
          </label>
          <input
            id="gd-bas"
            type="date"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="gd-bit">
            Bitiş
          </label>
          <input
            id="gd-bit"
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
        <div className="ml-auto text-right">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Dönem toplamı
          </p>
          <p className="text-2xl font-bold tabular-nums text-red-700">{para(toplam)}</p>
          <p className="text-xs text-solgun">{suzulmus.length} satır</p>
        </div>
      </div>

      {gunler.map(([gun, liste]) => (
        <div key={gun} className="kart overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-cizgi bg-slate-50 px-4 py-2.5">
            <h2 className="font-semibold">{tarihBicim(gun)}</h2>
            <span className="font-bold tabular-nums text-red-700">
              {para(gunToplami(liste))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="tablo">
              <tbody>
                {liste.map((s) => (
                  <GiderSatir key={s.id} satir={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {gunler.length === 0 && (
        <p className="kart p-8 text-center text-solgun">
          Henüz gider yazılmamış. Yukarıdan bugünün giderlerini ekleyin.
        </p>
      )}
    </div>
  )
}

function YeniGider() {
  const bugun = useBugun()
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [tarih, setTarih] = useBugunTarihi()
  const [tutar, setTutar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [durum, setDurum] = useState<FinansDurumu>({})

  function ekle(e: React.FormEvent) {
    e.preventDefault()
    baslat(async () => {
      const sonuc = await gunlukGiderKaydet(null, { tarih, tutar, aciklama })
      setDurum(sonuc)
      if (sonuc.basari) {
        // Tarih kalsın: aynı günün giderleri art arda giriliyor
        setTutar('')
        setAciklama('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={ekle} className="kart space-y-2 p-4">
      <div className="grid gap-2 sm:grid-cols-[9.5rem_8rem_1fr_auto] [&>div]:min-w-0">
        <div>
          <label className="etiket text-xs" htmlFor="gd-tarih">
            Tarih
          </label>
          <input
            id="gd-tarih"
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            className="girdi !py-1.5"
          />
          {durum.alanlar?.tarih && (
            <p className="mt-0.5 text-xs text-red-600">{durum.alanlar.tarih}</p>
          )}
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="gd-tutar">
            Tutar
          </label>
          <input
            id="gd-tutar"
            inputMode="decimal"
            placeholder="0,00"
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            className="girdi !py-1.5 text-right tabular-nums"
          />
          {durum.alanlar?.tutar && (
            <p className="mt-0.5 text-xs text-red-600">{durum.alanlar.tutar}</p>
          )}
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="gd-aciklama">
            Açıklama
          </label>
          <input
            id="gd-aciklama"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="ör. mazot, sebze, tamirat…"
            className="girdi !py-1.5"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : '+ Gider ekle'}
          </button>
        </div>
      </div>
      {durum.hata && <p className="text-sm text-red-600">{durum.hata}</p>}
      {durum.basari && !bekliyor && (
        <p className="text-sm text-emerald-700">
          {durum.basari} — tarih {tarihBicim(tarih)} olarak kaldı, aynı güne devam
          edebilirsin{tarih !== bugun ? ' (bugün değil!)' : ''}.
        </p>
      )}
    </form>
  )
}

function GiderSatir({ satir }: { satir: GiderSatiri }) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [duzenle, setDuzenle] = useState(false)
  const [tutar, setTutar] = useState(String(Number(satir.tutar)).replace('.', ','))
  const [aciklama, setAciklama] = useState(satir.aciklama ?? '')
  const [tarih, setTarih] = useState(satir.tarih)
  const [hata, setHata] = useState<string | null>(null)

  if (duzenle) {
    return (
      <tr className="bg-slate-50">
        <td colSpan={3} className="px-3 py-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="etiket text-xs">Tarih</label>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Tutar</label>
              <input
                inputMode="decimal"
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                className="girdi w-28 !py-1.5 text-right tabular-nums"
              />
            </div>
            <div className="min-w-48 flex-1">
              <label className="etiket text-xs">Açıklama</label>
              <input
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                className="girdi !py-1.5"
              />
            </div>
            <button
              type="button"
              className="btn-birincil !py-1.5 text-xs"
              disabled={bekliyor}
              onClick={() =>
                baslat(async () => {
                  const sonuc = await gunlukGiderKaydet(satir.id, { tarih, tutar, aciklama })
                  if (sonuc.hata || sonuc.alanlar) {
                    setHata(sonuc.hata ?? 'Girilen değerlerde hata var.')
                    return
                  }
                  setDuzenle(false)
                  router.refresh()
                })
              }
            >
              Kaydet
            </button>
            <button
              type="button"
              className="btn-ikincil !py-1.5 text-xs"
              onClick={() => {
                setDuzenle(false)
                setHata(null)
              }}
            >
              Vazgeç
            </button>
            {hata && <span className="text-xs text-red-600">{hata}</span>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={bekliyor ? 'opacity-50' : ''}>
      <td className="w-32 text-right font-medium whitespace-nowrap tabular-nums text-red-700">
        {para(satir.tutar)}
      </td>
      <td className="whitespace-pre-wrap">{satir.aciklama ?? '—'}</td>
      <td className="w-28 text-right whitespace-nowrap">
        <button
          type="button"
          className="text-xs text-vurgu hover:underline"
          onClick={() => setDuzenle(true)}
        >
          Düzelt
        </button>
        <button
          type="button"
          className="ml-3 text-xs text-red-600 hover:underline"
          disabled={bekliyor}
          onClick={() => {
            if (!confirm(`${para(satir.tutar)} — ${satir.aciklama ?? ''} silinsin mi?`)) return
            baslat(async () => {
              const sonuc = await gunlukGiderSil(satir.id)
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

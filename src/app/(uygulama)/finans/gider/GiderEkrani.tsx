'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { AramaKutusu } from '@/components/AramaKutusu'
import { useBugun, useBugunTarihi } from '@/components/BugunSaglayici'
import { aramaEslesir } from '@/lib/arama'
import { AY_ADLARI, para, tarih as tarihBicim } from '@/lib/format'

import { gunlukGiderKaydet, gunlukGiderSil, type FinansDurumu } from '../actions'

export type GiderSatiri = {
  id: string
  /** 'gider' bu ekrandan girilen, 'tedarikci' ödenen tedarikçi satırı */
  kaynak: 'gider' | 'tedarikci'
  tarih: string
  tutar: number | string
  masraf_noktasi: string | null
  aciklama: string | null
}

/** Masraf noktası önerilerinin listesi — ekleme ve düzeltmede ortak */
const NOKTA_LISTESI = 'masraf-noktalari'

/** '2026-09' → 'Eylül 2026' */
function ayEtiketi(ay: string): string {
  const [yil, no] = ay.split('-')
  return `${AY_ADLARI[Number(no) - 1]} ${yil}`
}

/** Ayın ilk ve son günü: seçilince tarih aralığı oraya daralır */
function ayAraligi(ay: string): { bas: string; bit: string } {
  const [yil, no] = ay.split('-').map(Number)
  const son = new Date(yil, no, 0).getDate()
  return {
    bas: `${ay}-01`,
    bit: `${ay}-${String(son).padStart(2, '0')}`,
  }
}

export function GiderEkrani({ satirlar }: { satirlar: GiderSatiri[] }) {
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')
  const [ay, setAy] = useState('')
  const [arama, setArama] = useState('')
  /** Masraf noktası özeti kapalı başlar; başlığa basınca aşağı açılır */
  const [ozetAcik, setOzetAcik] = useState(false)

  const noktalar = useMemo(
    () =>
      [...new Set(satirlar.map((s) => s.masraf_noktasi).filter((n): n is string => !!n))].sort(
        (a, b) => a.localeCompare(b, 'tr'),
      ),
    [satirlar],
  )

  // Kayıtlarda geçen aylar, yeniden eskiye
  const aylar = useMemo(
    () => [...new Set(satirlar.map((s) => s.tarih.slice(0, 7)))].sort().reverse(),
    [satirlar],
  )

  const suzulmus = useMemo(
    () =>
      satirlar.filter((s) => {
        if (bas && s.tarih < bas) return false
        if (bit && s.tarih > bit) return false
        if (!arama.trim()) return true
        return aramaEslesir(`${s.masraf_noktasi ?? ''} ${s.aciklama ?? ''}`, arama)
      }),
    [satirlar, bas, bit, arama],
  )

  const gunler = useMemo(() => {
    const m = new Map<string, GiderSatiri[]>()
    for (const s of suzulmus) m.set(s.tarih, [...(m.get(s.tarih) ?? []), s])
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [suzulmus])

  const toplam = suzulmus.reduce((t, s) => t + Number(s.tutar), 0)
  const gunToplami = (liste: GiderSatiri[]) => liste.reduce((t, s) => t + Number(s.tutar), 0)

  // Süzmede hangi masraf noktasına ne kadar gitmiş
  const noktaOzeti = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of suzulmus) {
      const ad = s.masraf_noktasi ?? '—'
      m.set(ad, (m.get(ad) ?? 0) + Number(s.tutar))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [suzulmus])

  return (
    <div className="space-y-4">
      <datalist id={NOKTA_LISTESI}>
        {noktalar.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <YeniGider noktalar={noktalar} />

      <div className="kart space-y-3 p-4">
        <AramaKutusu
          deger={arama}
          degistir={setArama}
          etiket="Masraf ara"
          ipucu="Masraf noktası ya da açıklamanın bir parçası yeter: elek · doğalg · mega"
          sonuc={`${suzulmus.length} / ${satirlar.length} satır`}
          oneriler={noktalar
            .filter((n) => aramaEslesir(n, arama))
            .slice(0, 8)
            .map((n) => ({ deger: n, etiket: n }))}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <label className="etiket text-xs" htmlFor="gd-ay">
              Ay
            </label>
            <select
              id="gd-ay"
              value={ay}
              onChange={(e) => {
                const secilen = e.target.value
                setAy(secilen)
                if (!secilen) {
                  setBas('')
                  setBit('')
                  return
                }
                const aralik = ayAraligi(secilen)
                setBas(aralik.bas)
                setBit(aralik.bit)
              }}
              className="girdi !py-1.5"
            >
              <option value="">Tüm aylar</option>
              {aylar.map((a) => (
                <option key={a} value={a}>
                  {ayEtiketi(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiket text-xs" htmlFor="gd-bas">
              Başlangıç
            </label>
            <input
              id="gd-bas"
              type="date"
              value={bas}
              onChange={(e) => {
                setBas(e.target.value)
                setAy('')
              }}
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
              onChange={(e) => {
                setBit(e.target.value)
                setAy('')
              }}
              className="girdi !py-1.5"
            />
          </div>
          {(bas || bit || ay || arama) && (
            <button
              type="button"
              className="btn-ikincil !py-1.5"
              onClick={() => {
                setBas('')
                setBit('')
                setAy('')
                setArama('')
              }}
            >
              Temizle
            </button>
          )}
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
              {ay ? ayEtiketi(ay) : 'Seçili aralık'} toplamı
            </p>
            <p className="text-2xl font-bold tabular-nums text-red-700">{para(toplam)}</p>
            <p className="text-xs text-solgun">{suzulmus.length} satır</p>
          </div>
        </div>
      </div>

      {/* Özet kapalı gelir: asıl iş günlük listede, bu yalnız istenince açılır */}
      {noktaOzeti.length > 1 && (
        <div className="kart overflow-hidden">
          <button
            type="button"
            onClick={() => setOzetAcik((a) => !a)}
            aria-expanded={ozetAcik}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold hover:bg-slate-50"
          >
            <span>
              Masraf Noktası Özeti
              <span className="ml-2 text-xs font-normal text-solgun">
                {noktaOzeti.length} nokta
              </span>
            </span>
            <span className="text-sm font-normal text-solgun">
              {ozetAcik ? '▲ gizle' : '▼ göster'}
            </span>
          </button>

          {ozetAcik && (
            <div className="overflow-x-auto border-t border-cizgi">
              <table className="tablo">
                <thead>
                  <tr>
                    <th>Masraf Noktası</th>
                    <th className="text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {noktaOzeti.map(([ad, tutar]) => (
                    <tr key={ad}>
                      <td>
                        <button
                          type="button"
                          className="font-medium text-vurgu hover:underline"
                          onClick={() => setArama(arama === ad ? '' : ad)}
                        >
                          {ad}
                        </button>
                      </td>
                      <td className="text-right font-medium tabular-nums text-red-700">
                        {para(tutar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
                  <GiderSatir key={`${s.kaynak}-${s.id}`} satir={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {gunler.length === 0 && (
        <p className="kart p-8 text-center text-solgun">
          {arama.trim() || bas || bit
            ? 'Bu süzmeye uyan masraf yok.'
            : 'Henüz masraf yazılmamış. Yukarıdan bugünün masraflarını ekleyin.'}
        </p>
      )}
    </div>
  )
}

function YeniGider({ noktalar }: { noktalar: string[] }) {
  const bugun = useBugun()
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [tarih, setTarih] = useBugunTarihi()
  const [tutar, setTutar] = useState('')
  const [nokta, setNokta] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [durum, setDurum] = useState<FinansDurumu>({})

  function ekle(e: React.FormEvent) {
    e.preventDefault()
    baslat(async () => {
      const sonuc = await gunlukGiderKaydet(null, {
        tarih,
        tutar,
        masraf_noktasi: nokta,
        aciklama,
      })
      setDurum(sonuc)
      if (sonuc.basari) {
        // Tarih kalsın: aynı günün masrafları art arda giriliyor
        setTutar('')
        setNokta('')
        setAciklama('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={ekle} className="kart space-y-2 p-4">
      <div className="grid gap-2 sm:grid-cols-[9.5rem_8rem_1fr_1fr_auto] [&>div]:min-w-0">
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
          <label className="etiket text-xs" htmlFor="gd-nokta">
            Masraf Noktası
          </label>
          <input
            id="gd-nokta"
            list={NOKTA_LISTESI}
            value={nokta}
            onChange={(e) => setNokta(e.target.value)}
            placeholder="Seç ya da yeni yaz"
            autoComplete="off"
            className="girdi !py-1.5"
          />
          {durum.alanlar?.masraf_noktasi && (
            <p className="mt-0.5 text-xs text-red-600">{durum.alanlar.masraf_noktasi}</p>
          )}
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="gd-aciklama">
            Açıklama (isteğe bağlı)
          </label>
          <input
            id="gd-aciklama"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="ör. 2 koli, fatura no…"
            className="girdi !py-1.5"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : '+ Masraf ekle'}
          </button>
        </div>
      </div>
      {noktalar.length > 0 && (
        <p className="text-xs text-solgun">
          Masraf noktası kutusuna birkaç harf yazınca eskiler listelenir; yeni bir yer
          yazarsan listeye kendiliğinden girer.
        </p>
      )}
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
  const [nokta, setNokta] = useState(satir.masraf_noktasi ?? '')
  const [aciklama, setAciklama] = useState(satir.aciklama ?? '')
  const [tarih, setTarih] = useState(satir.tarih)
  const [hata, setHata] = useState<string | null>(null)

  // Tedarikçi ödemeleri kendi defterinde düzenlenir: burada yalnız görünür
  const tedarikci = satir.kaynak === 'tedarikci'

  if (duzenle) {
    return (
      <tr className="bg-slate-50">
        <td colSpan={4} className="px-3 py-2">
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
            <div className="min-w-40">
              <label className="etiket text-xs">Masraf Noktası</label>
              <input
                list={NOKTA_LISTESI}
                value={nokta}
                onChange={(e) => setNokta(e.target.value)}
                autoComplete="off"
                className="girdi !py-1.5"
              />
            </div>
            <div className="min-w-40 flex-1">
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
                  const sonuc = await gunlukGiderKaydet(satir.id, {
                    tarih,
                    tutar,
                    masraf_noktasi: nokta,
                    aciklama,
                  })
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
      <td className="font-medium">
        {satir.masraf_noktasi ?? '—'}
        {tedarikci && (
          <span
            className="rozet ml-2 bg-slate-100 text-slate-600"
            title="Tedarikçi Girdi-Çıktı defterinden gelen ödeme"
          >
            Tedarikçi
          </span>
        )}
      </td>
      <td className="whitespace-pre-wrap text-solgun">{satir.aciklama ?? '—'}</td>
      <td className="w-28 text-right whitespace-nowrap">
        {tedarikci ? (
          <span className="text-xs text-solgun">tedarikçi defterinde</span>
        ) : (
          <>
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
                if (!confirm(`${para(satir.tutar)} — ${satir.masraf_noktasi ?? ''} silinsin mi?`))
                  return
                baslat(async () => {
                  const sonuc = await gunlukGiderSil(satir.id)
                  if (sonuc.hata) alert(sonuc.hata)
                  else router.refresh()
                })
              }}
            >
              Sil
            </button>
          </>
        )}
      </td>
    </tr>
  )
}
